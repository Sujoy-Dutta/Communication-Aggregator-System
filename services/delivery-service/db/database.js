import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

let db;

export function initDatabase() {
  if (db) return db;

  const dbPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/delivery.sqlite"
  );

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'sent',
      attempts INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_channel ON deliveries(channel);
    CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
  `);

  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export function saveDelivery({
  id,
  channel,
  recipient,
  message,
  metadata = null,
  status = "sent",
  attempts = 1,
}) {
  const db = getDatabase();
  const stmt = db.prepare(
    `INSERT INTO deliveries(id, channel, recipient, message, metadata, status, attempts)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  );

  stmt.run(
    id,
    channel,
    recipient,
    message,
    metadata ? JSON.stringify(metadata) : null,
    status,
    attempts
  );
}


