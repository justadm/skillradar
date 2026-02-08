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

    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS web_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL,
      org_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      type TEXT NOT NULL,
      role TEXT NOT NULL,
      level TEXT,
      city TEXT,
      schedule TEXT,
      employment TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      currency TEXT,
      stats_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_profiles (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      level TEXT,
      city TEXT,
      skills_json TEXT,
      schedule TEXT,
      employment TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

function createAuthToken(email, ttlMinutes = 15) {
  const db = getDb();
  const token = require('crypto').randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  db.prepare('INSERT INTO auth_tokens (token, email, expires_at) VALUES (?, ?, ?)')
    .run(token, email.toLowerCase(), expiresAt);
  return { token, expiresAt };
}

function consumeAuthToken(token) {
  const db = getDb();
  const row = db.prepare('SELECT token, email, expires_at, used_at FROM auth_tokens WHERE token = ?').get(token);
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token = ?').run(new Date().toISOString(), token);
  return { email: row.email };
}

function ensureDefaultOrg() {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1').get();
  if (existing) return existing.id;
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)')
    .run(id, process.env.DEFAULT_ORG_NAME || 'SkillRadar Demo', new Date().toISOString());
  return id;
}

function createOrGetWebUser(email) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM web_users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    if (existing.status !== 'active') {
      db.prepare('UPDATE web_users SET status = ? WHERE id = ?').run('active', existing.id);
    }
    return db.prepare('SELECT * FROM web_users WHERE id = ?').get(existing.id);
  }
  const orgId = ensureDefaultOrg();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM web_users').get().cnt;
  const role = count === 0 ? 'owner' : 'analyst';
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase(), email.split('@')[0], role, orgId, 'active', new Date().toISOString());
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);
}

function createSession(userId, ttlDays = 30) {
  const db = getDb();
  const token = require('crypto').randomUUID();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, expiresAt, new Date().toISOString());
  return { token, expiresAt };
}

function getSessionUser(token) {
  const db = getDb();
  const session = db.prepare('SELECT token, user_id, expires_at FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(session.user_id);
}

function getWebUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(userId);
}

function listReports(orgId, limit = 20, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT * FROM reports WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(orgId, limit, offset)
    .map(row => ({ ...row, stats: row.stats_json ? JSON.parse(row.stats_json) : null }));
}

function createReport(orgId, payload) {
  const db = getDb();
  const id = `rep_${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO reports
    (id, org_id, type, role, level, city, schedule, employment, salary_min, salary_max, currency, stats_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)\n    .run(\n      id,\n      orgId,\n      payload.type || 'market',\n      payload.role,\n      payload.level || null,\n      payload.city || null,\n      payload.schedule || null,\n      payload.employment || null,\n      payload.salary_min || null,\n      payload.salary_max || null,\n      payload.currency || 'RUR',\n      payload.stats ? JSON.stringify(payload.stats) : null,\n      payload.status || 'processing',\n      now,\n      now\n    );\n  return getReport(orgId, id);\n}\n\nfunction getReport(orgId, id) {\n  const db = getDb();\n  const row = db.prepare('SELECT * FROM reports WHERE id = ? AND org_id = ?').get(id, orgId);\n  if (!row) return null;\n  return { ...row, stats: row.stats_json ? JSON.parse(row.stats_json) : null };\n}\n\nfunction listRoleProfiles(orgId) {\n  const db = getDb();\n  return db.prepare('SELECT * FROM role_profiles WHERE org_id = ? ORDER BY updated_at DESC').all(orgId)\n    .map(row => ({ ...row, skills: row.skills_json ? JSON.parse(row.skills_json) : [] }));\n}\n\nfunction createRoleProfile(orgId, payload, createdBy) {\n  const db = getDb();\n  const id = `role_${Date.now()}`;\n  const now = new Date().toISOString();\n  db.prepare(`INSERT INTO role_profiles\n    (id, org_id, name, role, level, city, skills_json, schedule, employment, salary_min, salary_max, created_by, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)\n    .run(\n      id,\n      orgId,\n      payload.name || payload.role,\n      payload.role,\n      payload.level || null,\n      payload.city || null,\n      payload.skills ? JSON.stringify(payload.skills) : JSON.stringify([]),\n      payload.schedule || null,\n      payload.employment || null,\n      payload.salary_min || null,\n      payload.salary_max || null,\n      createdBy || null,\n      now,\n      now\n    );\n  return db.prepare('SELECT * FROM role_profiles WHERE id = ?').get(id);\n}\n\nfunction deleteRoleProfile(orgId, id) {\n  const db = getDb();\n  db.prepare('DELETE FROM role_profiles WHERE id = ? AND org_id = ?').run(id, orgId);\n  return true;\n}\n\nfunction listTeam(orgId) {\n  const db = getDb();\n  return db.prepare('SELECT * FROM web_users WHERE org_id = ? AND status != ? ORDER BY created_at ASC')\n    .all(orgId, 'deleted');\n}\n\nfunction inviteTeamMember(orgId, email, role = 'analyst') {\n  const db = getDb();\n  const existing = db.prepare('SELECT * FROM web_users WHERE email = ?').get(email.toLowerCase());\n  if (existing) return existing;\n  const id = require('crypto').randomUUID();\n  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')\n    .run(id, email.toLowerCase(), email.split('@')[0], role, orgId, 'invited', new Date().toISOString());\n  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);\n}\n\nfunction updateTeamRole(orgId, userId, role) {\n  const db = getDb();\n  db.prepare('UPDATE web_users SET role = ? WHERE id = ? AND org_id = ?').run(role, userId, orgId);\n  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(userId);\n}\n\nfunction deleteTeamMember(orgId, userId) {\n  const db = getDb();\n  db.prepare('UPDATE web_users SET status = ? WHERE id = ? AND org_id = ?').run('deleted', userId, orgId);\n  return true;\n}\n*** End Patch"}}

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
  getUserMode,
  createAuthToken,
  consumeAuthToken,
  createSession,
  getSessionUser,
  createOrGetWebUser,
  getWebUserById,
  listReports,
  createReport,
  getReport,
  listRoleProfiles,
  createRoleProfile,
  deleteRoleProfile,
  listTeam,
  inviteTeamMember,
  updateTeamRole,
  deleteTeamMember
};
