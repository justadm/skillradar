const path = require('path');
const fs = require('fs');
const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
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
  deleteReport,
  listTeam,
  inviteTeamMember,
  updateTeamRole,
  deleteTeamMember,
  createLead,
  listLeads,
  listLeadsFiltered,
  countLeads,
  updateLead,
  addAuditLog,
  listAuditLogs,
  listAuditLogsFiltered,
  countAuditLogs,
  listTeamFiltered,
  countTeam,
  listReportsFiltered,
  countReports
} = require('../db');

const WEB_PORT = process.env.WEB_PORT || 3000;
const API_BASE = '/api/v1';
const DATA_DIR = path.join(__dirname, '../../web/data');
const STATIC_DIR = path.join(__dirname, '../../web');

function readMock(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildReportPdf(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(18).text(`Отчет: ${report.role}`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Тип: ${report.type}`);
      doc.text(`Город: ${report.city || '—'}`);
      doc.text(`Уровень: ${report.level || '—'}`);
      doc.text(`Дата: ${report.created_at?.slice(0, 10) || '—'}`);
      doc.moveDown();
      doc.text('Краткая сводка:');
      if (report.stats) {
        doc.text(`Вакансий: ${report.stats.total_found || report.stats.vacancies || '—'}`);
        doc.text(`Удаленка: ${report.stats.remote_share || '—'}%`);
        doc.text(`Вилка: ${report.stats.salary_from_avg || '—'}–${report.stats.salary_to_avg || '—'} RUR`);
      } else {
        doc.text('Данные будут доступны после полного расчета.');
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function notifyLead(lead) {
  const tgToken = process.env.LEAD_TG_BOT_TOKEN;
  const tgChat = process.env.LEAD_TG_CHAT_ID;
  const emailTo = process.env.LEAD_EMAIL_TO;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const message = [
    '<b>Новая заявка SkillRadar</b>',
    `Email: <code>${escapeHtml(lead.email)}</code>`,
    lead.company ? `Компания: ${escapeHtml(lead.company)}` : null,
    lead.message ? `Комментарий: ${escapeHtml(lead.message)}` : null,
    `Источник: ${escapeHtml(lead.source)}`
  ].filter(Boolean).join('\n');

  if (tgToken && tgChat) {
    try {
      const buttons = [];
      if (lead.email) {
        buttons.push([{ text: 'Ответить на email', url: `mailto:${lead.email}` }]);
      }
      if (process.env.APP_URL) {
        buttons.push([{ text: 'Открыть ЛК', url: `${process.env.APP_URL.replace(/\/$/, '')}/portal/leads` }]);
      }
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChat,
          text: message,
          parse_mode: 'HTML',
          reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined
        })
      });
    } catch (err) {
      console.error('[leads] telegram notify failed', err);
    }
  }

  const smtpUrl = process.env.SMTP_URL;
  const smtpHost = process.env.SMTP_HOST;
  if (emailTo && (smtpUrl || smtpHost)) {
    try {
      const transport = smtpUrl
        ? nodemailer.createTransport(smtpUrl)
        : nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || 'false') === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined
        });
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'SkillRadar <no-reply@skillradar.ai>',
        to: emailTo,
        subject: 'Новая заявка SkillRadar',
        text: message
      });
    } catch (err) {
      console.error('[leads] email notify failed', err);
    }
  }
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

const roleRank = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

function requireRole(minRole) {
  return (req, res, next) => {
    const current = String(req.user?.role || 'viewer').toLowerCase();
    const currentRank = roleRank[current] ?? 0;
    const minRank = roleRank[minRole] ?? 0;
    if (currentRank < minRank) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
}

function buildApiRouter() {
  const app = express.Router();

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

  app.post(`${API_BASE}/leads`, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email', details: { field: 'email' } } });
    }
    const lead = createLead({
      company: String(req.body?.company || '').trim(),
      email,
      message: String(req.body?.message || '').trim(),
      source: String(req.body?.source || 'web').trim()
    });
    await notifyLead(lead);
    res.json({ status: 'ok', lead });
  });

  app.get(`${API_BASE}/leads`, requireAuth, requireRole('admin'), (req, res) => {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const filters = {
      query: req.query.q ? String(req.query.q) : '',
      status: req.query.status ? String(req.query.status) : '',
      from: req.query.from ? String(req.query.from) : ''
    };
    const items = listLeadsFiltered(filters, limit, offset);
    const total = countLeads(filters);
    if (!items.length && total === 0) {
      const data = readMock('leads');
      const all = Array.isArray(data.items) ? data.items : [];
      const filtered = all.filter(item => {
        const hay = `${item.company || ''} ${item.email || ''}`.toLowerCase();
        const q = String(filters.query || '').toLowerCase();
        const queryOk = !q || hay.includes(q);
        const statusOk = !filters.status || String(item.status || '').toLowerCase() === filters.status;
        const dateOk = !filters.from || String(item.created_at || '') >= filters.from;
        return queryOk && statusOk && dateOk;
      });
      const paged = filtered.slice(offset, offset + limit);
      return res.json({ items: paged, total: filtered.length });
    }
    res.json({ items, total });
  });

  app.patch(`${API_BASE}/leads/:id`, requireAuth, requireRole('admin'), (req, res) => {
    const lead = updateLead(req.params.id, { status: req.body?.status, note: req.body?.note });
    addAuditLog(req.user.id, 'lead.update', String(req.params.id), { status: req.body?.status, note: req.body?.note });
    res.json({ status: 'updated', lead });
  });

  app.get(`${API_BASE}/reports`, requireAuth, (req, res) => {
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    const filters = {
      role: req.query.role ? String(req.query.role) : '',
      city: req.query.city ? String(req.query.city) : '',
      from: req.query.from ? String(req.query.from) : ''
    };
    const items = listReportsFiltered(req.user.org_id, filters, limit, offset);
    const total = countReports(req.user.org_id, filters);
    if (!items.length && total === 0) {
      const data = readMock('reports');
      const all = Array.isArray(data.items) ? data.items : [];
      const filtered = all.filter(item => {
        const roleOk = !filters.role || String(item.role || '').toLowerCase().includes(filters.role.toLowerCase());
        const cityOk = !filters.city || String(item.region || '').toLowerCase().includes(filters.city.toLowerCase());
        const dateOk = !filters.from || String(item.date || '') >= filters.from;
        return roleOk && cityOk && dateOk;
      });
      const paged = filtered.slice(offset, offset + limit);
      return res.json({ items: paged, total: filtered.length });
    }
    res.json({
      items: items.map(item => ({
        id: item.id,
        role: item.role,
        region: item.city || 'Москва',
        type: item.type === 'competitors' ? 'Конкуренты' : item.type === 'template' ? 'Шаблон вакансии' : 'Рынок роли',
        date: item.created_at.slice(0, 10),
        status: item.status === 'processing' ? 'В работе' : 'Готов'
      })),
      total
    });
  });

  app.post(`${API_BASE}/reports`, requireAuth, requireRole('analyst'), (req, res) => {
    if (!req.body?.role) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Role is required', details: { field: 'role' } } });
    }
    const report = createReport(req.user.org_id, req.body);
    addAuditLog(req.user.id, 'report.create', report.id, { role: report.role, type: report.type });
    res.json({ id: report.id, status: report.status });
  });

  app.get(`${API_BASE}/reports/:id`, requireAuth, (req, res) => {
    const report = getReport(req.user.org_id, req.params.id);
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    res.json(report);
  });

  app.get(`${API_BASE}/reports/:id/export`, requireAuth, requireRole('analyst'), async (req, res) => {
    const report = getReport(req.user.org_id, req.params.id);
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    const format = String(req.query.format || 'pdf').toLowerCase();
    if (format === 'csv') {
      const csv = [
        'id,role,type,city,level,created_at,status',
        `${report.id},"${report.role}",${report.type},${report.city || ''},${report.level || ''},${report.created_at},${report.status}`
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"report-${report.id}.csv\"`);
      res.send(csv);
      return;
    }
    const pdf = await buildReportPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=\"report-${report.id}.pdf\"`);
    res.send(pdf);
  });

  app.get(`${API_BASE}/roles`, requireAuth, (req, res) => {
    const items = listRoleProfiles(req.user.org_id);
    if (!items.length) return res.json(readMock('roles'));
    res.json({ items: items.map(item => ({
      id: item.id,
      title: item.role,
      region: item.city || 'Москва',
      level: item.level || 'Middle',
      skills: (item.skills || []).join(', ')
    }))});
  });

  app.post(`${API_BASE}/roles`, requireAuth, requireRole('analyst'), (req, res) => {
    if (!req.body?.role) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Role is required', details: { field: 'role' } } });
    }
    const role = createRoleProfile(req.user.org_id, req.body, req.user.id);
    addAuditLog(req.user.id, 'role.create', role.id, { role: role.role });
    res.json(role);
  });

  app.delete(`${API_BASE}/roles/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteRoleProfile(req.user.org_id, req.params.id);
    addAuditLog(req.user.id, 'role.delete', req.params.id, {});
    res.json({ status: 'deleted' });
  });

  app.delete(`${API_BASE}/reports/:id`, requireAuth, requireRole('admin'), (req, res) => {
    const report = getReport(req.user.org_id, req.params.id);
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    deleteReport(req.user.org_id, req.params.id);
    addAuditLog(req.user.id, 'report.delete', req.params.id, {});
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/competitors`, requireAuth, (req, res) => {
    res.json(readMock('competitors'));
  });

  app.get(`${API_BASE}/template`, requireAuth, (req, res) => {
    res.json(readMock('template'));
  });

  app.post(`${API_BASE}/template`, requireAuth, (req, res) => {
    res.json(readMock('template'));
  });

  app.get(`${API_BASE}/team`, requireAuth, requireRole('admin'), (req, res) => {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const filters = {
      query: req.query.q ? String(req.query.q) : '',
      role: req.query.role ? String(req.query.role) : '',
      status: req.query.status ? String(req.query.status) : ''
    };
    const items = listTeamFiltered(req.user.org_id, filters, limit, offset);
    const total = countTeam(req.user.org_id, filters);
    if (!items.length && total === 0) {
      const data = readMock('team');
      const all = Array.isArray(data.members) ? data.members : [];
      const filtered = all.filter(member => {
        const hay = `${member.name || ''} ${member.email || ''}`.toLowerCase();
        const q = String(filters.query || '').toLowerCase();
        const queryOk = !q || hay.includes(q);
        const roleOk = !filters.role || String(member.role || '').toLowerCase() === filters.role;
        const status = String(member.access || '').toLowerCase().includes('invitation') ? 'invited' : 'active';
        const statusOk = !filters.status || status === filters.status;
        return queryOk && roleOk && statusOk;
      });
      const paged = filtered.slice(offset, offset + limit);
      return res.json({ members: paged, total: filtered.length });
    }
    res.json({ members: items.map(user => ({
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      role: user.role,
      access: user.status === 'invited' ? 'Invitation pending' : 'Active'
    })), total });
  });

  app.post(`${API_BASE}/team/invite`, requireAuth, requireRole('admin'), (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role || 'analyst';
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email', details: { field: 'email' } } });
    }
    const user = inviteTeamMember(req.user.org_id, email, role);
    addAuditLog(req.user.id, 'team.invite', user.id, { email, role });
    res.json({ status: 'invited', user });
  });

  app.patch(`${API_BASE}/team/:id`, requireAuth, requireRole('admin'), (req, res) => {
    const role = req.body?.role;
    const user = updateTeamRole(req.user.org_id, req.params.id, role);
    addAuditLog(req.user.id, 'team.role.update', req.params.id, { role });
    res.json({ status: 'updated', user });
  });

  app.delete(`${API_BASE}/team/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteTeamMember(req.user.org_id, req.params.id);
    addAuditLog(req.user.id, 'team.delete', req.params.id, {});
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/billing/plan`, requireAuth, requireRole('owner'), (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/billing`, requireAuth, requireRole('owner'), (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/settings`, requireAuth, requireRole('admin'), (req, res) => {
    res.json(readMock('settings'));
  });

  app.post(`${API_BASE}/billing/checkout`, requireAuth, requireRole('owner'), (req, res) => {
    addAuditLog(req.user.id, 'billing.checkout', req.user.org_id, { plan: req.body?.plan || 'unknown' });
    res.json({ url: 'https://example.com/checkout' });
  });

  app.post(`${API_BASE}/billing/webhook`, (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get(`${API_BASE}/audit`, requireAuth, requireRole('admin'), (req, res) => {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);
    const filters = {
      query: req.query.q ? String(req.query.q) : '',
      action: req.query.action ? String(req.query.action) : '',
      from: req.query.from ? String(req.query.from) : ''
    };
    const items = listAuditLogsFiltered(filters, limit, offset);
    const total = countAuditLogs(filters);
    if (!items.length && total === 0) {
      const data = readMock('audit');
      const all = Array.isArray(data.items) ? data.items : [];
      const filtered = all.filter(item => {
        const hay = `${item.actor_id || ''} ${item.action || ''} ${item.target || ''}`.toLowerCase();
        const q = String(filters.query || '').toLowerCase();
        const queryOk = !q || hay.includes(q);
        const actionOk = !filters.action || String(item.action || '').toLowerCase().includes(filters.action.toLowerCase());
        const dateOk = !filters.from || String(item.created_at || '') >= filters.from;
        return queryOk && actionOk && dateOk;
      });
      const paged = filtered.slice(offset, offset + limit);
      return res.json({ items: paged, total: filtered.length });
    }
    res.json({ items, total });
  });

  return app;
}

function startWebServer() {
  const app = express();
  app.use(express.json());
  app.use(buildApiRouter());
  app.use(express.static(STATIC_DIR));
  app.listen(WEB_PORT, () => {
    console.log(`[web] listening on http://localhost:${WEB_PORT}`);
  });
}

module.exports = { startWebServer, buildApiRouter };
