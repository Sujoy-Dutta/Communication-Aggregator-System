import express from 'express';
import Logger from '../shared/logger.js';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { initDatabase } from './db/database.js';
import { initRabbitMq } from './queue/rabbitmq.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';

const app = express();
const PORT = process.env.PORT || 3001;
const logger = new Logger('task-router-service');
app.use(express.json());

await initDatabase();
console.log('Database initialized');

const rabbitConnected = await initRabbitMq();
  if (!rabbitConnected) {
    console.log('Running without RabbitMQ - will use HTTP fallback for delivery');
  }

app.get('/', (req, res) =>{
    return res.json({ msg: "Server is running!"})
})

const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

await server.start();

app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
        const traceId = req.headers['x-trace-id'] || logger.generateTraceId();
        return { traceId, logger };
    }
}))

app.listen(PORT, () =>{
    console.log(`Task Router Service running on port ${PORT}`);
    console.log(`\nGraphQL API:`);
    console.log(`  Endpoint: http://localhost:${PORT}/graphql`);
})



