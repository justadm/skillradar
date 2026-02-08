const path = require('path');
const fs = require('fs');
const express = require('express');
const {
  createAuthToken,
  consumeAuthToken,
  createSession,
  createOrGetWebUser,
  getSessionUser,
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

  app.get(`${API_BASE}/dashboard`, requireAuth, (req, res) => {
    const reports = listReports(req.user.org_id, 3, 0);
    const data = readMock('dashboard');
    res.json({
      stats: data.stats,
      reports: reports.length
        ? reports.map(item => ({
          role: item.role,
          region: item.city || 'Москва',
          date: item.created_at.slice(0, 10),
          status: item.status === 'processing' ? 'В работе' : 'Готов'
        }))
        : data.reports,
      activity: data.activity
    });
  });

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
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    const items = listReports(req.user.org_id, limit, offset);
    if (!items.length) {
      const data = readMock('reports');
      return res.json({ items: data.items, total: data.items.length });
    }
    res.json({
      items: items.map(item => ({
        role: item.role,
        region: item.city || 'Москва',
        type: item.type === 'competitors' ? 'Конкуренты' : item.type === 'template' ? 'Шаблон вакансии' : 'Рынок роли',
        date: item.created_at.slice(0, 10),
        status: item.status === 'processing' ? 'В работе' : 'Готов'
      })),
      total: items.length
    });
  });

  app.post(`${API_BASE}/reports`, requireAuth, (req, res) => {
    if (!req.body?.role) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Role is required', details: { field: 'role' } } });
    }
    const report = createReport(req.user.org_id, req.body);
    res.json({ id: report.id, status: report.status });
  });

  app.get(`${API_BASE}/reports/:id`, requireAuth, (req, res) => {
    const report = getReport(req.user.org_id, req.params.id);
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    res.json(report);
  });

  app.get(`${API_BASE}/reports/:id/export`, requireAuth, (req, res) => {
    res.json({ status: 'todo', message: 'Export will be implemented later.' });
  });

  app.get(`${API_BASE}/roles`, requireAuth, (req, res) => {
    const items = listRoleProfiles(req.user.org_id);
    if (!items.length) return res.json(readMock('roles'));
    res.json({ items: items.map(item => ({
      title: item.role,
      region: item.city || 'Москва',
      level: item.level || 'Middle',
      skills: (item.skills || []).join(', ')
    }))});
  });

  app.post(`${API_BASE}/roles`, requireAuth, (req, res) => {
    if (!req.body?.role) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Role is required', details: { field: 'role' } } });
    }
    const role = createRoleProfile(req.user.org_id, req.body, req.user.id);
    res.json(role);
  });

  app.delete(`${API_BASE}/roles/:id`, requireAuth, (req, res) => {
    deleteRoleProfile(req.user.org_id, req.params.id);
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/competitors`, requireAuth, (req, res) => {
    res.json(readMock('competitors'));
  });

  app.post(`${API_BASE}/template`, requireAuth, (req, res) => {
    res.json(readMock('template'));
  });

  app.get(`${API_BASE}/team`, requireAuth, (req, res) => {
    const items = listTeam(req.user.org_id);
    res.json({ members: items.map(user => ({
      name: user.name || user.email,
      role: user.role,
      access: user.status === 'invited' ? 'Invitation pending' : 'Active'
    }))});
  });

  app.post(`${API_BASE}/team/invite`, requireAuth, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role || 'analyst';
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email', details: { field: 'email' } } });
    }
    const user = inviteTeamMember(req.user.org_id, email, role);
    res.json({ status: 'invited', user });
  });

  app.patch(`${API_BASE}/team/:id`, requireAuth, (req, res) => {
    const role = req.body?.role;
    const user = updateTeamRole(req.user.org_id, req.params.id, role);
    res.json({ status: 'updated', user });
  });

  app.delete(`${API_BASE}/team/:id`, requireAuth, (req, res) => {
    deleteTeamMember(req.user.org_id, req.params.id);
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/billing/plan`, requireAuth, (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/billing`, requireAuth, (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/settings`, requireAuth, (req, res) => {
    res.json(readMock('settings'));
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
