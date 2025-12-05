export const typeDefs = `#graphql
  type Message {
    id: ID!
    channel: String!
    recipient: String!
    message: String!
    status: String!
    attempts: Int
    createdAt: String!
    updatedAt: String
    metadata: String
  }

  type SendMessageResponse {
    success: Boolean!
    messageId: ID
    status: String
    error: String
    traceId: String
  }

  input SendMessageInput {
    channel: String!
    recipient: String!
    message: String!
    metadata: String
  }

  type Query {
    hello: String
    message(id: ID!): Message
    messages(limit: Int): [Message!]!
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): SendMessageResponse!
  }
`;

