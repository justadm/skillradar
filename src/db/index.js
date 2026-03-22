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
      status TEXT DEFAULT 'new',
      note TEXT,
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
    CREATE TABLE IF NOT EXISTS hh_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      refresh_token TEXT,
      token_type TEXT,
      expires_at TEXT,
      scope TEXT,
      obtained_at TEXT,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS job_digest_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tg_id TEXT NOT NULL,
      bot_key TEXT NOT NULL DEFAULT 'jobs',
      raw_query TEXT NOT NULL,
      criteria_json TEXT,
      cadence TEXT NOT NULL DEFAULT 'daily',
      timezone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_success_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, raw_query, cadence)
    );
    CREATE TABLE IF NOT EXISTS job_digest_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      vacancy_id TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      UNIQUE(subscription_id, vacancy_id)
    );
    CREATE TABLE IF NOT EXISTS bot_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bot_key TEXT NOT NULL,
      consented_at TEXT NOT NULL,
      UNIQUE(user_id, bot_key)
    );
    CREATE TABLE IF NOT EXISTS social_auth_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      email TEXT,
      profile_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, external_user_id),
      UNIQUE(user_id, provider)
    );
  `);

  ensureColumn('users', 'mode', 'TEXT', 'jobseeker');
  ensureColumn('users', 'consented_at', 'TEXT', '');
  ensureColumn('audit_logs', 'org_id', 'TEXT', '');
  ensureColumn('job_digest_subscriptions', 'bot_key', 'TEXT', 'jobs');
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

function hasUserConsent(userId, botKey = 'combined') {
  const db = getDb();
  const row = db.prepare('SELECT consented_at FROM bot_consents WHERE user_id = ? AND bot_key = ?').get(userId, String(botKey || 'combined'));
  return Boolean(row?.consented_at);
}

function markUserConsent(userId, botKey = 'combined', consentedAt = new Date().toISOString()) {
  const db = getDb();
  db.prepare(`
    INSERT INTO bot_consents (user_id, bot_key, consented_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, bot_key) DO UPDATE SET
      consented_at = excluded.consented_at
  `).run(userId, String(botKey || 'combined'), consentedAt);
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
    .run(id, process.env.DEFAULT_ORG_NAME || `${process.env.BRAND_NAME || 'GridAI'} Demo`, new Date().toISOString());
  return id;
}

function getWebUserForLogin(email) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM web_users WHERE email = ?').get(email.toLowerCase());
  if (!existing) return null;
  if (existing.status === 'deleted') return null;
  if (existing.status === 'invited') {
    db.prepare('UPDATE web_users SET status = ? WHERE id = ?').run('active', existing.id);
  }
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(existing.id);
}

function createBootstrapOwnerIfAllowed(email) {
  const bootstrapEmail = String(process.env.BOOTSTRAP_OWNER_EMAIL || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!bootstrapEmail || normalizedEmail !== bootstrapEmail) return null;
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM web_users').get().cnt;
  if (count > 0) return null;
  const orgId = ensureDefaultOrg();
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, normalizedEmail, normalizedEmail.split('@')[0], 'owner', orgId, 'active', new Date().toISOString());
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

function deleteSession(token) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token || ''));
  return true;
}

function getWebUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(userId);
}

function getSocialAuthAccount(provider, externalUserId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM social_auth_accounts
    WHERE provider = ? AND external_user_id = ?
  `).get(String(provider || '').toLowerCase(), String(externalUserId || ''));
}

function getWebUserBySocialAccount(provider, externalUserId) {
  const db = getDb();
  const account = getSocialAuthAccount(provider, externalUserId);
  if (!account) return null;
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(account.user_id);
}

function upsertSocialAuthAccount(userId, provider, externalUserId, payload = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO social_auth_accounts (
      user_id, provider, external_user_id, email, profile_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, external_user_id) DO UPDATE SET
      user_id = excluded.user_id,
      email = excluded.email,
      profile_json = excluded.profile_json,
      updated_at = excluded.updated_at
  `).run(
    String(userId || ''),
    String(provider || '').toLowerCase(),
    String(externalUserId || ''),
    payload.email ? String(payload.email).toLowerCase() : null,
    JSON.stringify(payload.profile || {}),
    now,
    now
  );
  return getSocialAuthAccount(provider, externalUserId);
}

function canAutoCreateSocialUser(provider) {
  const raw = String(process.env.SOCIAL_AUTH_AUTO_CREATE_PROVIDERS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  return raw.includes(String(provider || '').toLowerCase());
}

function createSocialAuthUser(provider, externalUserId, payload = {}) {
  const normalizedProvider = String(provider || '').toLowerCase();
  if (!canAutoCreateSocialUser(normalizedProvider)) return null;
  const db = getDb();
  const orgId = ensureDefaultOrg();
  const id = require('crypto').randomUUID();
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const syntheticEmail = `${normalizedProvider}+${String(externalUserId || '').replace(/[^a-zA-Z0-9._-]/g, '_')}@auth.gridai.local`;
  const email = normalizedEmail || syntheticEmail;
  const name = String(
    payload.name
    || payload.username
    || normalizedEmail
    || `${normalizedProvider}:${externalUserId}`
  ).trim().slice(0, 120);
  const role = String(payload.role || 'viewer').trim().toLowerCase() || 'viewer';
  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, name || email, role, orgId, 'active', new Date().toISOString());
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);
}

function elevateWebUserRole(userId, role) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM web_users WHERE id = ?').get(String(userId || ''));
  if (!user) return null;
  const rank = { viewer: 0, analyst: 1, admin: 2, owner: 3 };
  const current = rank[String(user.role || 'viewer').toLowerCase()] ?? 0;
  const targetRole = String(role || '').trim().toLowerCase();
  const target = rank[targetRole] ?? current;
  if (target <= current) return user;
  db.prepare('UPDATE web_users SET role = ? WHERE id = ?').run(targetRole, user.id);
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(user.id);
}

function listReports(orgId, limit = 20, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT * FROM reports WHERE org_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(orgId, limit, offset)
    .map(row => ({ ...row, stats: row.stats_json ? JSON.parse(row.stats_json) : null }));
}

function listReportsFiltered(orgId, filters = {}, limit = 20, offset = 0) {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params = [orgId];

  if (filters.role) {
    clauses.push('role LIKE ?');
    params.push(`%${filters.role}%`);
  }
  if (filters.city) {
    clauses.push('city LIKE ?');
    params.push(`%${filters.city}%`);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return rows.map(row => ({ ...row, stats: row.stats_json ? JSON.parse(row.stats_json) : null }));
}

function countReports(orgId, filters = {}) {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params = [orgId];
  if (filters.role) {
    clauses.push('role LIKE ?');
    params.push(`%${filters.role}%`);
  }
  if (filters.city) {
    clauses.push('city LIKE ?');
    params.push(`%${filters.city}%`);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM reports ${where}`).get(...params).cnt;
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

function listTeamFiltered(orgId, filters = {}, limit = 50, offset = 0) {
  const db = getDb();
  const clauses = ['org_id = ?', "status != 'deleted'"];
  const params = [orgId];

  if (filters.query) {
    clauses.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.role) {
    clauses.push('role = ?');
    params.push(filters.role);
  }
  if (filters.status) {
    if (filters.status === 'invited') {
      clauses.push('status = ?');
      params.push('invited');
    }
    if (filters.status === 'active') {
      clauses.push("status != 'invited'");
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM web_users ${where} ORDER BY created_at ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
}

function countTeam(orgId, filters = {}) {
  const db = getDb();
  const clauses = ['org_id = ?', "status != 'deleted'"];
  const params = [orgId];
  if (filters.query) {
    clauses.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.role) {
    clauses.push('role = ?');
    params.push(filters.role);
  }
  if (filters.status) {
    if (filters.status === 'invited') {
      clauses.push('status = ?');
      params.push('invited');
    }
    if (filters.status === 'active') {
      clauses.push("status != 'invited'");
    }
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM web_users ${where}`).get(...params).cnt;
}

function inviteTeamMember(orgId, email, role = 'analyst') {
  const db = getDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existingInOrg = db.prepare('SELECT * FROM web_users WHERE email = ? AND org_id = ?').get(normalizedEmail, orgId);
  if (existingInOrg) {
    if (existingInOrg.status === 'deleted') {
      db.prepare('UPDATE web_users SET status = ?, role = ? WHERE id = ? AND org_id = ?')
        .run('invited', role, existingInOrg.id, orgId);
      return db.prepare('SELECT * FROM web_users WHERE id = ? AND org_id = ?').get(existingInOrg.id, orgId);
    }
    return existingInOrg;
  }
  const existingOtherOrg = db.prepare("SELECT * FROM web_users WHERE email = ? AND org_id != ? AND status != 'deleted'")
    .get(normalizedEmail, orgId);
  if (existingOtherOrg) {
    const err = new Error('User with this email already belongs to another organization');
    err.code = 'EMAIL_IN_USE_IN_OTHER_ORG';
    throw err;
  }
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO web_users (id, email, name, role, org_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, normalizedEmail, normalizedEmail.split('@')[0], role, orgId, 'invited', new Date().toISOString());
  return db.prepare('SELECT * FROM web_users WHERE id = ?').get(id);
}

function updateTeamRole(orgId, userId, role) {
  const db = getDb();
  db.prepare('UPDATE web_users SET role = ? WHERE id = ? AND org_id = ?').run(role, userId, orgId);
  return db.prepare('SELECT * FROM web_users WHERE id = ? AND org_id = ?').get(userId, orgId);
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
  const status = payload.status || 'new';
  const note = payload.note || '';
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO leads (company, email, message, source, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(company, email, message, source, status, note, createdAt);
  return { email, source, status, note, created_at: createdAt };
}

function listLeads(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT id, company, email, message, source, status, note, created_at FROM leads ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

function listLeadsFiltered(filters = {}, limit = 50, offset = 0) {
  const db = getDb();
  const clauses = ['1=1'];
  const params = [];
  if (filters.query) {
    clauses.push('(company LIKE ? OR email LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT id, company, email, message, source, status, note, created_at FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
}

function countLeads(filters = {}) {
  const db = getDb();
  const clauses = ['1=1'];
  const params = [];
  if (filters.query) {
    clauses.push('(company LIKE ? OR email LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM leads ${where}`).get(...params).cnt;
}

function updateLead(id, payload) {
  const db = getDb();
  const status = payload.status;
  const note = payload.note;
  db.prepare('UPDATE leads SET status = COALESCE(?, status), note = COALESCE(?, note) WHERE id = ?')
    .run(status ?? null, note ?? null, id);
  return db.prepare('SELECT id, company, email, message, source, status, note, created_at FROM leads WHERE id = ?').get(id);
}

function addAuditLog(orgId, actorId, action, target, payload) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO audit_logs (org_id, actor_id, action, target, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orgId || '', actorId || null, action, target || null, payload ? JSON.stringify(payload) : null, createdAt);
  return true;
}

function listAuditLogs(orgId, limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare('SELECT id, org_id, actor_id, action, target, payload_json, created_at FROM audit_logs WHERE org_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(orgId, limit, offset)
    .map(row => ({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null }));
}

function listAuditLogsFiltered(orgId, filters = {}, limit = 50, offset = 0) {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params = [orgId];
  if (filters.query) {
    clauses.push('(actor_id LIKE ? OR action LIKE ? OR target LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.action) {
    clauses.push('action LIKE ?');
    params.push(`%${filters.action}%`);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT id, org_id, actor_id, action, target, payload_json, created_at FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map(row => ({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null }));
}

function countAuditLogs(orgId, filters = {}) {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params = [orgId];
  if (filters.query) {
    clauses.push('(actor_id LIKE ? OR action LIKE ? OR target LIKE ?)');
    params.push(`%${filters.query}%`, `%${filters.query}%`, `%${filters.query}%`);
  }
  if (filters.action) {
    clauses.push('action LIKE ?');
    params.push(`%${filters.action}%`);
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    params.push(filters.from);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs ${where}`).get(...params).cnt;
}

function saveHhToken(payload) {
  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = payload.expires_in
    ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString()
    : payload.expires_at || null;
  db.prepare(`
    INSERT INTO hh_tokens (id, access_token, refresh_token, token_type, expires_at, scope, obtained_at, last_error, last_error_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(id) DO UPDATE SET
      access_token=excluded.access_token,
      refresh_token=excluded.refresh_token,
      token_type=excluded.token_type,
      expires_at=excluded.expires_at,
      scope=excluded.scope,
      obtained_at=excluded.obtained_at,
      last_error=NULL,
      last_error_at=NULL
  `).run(
    payload.access_token || null,
    payload.refresh_token || null,
    payload.token_type || null,
    expiresAt,
    payload.scope || null,
    now
  );
}

function getHhToken() {
  const db = getDb();
  return db.prepare('SELECT * FROM hh_tokens WHERE id = 1').get() || null;
}

function markHhApiSuccess() {
  const db = getDb();
  db.prepare('UPDATE hh_tokens SET last_success_at = ?, last_error = NULL, last_error_at = NULL WHERE id = 1')
    .run(new Date().toISOString());
}

function markHhApiError(errorText) {
  const db = getDb();
  db.prepare('UPDATE hh_tokens SET last_error = ?, last_error_at = ? WHERE id = 1')
    .run(String(errorText || 'Unknown error').slice(0, 512), new Date().toISOString());
}

function upsertJobDigestSubscription(userId, tgId, rawQuery, criteria = null, options = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  const cadence = String(options.cadence || 'daily').trim() || 'daily';
  const timezone = options.timezone ? String(options.timezone).trim() : null;
  const botKey = String(options.botKey || 'jobs').trim() || 'jobs';
  const criteriaJson = criteria ? JSON.stringify(criteria) : null;
  db.prepare(`
    INSERT INTO job_digest_subscriptions
      (user_id, tg_id, bot_key, raw_query, criteria_json, cadence, timezone, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(user_id, raw_query, cadence) DO UPDATE SET
      tg_id=excluded.tg_id,
      bot_key=excluded.bot_key,
      criteria_json=COALESCE(excluded.criteria_json, job_digest_subscriptions.criteria_json),
      timezone=COALESCE(excluded.timezone, job_digest_subscriptions.timezone),
      active=1,
      updated_at=excluded.updated_at
  `).run(userId, String(tgId), botKey, String(rawQuery || '').trim(), criteriaJson, cadence, timezone, now, now);

  return db.prepare(`
    SELECT * FROM job_digest_subscriptions
    WHERE user_id = ? AND raw_query = ? AND cadence = ?
  `).get(userId, String(rawQuery || '').trim(), cadence);
}

function listActiveJobDigestSubscriptions(limit = 100, offset = 0) {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM job_digest_subscriptions
    WHERE active = 1 AND cadence = 'daily'
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function listUserJobDigestSubscriptions(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM job_digest_subscriptions
    WHERE user_id = ?
    ORDER BY active DESC, id ASC
  `).all(userId);
}

function getUserJobDigestSubscriptionById(userId, subscriptionId) {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM job_digest_subscriptions
    WHERE user_id = ? AND id = ?
  `).get(userId, subscriptionId);
}

function updateUserJobDigestSubscription(userId, subscriptionId, patch = {}) {
  const db = getDb();
  const existing = getUserJobDigestSubscriptionById(userId, subscriptionId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const rawQuery = patch.raw_query !== undefined ? String(patch.raw_query || '').trim() : existing.raw_query;
  const criteriaJson = patch.criteria_json !== undefined
    ? (patch.criteria_json ? JSON.stringify(patch.criteria_json) : null)
    : existing.criteria_json;
  const timezone = patch.timezone !== undefined ? (patch.timezone ? String(patch.timezone).trim() : null) : existing.timezone;
  const botKey = patch.bot_key !== undefined ? String(patch.bot_key || 'jobs').trim() || 'jobs' : existing.bot_key;
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active;
  db.prepare(`
    UPDATE job_digest_subscriptions
    SET bot_key = ?,
        raw_query = ?,
        criteria_json = ?,
        timezone = ?,
        active = ?,
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(botKey, rawQuery, criteriaJson, timezone, active, now, subscriptionId, userId);
  return getUserJobDigestSubscriptionById(userId, subscriptionId);
}

function deactivateUserJobDigestSubscription(userId, subscriptionId) {
  return updateUserJobDigestSubscription(userId, subscriptionId, { active: 0 });
}

function listJobDigestDeliveryVacancyIds(subscriptionId) {
  const db = getDb();
  return db.prepare(`
    SELECT vacancy_id
    FROM job_digest_deliveries
    WHERE subscription_id = ?
  `).all(subscriptionId).map(row => String(row.vacancy_id));
}

function saveJobDigestDeliveries(subscriptionId, vacancyIds, sentAt = new Date().toISOString()) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO job_digest_deliveries (subscription_id, vacancy_id, sent_at)
    VALUES (?, ?, ?)
  `);
  const tx = db.transaction((ids) => {
    for (const vacancyId of ids) {
      insert.run(subscriptionId, String(vacancyId), sentAt);
    }
  });
  tx(vacancyIds);
}

function markJobDigestSubscriptionRun(subscriptionId, payload = {}) {
  const db = getDb();
  const now = payload.ranAt || new Date().toISOString();
  const lastSuccessAt = payload.success ? now : payload.lastSuccessAt || null;
  const lastError = payload.success ? null : String(payload.error || '').slice(0, 512) || null;
  db.prepare(`
    UPDATE job_digest_subscriptions
    SET last_run_at = ?,
        last_success_at = COALESCE(?, last_success_at),
        last_error = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, lastSuccessAt, lastError, now, subscriptionId);
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
  hasUserConsent,
  markUserConsent,
  createAuthToken,
  consumeAuthToken,
  createSession,
  deleteSession,
  getSessionUser,
  getWebUserForLogin,
  createBootstrapOwnerIfAllowed,
  getWebUserById,
  getSocialAuthAccount,
  getWebUserBySocialAccount,
  upsertSocialAuthAccount,
  createSocialAuthUser,
  elevateWebUserRole,
  listReports,
  listReportsFiltered,
  countReports,
  createReport,
  getReport,
  deleteReport,
  listRoleProfiles,
  createRoleProfile,
  deleteRoleProfile,
  listTeam,
  listTeamFiltered,
  countTeam,
  inviteTeamMember,
  updateTeamRole,
  deleteTeamMember,
  getB2BUsage,
  incrementB2BUsage,
  createLead,
  listLeads,
  listLeadsFiltered,
  countLeads,
  addAuditLog,
  listAuditLogs,
  listAuditLogsFiltered,
  countAuditLogs,
  updateLead,
  saveHhToken,
  getHhToken,
  markHhApiSuccess,
  markHhApiError,
  upsertJobDigestSubscription,
  listActiveJobDigestSubscriptions,
  listUserJobDigestSubscriptions,
  getUserJobDigestSubscriptionById,
  updateUserJobDigestSubscription,
  deactivateUserJobDigestSubscription,
  listJobDigestDeliveryVacancyIds,
  saveJobDigestDeliveries,
  markJobDigestSubscriptionRun
};
