import { sendMessage, getMessageById, getAllMessages } from '../services/messageService.js';

export const resolvers = {
  Query: {
    hello: () => "Hello from GraphQL API!",
    
    message: async (_, { id }, context) => {
      const { logger, traceId } = context;
      await logger.info('GraphQL: Fetching message by ID', traceId, null, { messageId: id });
      
      try {
        const message = await getMessageById(id);
        if (!message) {
          await logger.warn('Message not found', traceId, null, { messageId: id });
          return null;
        }
        return message;
      } catch (error) {
        await logger.error('Error fetching message', traceId, null, { error: error.message });
        throw error;
      }
    },
    
    messages: async (_, { limit = 100 }, context) => {
      const { logger, traceId } = context;
      await logger.info('GraphQL: Fetching all messages', traceId, null, { limit });
      
      try {
        const messages = await getAllMessages();
        return messages.slice(0, limit);
      } catch (error) {
        await logger.error('Error fetching messages', traceId, null, { error: error.message });
        throw error;
      }
    }
  },
  
  Mutation: {
    sendMessage: async (_, { input }, context) => {
      const { logger, traceId } = context;
      await logger.info('GraphQL: Received send message request', traceId, null, {
        channel: input.channel,
        recipient: input.recipient
      });
      
      try {
        const payload = {
          ...input,
          metadata: input.metadata ? (typeof input.metadata === 'string' ? JSON.parse(input.metadata) : input.metadata) : null
        };
        
        const result = await sendMessage(payload, traceId);
        return result;
      } catch (error) {
        await logger.error('Error sending message', traceId, null, { error: error.message });
        return {
          success: false,
          error: error.message,
          traceId
        };
      }
    }
  }
};

