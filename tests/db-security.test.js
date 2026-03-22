const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function loadDbModule(tmpFile, bootstrapEmail = '') {
  process.env.DB_PATH = tmpFile;
  process.env.BOOTSTRAP_OWNER_EMAIL = bootstrapEmail;
  const modPath = require.resolve('../src/db');
  delete require.cache[modPath];
  let db;
  try {
    db = require('../src/db');
  } catch (err) {
    if (String(err && err.code) === 'ERR_DLOPEN_FAILED') {
      return { unavailable: true, reason: String(err.message || err) };
    }
    throw err;
  }
  try {
    db.initDb();
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (String(err && err.code) === 'ERR_DLOPEN_FAILED' || message.includes('Could not locate the bindings file')) {
      return { unavailable: true, reason: message };
    }
    throw err;
  }
  return db;
}

function makeTmpDbPath(name) {
  return path.join(os.tmpdir(), `gridai-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
}

test('auth token is one-time and expires by consume', (t) => {
  const dbPath = makeTmpDbPath('auth');
  const db = loadDbModule(dbPath);
  if (db.unavailable) return t.skip(db.reason);
  const { token } = db.createAuthToken('user@example.com', 15);
  const first = db.consumeAuthToken(token);
  assert.equal(first.email, 'user@example.com');
  const second = db.consumeAuthToken(token);
  assert.equal(second, null);
  fs.rmSync(dbPath, { force: true });
});

test('team invite is isolated by organization', (t) => {
  const dbPath = makeTmpDbPath('tenant');
  const db = loadDbModule(dbPath, 'owner@org-one.test');
  if (db.unavailable) return t.skip(db.reason);
  const owner = db.createBootstrapOwnerIfAllowed('owner@org-one.test');
  assert.ok(owner);

  const sql = db.getDb();
  const orgTwoId = 'org-two';
  sql.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)').run(orgTwoId, 'Org Two', new Date().toISOString());

  db.inviteTeamMember(owner.org_id, 'member@corp.test', 'analyst');
  assert.throws(
    () => db.inviteTeamMember(orgTwoId, 'member@corp.test', 'viewer'),
    (err) => err && err.code === 'EMAIL_IN_USE_IN_OTHER_ORG'
  );
  fs.rmSync(dbPath, { force: true });
});

test('audit log queries return only current organization data', (t) => {
  const dbPath = makeTmpDbPath('audit');
  const db = loadDbModule(dbPath, 'owner@org.test');
  if (db.unavailable) return t.skip(db.reason);
  const owner = db.createBootstrapOwnerIfAllowed('owner@org.test');
  assert.ok(owner);

  db.addAuditLog(owner.org_id, owner.id, 'report.create', 'rep-1', { role: 'Backend' });
  db.addAuditLog('org-other', 'user-2', 'report.delete', 'rep-2', { role: 'QA' });

  const items = db.listAuditLogsFiltered(owner.org_id, {}, 50, 0);
  const total = db.countAuditLogs(owner.org_id, {});
  assert.equal(total, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].org_id, owner.org_id);
  fs.rmSync(dbPath, { force: true });
});

test('invited user can login only after invitation exists', (t) => {
  const dbPath = makeTmpDbPath('invite');
  const db = loadDbModule(dbPath, 'owner@org.test');
  if (db.unavailable) return t.skip(db.reason);
  const owner = db.createBootstrapOwnerIfAllowed('owner@org.test');
  assert.ok(owner);

  const noInvite = db.getWebUserForLogin('analyst@org.test');
  assert.equal(noInvite, null);

  const invited = db.inviteTeamMember(owner.org_id, 'analyst@org.test', 'analyst');
  assert.equal(invited.status, 'invited');

  const active = db.getWebUserForLogin('analyst@org.test');
  assert.equal(active.email, 'analyst@org.test');
  assert.equal(active.status, 'active');
  fs.rmSync(dbPath, { force: true });
});
