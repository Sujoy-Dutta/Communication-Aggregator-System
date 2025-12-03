import amqp from 'amqplib';

export class RabbitMQClient {
    constructor(url = 'amqp://localhost:5672') {
        this.url = url;
        this.connection = null;
        this.channel = null
    }

    async connect() {
        try {
          this.connection = await amqp.connect(this.url);
          this.channel = await this.connection.createChannel();
          console.log('Connected to RabbitMQ');
          return true;
        } catch (error) {
          console.error('Failed to connect to RabbitMQ:', error.message);
          return false;
        }
      }
    
    async createQueue(queueName) {
    if (!this.channel) {
        throw new Error('Not connected to RabbitMQ');
    }
    await this.channel.assertQueue(queueName, { durable: true });
    }

    async publish(queueName, message) {
    if (!this.channel) {
        throw new Error('Not connected to RabbitMQ');
    }
    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true
    });
    }

    async consume(queueName, callback) {
    if (!this.channel) {
        throw new Error('Not connected to RabbitMQ');
    }
    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.consume(queueName, async (msg) => {
        if (msg) {
        const content = JSON.parse(msg.content.toString());
        await callback(content);
        this.channel.ack(msg);
        }
    });
    }

    async close() {
    if (this.connection) {
        await this.connection.close();
    }
    }
}