const path = require('path');
const fs = require('fs');
const express = require('express');
const {
  createAuthToken,
  consumeAuthToken,
  createSession,
  createOrGetWebUser,
  getSessionUser
} = require('../db');

const WEB_PORT = process.env.WEB_PORT || 3000;
const API_BASE = '/api/v1';
const DATA_DIR = path.join(__dirname, '../../web/data');
const STATIC_DIR = path.join(__dirname, '../../web');

function readMock(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  const user = getSessionUser(token);
  if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  req.user = user;
  next();
}

function startWebServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(STATIC_DIR));

  app.post(`${API_BASE}/auth/login`, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email', details: { field: 'email' } } });
    }
    const { token, expiresAt } = createAuthToken(email);
    const debug = process.env.NODE_ENV !== 'production';
    res.json({ status: 'sent', ...(debug ? { debug_token: token, expires_at: expiresAt } : {}) });
  });

  app.post(`${API_BASE}/auth/verify`, (req, res) => {
    const token = String(req.body?.token || '').trim();
    const payload = consumeAuthToken(token);
    if (!payload) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid' } });
    }
    const user = createOrGetWebUser(payload.email);
    const session = createSession(user.id);
    res.json({ token: session.token, user });
  });

  app.get(`${API_BASE}/me`, requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get(`${API_BASE}/reports`, requireAuth, (req, res) => {
    const data = readMock('reports');
    res.json({ items: data.items, total: data.items.length });
  });

  app.post(`${API_BASE}/reports`, requireAuth, (req, res) => {
    const id = `rep_${Date.now()}`;
    res.json({ id, status: 'processing' });
  });

  app.get(`${API_BASE}/reports/:id`, requireAuth, (req, res) => {
    const data = readMock('dashboard');
    res.json({
      id: req.params.id,
      type: 'market',
      role: 'Backend Node.js',
      city: 'Москва',
      status: 'ready',
      stats: data.stats
    });
  });

  app.get(`${API_BASE}/reports/:id/export`, requireAuth, (req, res) => {
    res.json({ status: 'todo', message: 'Export will be implemented later.' });
  });

  app.get(`${API_BASE}/roles`, requireAuth, (req, res) => {
    res.json(readMock('roles'));
  });

  app.post(`${API_BASE}/roles`, requireAuth, (req, res) => {
    res.json({ id: `role_${Date.now()}`, ...req.body });
  });

  app.delete(`${API_BASE}/roles/:id`, requireAuth, (req, res) => {
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/competitors`, requireAuth, (req, res) => {
    res.json(readMock('competitors'));
  });

  app.post(`${API_BASE}/template`, requireAuth, (req, res) => {
    res.json(readMock('template'));
  });

  app.get(`${API_BASE}/team`, requireAuth, (req, res) => {
    res.json(readMock('team'));
  });

  app.post(`${API_BASE}/team/invite`, requireAuth, (req, res) => {
    res.json({ status: 'invited', ...req.body });
  });

  app.patch(`${API_BASE}/team/:id`, requireAuth, (req, res) => {
    res.json({ status: 'updated', id: req.params.id, ...req.body });
  });

  app.delete(`${API_BASE}/team/:id`, requireAuth, (req, res) => {
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/billing/plan`, requireAuth, (req, res) => {
    res.json(readMock('billing'));
  });

  app.post(`${API_BASE}/billing/checkout`, requireAuth, (req, res) => {
    res.json({ url: 'https://example.com/checkout' });
  });

  app.post(`${API_BASE}/billing/webhook`, (req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(WEB_PORT, () => {
    console.log(`[web] listening on http://localhost:${WEB_PORT}`);
  });
}

module.exports = { startWebServer };
