**Project Overview**
- **Name:** Communication Aggregator System
- **Purpose:** microservices that accepts messages via a GraphQL API (task-router), routes them to delivery channels (email, sms, whatsapp) using RabbitMQ, and a delivery service that consumes queues to mark deliveries. Logs are sent to Elasticsearch.

**Architecture Overview**
- **Components:**
  - `task-router` (GraphQL service): validates and persists messages, then publishes delivery jobs to RabbitMQ queues. Runs on `http://localhost:3001` by default.
  - `delivery-service` (HTTP consumer): consumes channel-specific RabbitMQ queues and persists final delivery records. Exposes an HTTP endpoint for direct delivery fallback. Runs on `http://localhost:3002` by default.
  - `rabbitmq`: message broker used for asynchronous decoupled delivery.
  - `elasticsearch`: used by the provided `Logger` to index logs.
- **Storage:** Both services use lightweight local SQLite DBs to store messages/deliveries.
- **Observability:** The `Logger` class indexes logs to Elasticsearch (index `app-logs` by default). It also prints to console.

**Communication Method & Reasoning**
- **Primary:** RabbitMQ queues (asynchronous pub/sub with durable queues).
  - Reason: Decouples the task-router from delivery processing, enables retries, persistence, and scale-out of consumers.
- **Requirement:** RabbitMQ must be running. If unavailable, message delivery will fail.
  - Reason: Ensures reliability and prevents message loss through durable queue persistence.
- **Tracing:** Services generate `traceId` and `subTraceId` for correlating logs across services.

**Services & Endpoints**
- **task-router**
  - Port: `3001` (default)
  - GraphQL Endpoint: `POST http://localhost:3001/graphql`
  - Key GraphQL operations:
    - Query `hello` — health check.
    - Query `message(id: ID!)` — fetch a single message by id.
    - Query `messages(limit: Int)` — fetch recent messages.
    - Mutation `sendMessage(input: SendMessageInput!)` — send a message.
- **delivery-service**
  - Port: `3002` (default)
  - Health: `GET http://localhost:3002/`
  - Direct delivery (fallback): `POST http://localhost:3002/deliver/:channel` — `:channel` is one of `email`, `sms`, `whatsapp`.
  - Body for delivery POST:
    - JSON: `{ "recipient": "...", "message": "...", "metadata": { ... }, "traceId": "optional" }`

**Environment Variables**
- Common:
  - `RABBITMQ_URL` — e.g. `amqp://user:password@rabbitmq:5672`
  - `ELASTICSEARCH_NODE` — e.g. `http://elasticsearch:9200`
- `task-router`:
  - `PORT` (optional, defaults 3001)
  - `RABBITMQ_URL`
  - `LASTICSEARCH_NODE` (note: docker-compose uses this var name but code expects constructor param or default)
  - `delivery_service_url` (code default: `http://localhost:3002`) — to use HTTP fallback, set `delivery_service_url`.
- `delivery-service`:
  - `PORT` (optional, defaults 3002)
  - `RABBITMQ_URL`
  - `ELASTICSEARCH_NODE`

**How To Start**
- Prereqs:
  - Node.js (v18+ recommended)
  - Docker & Docker Compose (for full stack)
  - On Windows PowerShell, run commands shown below.

Start everything with Docker Compose - 
*docker compose up --build*