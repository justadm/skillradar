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
    CREATE TABLE IF NOT EXISTS b2b_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, day)
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT,
      email TEXT NOT NULL,
      message TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      action TEXT NOT NULL,
      target TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)    .run(
      id,
      orgId,
      payload.type || 'market',
      payload.role,
      payload.level || null,
      payload.city || null,
      payload.schedule || null,
      payload.employment || null,
      payload.salary_min || null,
      payload.salary_max || null,
      payload.currency || 'RUR',
      payload.stats ? JSON.stringify(payload.stats) : null,
      payload.status || 'processing',
      now,
      now
    );
  return getReport(orgId, id);
}

function getReport(orgId, id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reports WHERE id = ? AND org_id = ?').get(id, orgId);
  if (!row) return null;
  return { ...row, stats: row.stats_json ? JSON.parse(row.stats_json) : null };
}

function deleteReport(orgId, id) {
  const db = getDb();
  db.prepare('DELETE FROM reports WHERE id = ? AND org_id = ?').run(id, orgId);
  return true;
}

function listRoleProfiles(orgId) {
  const db = getDb();
  return db.prepare('SELECT * FROM role_profiles WHERE org_id = ? ORDER BY updated_at DESC').all(orgId)
    .map(row => ({ ...row, skills: row.skills_json ? JSON.parse(row.skills_json) : [] }));
}

function createRoleProfile(orgId, payload, createdBy) {
  const db = getDb();
  const id = `role_${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO role_profiles
    (id, org_id, name, role, level, city, skills_json, schedule, employment, salary_min, salary_max, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)    .run(
      id,
      orgId,
      payload.name || payload.role,
      payload.role,
      payload.level || null,
      payload.city || null,
      payload.skills ? JSON.stringify(payload.skills) : JSON.stringify([]),
      payload.schedule || null,
      payload.employment || null,
      payload.salary_min || null,
      payload.salary_max || null,
      createdBy || null,
      now,
      now
    );
  return db.prepare('SELECT * FROM role_profiles WHERE id = ?').get(id);
}

function deleteRoleProfile(orgId, id) {
  const db = getDb();
  db.prepare('DELETE FROM role_profiles WHERE id = ? AND org_id = ?').run(id, orgId);
  return true;
}

function listTeam(orgId) {
  const db = getDb();
  return db.prepare('SELECT * FROM web_users WHERE org_id = ? AND status != ? ORDER BY created_at ASC')
    .all(orgId, 'deleted');
}

function inviteTeamMember(orgId, email, role = 'analyst') {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM web_users WHERE email = ?').get(email.toLowerCase());
  if (existing) return existing;
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email.toLowerCase(), email.split('@')[0], role, orgId, 'invited', new Date().toISOString());
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);
}

function updateTeamRole(orgId, userId, role) {
  const db = getDb();
  db.prepare('UPDATE web_users SET role = ? WHERE id = ? AND org_id = ?').run(role, userId, orgId);
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(userId);
}

function deleteTeamMember(orgId, userId) {
  const db = getDb();
  db.prepare('UPDATE web_users SET status = ? WHERE id = ? AND org_id = ?').run('deleted', userId, orgId);
  return true;
}

function getB2BUsage(userId, dayKey) {
  const db = getDb();
  const row = db.prepare('SELECT count FROM b2b_usage WHERE user_id = ? AND day = ?').get(userId, dayKey);
  return row?.count || 0;
}

function incrementB2BUsage(userId, dayKey) {
  const db = getDb();
  const existing = db.prepare('SELECT count FROM b2b_usage WHERE user_id = ? AND day = ?').get(userId, dayKey);
  if (!existing) {
    db.prepare('INSERT INTO b2b_usage (user_id, day, count) VALUES (?, ?, ?)').run(userId, dayKey, 1);
    return 1;
  }
  const next = existing.count + 1;
  db.prepare('UPDATE b2b_usage SET count = ? WHERE user_id = ? AND day = ?').run(next, userId, dayKey);
  return next;
}

function createLead(payload) {
  const db = getDb();
  const company = payload.company || '';
  const email = String(payload.email || '').trim().toLowerCase();
  const message = payload.message || '';
  const source = payload.source || 'unknown';
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO leads (company, email, message, source, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(company, email, message, source, createdAt);
  return { email, source, created_at: createdAt };
}

function listLeads(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT id, company, email, message, source, created_at FROM leads ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

function addAuditLog(actorId, action, target, payload) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO audit_logs (actor_id, action, target, payload_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(actorId || null, action, target || null, payload ? JSON.stringify(payload) : null, createdAt);
  return true;
}

function listAuditLogs(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT id, actor_id, action, target, payload_json, created_at FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset)
    .map(row => ({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null }));
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
  deleteReport,
  listRoleProfiles,
  createRoleProfile,
  deleteRoleProfile,
  listTeam,
  inviteTeamMember,
  updateTeamRole,
  deleteTeamMember,
  getB2BUsage,
  incrementB2BUsage,
  createLead,
  listLeads,
  addAuditLog,
  listAuditLogs
};
