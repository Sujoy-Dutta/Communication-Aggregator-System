import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import { getDatabase } from "../db/database";
import { getChannel, getQueues, publishMessage } from "../queue/rabbitmq";
import Logger from "../../shared/logger";

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
    
}




