const { randomUUID } = require('crypto');

const STORE = new Map();

function nowMs() {
  return Date.now();
}

function cleanup() {
  const now = nowMs();
  for (const [requestId, row] of STORE.entries()) {
    if (row.expiresAt <= now) {
      STORE.delete(requestId);
    }
  }
}

function createWebLoginRequest(channel, ttlSeconds = 180, context = {}) {
  cleanup();
  const requestId = randomUUID().replace(/-/g, '');
  const expiresIn = Math.max(30, Number(ttlSeconds || 180));
  STORE.set(requestId, {
    channel: String(channel || '').toLowerCase(),
    createdAt: nowMs(),
    expiresAt: nowMs() + expiresIn * 1000,
    completed: false,
    profile: null,
    context: { ...(context || {}) }
  });
  return { requestId, expiresIn };
}

function completeWebLoginRequest(channel, requestId, profile) {
  cleanup();
  const row = STORE.get(String(requestId || ''));
  if (!row) return false;
  if (row.channel !== String(channel || '').toLowerCase()) return false;
  if (row.expiresAt <= nowMs()) return false;
  row.completed = true;
  row.profile = { ...(profile || {}) };
  STORE.set(String(requestId || ''), row);
  return true;
}

function getWebLoginRequestStatus(channel, requestId) {
  cleanup();
  const row = STORE.get(String(requestId || ''));
  if (!row || row.channel !== String(channel || '').toLowerCase()) {
    return { status: 'expired' };
  }
  if (row.completed && row.profile) {
    return {
      status: 'authorized',
      profile: { ...row.profile },
      context: { ...(row.context || {}) }
    };
  }
  return {
    status: 'pending',
    expiresIn: Math.max(0, Math.floor((row.expiresAt - nowMs()) / 1000)),
    context: { ...(row.context || {}) }
  };
}

function consumeWebLoginRequest(channel, requestId) {
  const row = STORE.get(String(requestId || ''));
  if (!row) return;
  if (row.channel !== String(channel || '').toLowerCase()) return;
  STORE.delete(String(requestId || ''));
}

module.exports = {
  createWebLoginRequest,
  completeWebLoginRequest,
  getWebLoginRequestStatus,
  consumeWebLoginRequest
};
