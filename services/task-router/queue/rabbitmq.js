import amqp from 'amqplib';

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const QUEUES = {
    email: 'email_queue',
    sms: 'sms_queue',
    whatsapp: 'whatsapp_queue',
    logs: 'logs_queue'
  };

export async function initRabbitMq() {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        for (const queue of Object.values(QUEUES)) {
            await channel.assertQueue(queue, {durable: true})
        }
        console.log('Connected to RabbitMQ');
        return true;
    } catch(error) {
        console.error('Failed to connect to RabbitMQ:', error.message);
        console.log('Will use HTTP fallback for message delivery');
        return false;
    }
}

export function getChannel() {
    return channel;
}

export function getQueues() {
    return QUEUES;
}

export async function publishMessage(queueName, message) {
    if(!channel){
        console.error('[task-router][queue] No channel available for publishing');
        return false;
    }

    try {
        const messageBuffer = Buffer.from(JSON.stringify(message));
        const published = channel.sendToQueue(queueName, messageBuffer, {
            persistent: true
        });
        
        if (!published) {
            console.warn(`[task-router][queue] Message not published to ${queueName} - queue might be full`);
            return false;
        }
        
        console.log(`[task-router][queue] Message published to ${queueName}`, {
            queueName,
            messageId: message.messageId || 'unknown'
        });
        return true;
    } catch (error) {
        console.error(`[task-router][queue] Failed to publish message to ${queueName}:`, error.message);
        return false;
    }
}