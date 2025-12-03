import amqp from 'amqplib';

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const QUEUES = {
    EMAIL: 'email_queue',
    SMS: 'sms_queue',
    WHATSAPP: 'whatsapp_queue',
    LOGS: 'logs_queue'
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
        return false;
    }

    try {
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
            persistent: true
        })
        return true;
    } catch (error) {
        console.error('Failed to publish message:', error.message);
        return false;
    }
}