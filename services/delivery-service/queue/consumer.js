import { v4 as uuidv4 } from "uuid";
import { RabbitMQClient } from "../../shared/rabbitMq.js";
import { saveDelivery } from "../db/database.js";
import Logger from "../../shared/logger.js";

const logger = new Logger('delivery-service');

const QUEUES = {
  email: "email_queue",
  sms: "sms_queue",
  whatsapp: "whatsapp_queue",
};

async function handleMessage(channel, payload) {
  const {
    messageId,
    recipient,
    message,
    metadata,
    traceId,
    subTraceId,
  } = payload;

  const id = messageId || uuidv4();
  const logTraceId = traceId || logger.generateTraceId();
  const logSubTraceId = subTraceId || logger.generateSubTraceId();

  await logger.info(`Processing message from queue: ${channel}`, logTraceId, logSubTraceId, {
    id,
    channel,
    recipient: recipient ? recipient.substring(0, 10) + '...' : undefined
  });

  saveDelivery({
    id,
    channel,
    recipient,
    message,
    metadata,
    status: "sent",
    attempts: payload.attempts || 1,
  });

  await logger.info(`Message delivered via ${channel} queue`, logTraceId, logSubTraceId, {
    id,
    channel,
    recipient: recipient ? recipient.substring(0, 10) + '...' : undefined,
  });
}

export async function startQueueConsumer(rabbitUrl) {
  const traceId = logger.generateTraceId();
  const client = new RabbitMQClient(rabbitUrl);
  const connected = await client.connect();

  if (!connected) {
    await logger.warn(
      "RabbitMQ unavailable; queue consumption disabled",
      traceId
    );
    console.log(
      "[delivery-service][queue] RabbitMQ unavailable; queue consumption disabled"
    );
    return null;
  }

  for (const queueName of Object.values(QUEUES)) {
    await client.createQueue(queueName);
  }

  await Promise.all(
    Object.entries(QUEUES).map(([channel, queueName]) =>
      client.consume(queueName, async (msg) => {
        try {
          console.log(`[delivery-service][queue] Received message on ${queueName}:`, JSON.stringify(msg, null, 2));
          await handleMessage(channel, msg);
        } catch (error) {
          console.error(`[delivery-service][queue] Error processing message from ${queueName}:`, error);
          await logger.error(`Error processing message from ${queueName}`, msg.traceId || logger.generateTraceId(), msg.subTraceId, {
            error: error.message,
            channel,
            queueName
          });
          throw error; // Re-throw so message isn't acked and can be retried
        }
      })
    )
  );

  await logger.info(
    `Consumers running for queues: ${Object.values(QUEUES).join(", ")}`,
    traceId
  );
  console.log(
    "[delivery-service][queue] Consumers running for queues:",
    Object.values(QUEUES).join(", ")
  );

  return client;
}


