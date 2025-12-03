import Database from 'better-sqlite3';
import { fileURLToPath } from "url";
import path from "path";
import fs from 'fs';

let db;

export function initDatabase() {
    const dbPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../data/messages.sqlite"
    );
  
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_content_hash ON messages(content_hash);
    CREATE INDEX IF NOT EXISTS idx_status ON messages(status);
    CREATE INDEX IF NOT EXISTS idx_channel ON messages(channel);
  `);
  
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

