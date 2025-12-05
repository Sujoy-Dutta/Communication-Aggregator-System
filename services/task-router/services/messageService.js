import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import { getDatabase } from "../db/database.js";
import { getChannel, getQueues, publishMessage } from "../queue/rabbitmq.js";
import Logger from "../../shared/logger.js";

const logger = new Logger('task-router-service');
const delivery_service_url = process.env.delivery_service_url || 'http://localhost:3002';

const CHANNELS = ['email', 'sms', 'whatsapp'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function generateHash(channel, recipient, message) {
    const msg = `${channel}:${recipient}:${message}`;
    return CryptoJS.SHA256(msg).toString();
};

function validatePayload(payload) {
    const channel = payload.channel?.toString().toLowerCase().trim();

    if (!channel) {
        throw new Error('Channel is required!');
    }

    if (!CHANNELS.includes(channel)) {
        throw new Error(`Invalid channel. Must be one of: ${CHANNELS.join(', ')}`);
    }

    const recipient = payload.recipient?.toString().trim();

    if (!recipient) {
        throw new Error('Recipient is required!');
    }

    if (channel === 'email' && !recipient.includes('@')) {
        throw new Error('Invalid email format');
    }

    if (channel === 'sms' && !/^\+?[\d\s-]{10,}$/.test(recipient)) {
        throw new Error('Invalid phone number format');
    }

    const message = payload.message?.toString().trim();

    if (!message) {
        throw new Error('Message is required!');
    }
}

async function checkDuplicateMsg(contentHash) {
    const db = getDatabase();
    const existing = db.prepare(
        "SELECT id, status from messages WHERE content_hash = ? AND status IN ('sent', 'pending') AND created_at> datetime('now', '-1 hour')"
    ).get(contentHash);

    return existing;
}

async function saveMessage(id, payload, contentHash) {
    const db = getDatabase();
    const stmt = db.prepare(
        `INSERT INTO messages(id, channel, recipient, message, content_hash, status, metadata)
        VALUES(?, ?, ?, ?, ?, ?, ?)
        `
    );
    stmt.run(
        id,
        payload.channel.toLowerCase(),
        payload.recipient,
        payload.message,
        contentHash,
        'pending',
        payload.metadata? JSON.stringify(payload.metadata) : null
    );
}

async function updateMessage(id, status, attempts) {
    const db = getDatabase();
    const stmt = db.prepare(
        `UPDATE messages SET status= ?, attempts= ?, updated_at= CURRENT_TIMESTAMP WHERE id= ?`
    );
    stmt.run(
        status,
        attempts,
        id
    )
}

async function deliverViaHTTP(channel, messageData, traceId) {
    const fetch = (await import('node-fetch')).default;
    const endpoint = `${delivery_service_url}/deliver/${channel}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-ID': traceId
      },
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      throw new Error(`Delivery failed with status ${response.status}`);
    }
    
    return await response.json();
  }

  export async function deliverMessage(channel, messageData, traceId, attempts = 1) {
    const subTraceId = logger.generateSubTraceId();
    await logger.info(`Attempting to deliver via ${channel}`, traceId, subTraceId, {
        attempts,
        messageId: messageData.messageId
    });

    const channelQueue = getChannel();
    const queues = getQueues();

    if(channelQueue) {
        const queueName = queues[channel.toLowerCase()];
        const published = await publishMessage(queueName, { ...messageData, traceId, subTraceId });

        if (published) {
            await logger.info(`Message published to ${queueName}`, traceId, subTraceId);
            return { success: true, method: 'queue', attempts: attempts };
        }
    }   

    try {
        const result = await deliverViaHTTP(channel, { ...messageData, traceId, subTraceId }, traceId);
        await logger.info(`Message delivered via HTTP to ${channel}`, traceId, subTraceId);
        return { success: true, method: 'http', result, attempts: attempts };
    } catch (error) {
        await logger.error(`Delivery attempt ${attempts} failed`, traceId, subTraceId, { error: error.message });
        
        if (attempts < MAX_RETRIES) {
          await logger.info(`Retrying delivery, attempt ${attempts + 1}/${MAX_RETRIES}`, traceId, subTraceId);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
          return deliverMessage(channel, messageData, traceId, attempts + 1);
        }
        
        throw error;
    }
}

export async function sendMessage(payload, traceId) {
    const subTraceId = logger.generateSubTraceId();

    await logger.info('Processing new message', traceId, subTraceId, {
        channel: payload.channel,
        recipient: payload.recipient
    })

    try {
        validatePayload(payload);
      } catch (err) {
        await logger.warn('Validation failed', traceId, subTraceId)
        return { success: false, error: err.message,traceId };
    };

    const contentHash = generateHash(payload.channel.toLowerCase(), payload.recipient, payload.message);
    console.log("contentHash", contentHash)

    const duplicate = await checkDuplicateMsg(contentHash);
    if(duplicate) {
        await logger.warn('Duplicate message detected', traceId, subTraceId, { 
            existingId: duplicate.id 
        });
        return {
            success: false,
            error: 'Duplicate message detected. This message was already sent recently.',
            messageId: duplicate.id,
            traceId
            };
    }

    const messageId = uuidv4();
    await saveMessage(messageId, payload, contentHash);
    await logger.info('Message saved to database', traceId, subTraceId, { messageId });
    console.log('Message saved to database', traceId, subTraceId, { messageId })

    try {
        const deliverResult = await deliverMessage(payload.channel.toLowerCase(), {
            messageId,
            recipient: payload.recipient,
            message: payload.message,
            metadata: payload.metadata   
            },
            traceId
        )
        console.log("DeliveryResult:", deliverResult)
        await updateMessage(messageId, 'sent', deliverResult.attempts || 1);
    
        await logger.info('Message sent successfully', traceId, subTraceId, { 
          messageId, 
          method: deliverResult.method 
        });
        console.log('Message sent successfully', traceId, subTraceId, { 
          messageId, 
          method: deliverResult.method 
        })
        
        return {
          success: true,
          messageId,
          status: 'sent',
          traceId
        };
      } catch (error) {
        await updateMessage(messageId, 'failed', MAX_RETRIES);
        
        await logger.error('Message delivery failed after all retries', traceId, subTraceId, {
          messageId,
          error: error.message
        });
        
        return {
          success: false,
          messageId,
          status: 'failed',
          error: error.message,
          traceId
        };
      }
    }

    export async function getMessageById(id) {
        const db = getDatabase();
        const row = db.prepare(`SELECT * FROM messages WHERE id= ?`).get(id);

        if(!row) return null;

        return {
            id: row.id,
            channel: row.channel,
            recipient: row.recipient,
            message: row.message,
            status: row.status,
            attempts: row.attempts,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: row.metadata
        }
    }
    export async function getAllMessages() {
        const db = getDatabase();
        const rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').all();
        
        return rows.map(row => ({
          id: row.id,
          channel: row.channel,
          recipient: row.recipient,
          message: row.message,
          status: row.status,
          attempts: row.attempts,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: row.metadata
        }));
      }




