const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/db.sqlite');

let db;

function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id TEXT UNIQUE NOT NULL,
      region TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stoplist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      UNIQUE(user_id, word)
    );
    CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vacancies_cache (
      vacancy_id TEXT PRIMARY KEY,
      raw_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_cache (
      query_key TEXT PRIMARY KEY,
      stats_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);
}

function getDb() {
  if (!db) initDb();
  return db;
}

function getOrCreateUser(tgId, region = 'RU') {
  const now = new Date().toISOString();
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(String(tgId));
  if (existing) return existing;
  const res = db.prepare('INSERT INTO users (tg_id, region, created_at) VALUES (?, ?, ?)').run(String(tgId), region, now);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
}

function addStopWord(userId, word) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO stoplist (user_id, word) VALUES (?, ?)').run(userId, word);
}

function removeStopWord(userId, word) {
  const db = getDb();
  db.prepare('DELETE FROM stoplist WHERE user_id = ? AND word = ?').run(userId, word);
}

function listStopWords(userId) {
  const db = getDb();
  return db.prepare('SELECT word FROM stoplist WHERE user_id = ? ORDER BY word ASC').all(userId).map(r => r.word);
}

function saveQuery(userId, type, rawText, filters) {
  const db = getDb();
  db.prepare('INSERT INTO queries (user_id, type, raw_text, filters_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, rawText, JSON.stringify(filters), new Date().toISOString());
}

module.exports = {
  initDb,
  getDb,
  getOrCreateUser,
  addStopWord,
  removeStopWord,
  listStopWords,
  saveQuery
};
