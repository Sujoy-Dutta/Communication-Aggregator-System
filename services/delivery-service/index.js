import express from "express";
import { v4 as uuidv4 } from "uuid";
import { initDatabase, getDatabase, saveDelivery } from "./db/database.js";
import { startQueueConsumer } from "./queue/consumer.js";
import Logger from "../shared/logger.js";

const app = express();
const PORT = process.env.PORT || 3002;
const CHANNELS = ["email", "sms", "whatsapp"];
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const logger = new Logger('delivery-service');

app.use(express.json());

initDatabase();
startQueueConsumer(RABBITMQ_URL);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "delivery-service" });
});

app.post("/deliver/:channel", async (req, res) => {
  const traceId = req.body.traceId || logger.generateTraceId();
  const subTraceId = logger.generateSubTraceId();
  const channel = req.params.channel?.toLowerCase();
  const { recipient, message, metadata } = req.body || {};

  await logger.info(`Received delivery request for channel: ${channel}`, traceId, subTraceId, {
    channel,
    recipient: recipient ? recipient.substring(0, 10) + '...' : undefined
  });

  if (!channel || !CHANNELS.includes(channel)) {
    await logger.warn(`Invalid channel requested: ${channel}`, traceId, subTraceId);
    return res.status(400).json({
      success: false,
      error: `Invalid channel. Must be one of: ${CHANNELS.join(", ")}`,
    });
  }

  if (!recipient || !message) {
    await logger.warn('Missing required fields: recipient or message', traceId, subTraceId);
    return res.status(400).json({
      success: false,
      error: "Recipient and message are required",
    });
  }

  const id = req.body.messageId || uuidv4();
  saveDelivery({
    id,
    channel,
    recipient,
    message,
    metadata,
    status: "sent",
    attempts: 1,
  });
  
  await logger.info(`Message delivered via ${channel}`, traceId, subTraceId, {
    id,
    channel,
    recipient: recipient.substring(0, 10) + '...',
  });

  res.json({
    success: true,
    messageId: id,
    status: "sent",
    channel,
    traceId,
    subTraceId,
  });
});

app.listen(PORT, async () => {
  const traceId = logger.generateTraceId();
  await logger.info(`Delivery Service started on port ${PORT}`, traceId);
  await logger.info(`POST http://localhost:${PORT}/deliver/:channel`, traceId);
  console.log(`Delivery Service running on port ${PORT}`);
  console.log(`POST http://localhost:${PORT}/deliver/:channel`);
});


