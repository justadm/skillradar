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
    CREATE TABLE IF NOT EXISTS llm_cache (
      cache_key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);

  ensureColumn('users', 'mode', 'TEXT', 'jobseeker');
}

function ensureColumn(table, column, type, defaultValue) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some(c => c.name === column);
  if (!exists) {
    const isNumber = typeof defaultValue === 'number';
    const safe = isNumber ? String(defaultValue) : `'${String(defaultValue).replace(/'/g, "''")}'`;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${safe}`);
  }
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
  const res = db.prepare('INSERT INTO users (tg_id, region, created_at, mode) VALUES (?, ?, ?, ?)').run(String(tgId), region, now, 'jobseeker');
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

function listRecentQueries(limit = 10) {
  const db = getDb();
  return db.prepare('SELECT q.id, q.user_id, q.type, q.raw_text, q.created_at, u.tg_id FROM queries q JOIN users u ON u.id = q.user_id ORDER BY q.id DESC LIMIT ?').all(limit);
}

function setUserMode(userId, mode) {
  const db = getDb();
  db.prepare('UPDATE users SET mode = ? WHERE id = ?').run(mode, userId);
}

function getUserMode(userId) {
  const db = getDb();
  const row = db.prepare('SELECT mode FROM users WHERE id = ?').get(userId);
  return row?.mode || 'jobseeker';
}

function getVacancyCache(vacancyId) {
  const db = getDb();
  return db.prepare('SELECT raw_json, fetched_at FROM vacancies_cache WHERE vacancy_id = ?').get(vacancyId);
}

function saveVacancyCache(vacancyId, rawJson) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO vacancies_cache (vacancy_id, raw_json, fetched_at) VALUES (?, ?, ?)')
    .run(String(vacancyId), JSON.stringify(rawJson), new Date().toISOString());
}

function getMarketCache(queryKey) {
  const db = getDb();
  return db.prepare('SELECT stats_json, fetched_at FROM market_cache WHERE query_key = ?').get(queryKey);
}

function saveMarketCache(queryKey, stats) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO market_cache (query_key, stats_json, fetched_at) VALUES (?, ?, ?)')
    .run(String(queryKey), JSON.stringify(stats), new Date().toISOString());
}

function getLlmCache(cacheKey) {
  const db = getDb();
  return db.prepare('SELECT value_json, fetched_at FROM llm_cache WHERE cache_key = ?').get(cacheKey);
}

function saveLlmCache(cacheKey, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO llm_cache (cache_key, value_json, fetched_at) VALUES (?, ?, ?)')
    .run(String(cacheKey), JSON.stringify(value), new Date().toISOString());
}

module.exports = {
  initDb,
  getDb,
  getOrCreateUser,
  addStopWord,
  removeStopWord,
  listStopWords,
  saveQuery,
  getVacancyCache,
  saveVacancyCache,
  getMarketCache,
  saveMarketCache,
  getLlmCache,
  saveLlmCache,
  listRecentQueries,
  setUserMode,
  getUserMode
};
