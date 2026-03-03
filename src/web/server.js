const path = require('path');
const fs = require('fs');
const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const { getHhConnectionStatus, getAuthorizeUrl, exchangeCodeForToken } = require('../hh/oauth');
const { getAreas, getProfessionalRoles, suggestSkills } = require('../hh/client');
const {
  createAuthToken,
  consumeAuthToken,
  createSession,
  deleteSession,
  getWebUserForLogin,
  createBootstrapOwnerIfAllowed,
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
const hhOauthState = new Map();
const AUTH_COOKIE_NAME = 'sr_session';
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
const authRateBuckets = new Map();

const EmailSchema = z.object({
  email: z.string().trim().email().max(254)
});

const VerifyTokenSchema = z.object({
  token: z.string().trim().uuid()
});

const CreateLeadSchema = z.object({
  company: z.string().trim().max(200).optional().default(''),
  email: z.string().trim().email().max(254),
  message: z.string().trim().max(5000).optional().default(''),
  source: z.string().trim().max(120).optional().default('web')
});

const UpdateLeadSchema = z.object({
  status: z.string().trim().max(40).optional(),
  note: z.string().trim().max(2000).optional()
}).strict();

const ReportCreateSchema = z.object({
  type: z.enum(['market', 'competitors', 'template']).optional().default('market'),
  role: z.string().trim().min(2).max(120),
  level: z.string().trim().max(60).optional(),
  city: z.string().trim().max(120).optional(),
  schedule: z.string().trim().max(60).optional(),
  employment: z.string().trim().max(60).optional(),
  salary_min: z.coerce.number().int().min(0).max(100000000).optional(),
  salary_max: z.coerce.number().int().min(0).max(100000000).optional(),
  currency: z.string().trim().max(10).optional(),
  status: z.string().trim().max(40).optional()
}).strict();

const RoleCreateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().min(2).max(120),
  level: z.string().trim().max(60).optional(),
  city: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().max(80)).max(100).optional(),
  schedule: z.string().trim().max(60).optional(),
  employment: z.string().trim().max(60).optional(),
  salary_min: z.coerce.number().int().min(0).max(100000000).optional(),
  salary_max: z.coerce.number().int().min(0).max(100000000).optional()
}).strict();

const TeamInviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['viewer', 'analyst', 'admin', 'owner']).optional().default('analyst')
}).strict();

const TeamRolePatchSchema = z.object({
  role: z.enum(['viewer', 'analyst', 'admin', 'owner'])
}).strict();

const SkillSuggestSchema = z.object({
  text: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
});

const AuditFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  action: z.string().trim().max(80).optional().default(''),
  from: z.string().trim().max(40).optional().default('')
});

const ReportsFiltersSchema = z.object({
  role: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().max(120).optional().default(''),
  from: z.string().trim().max(40).optional().default('')
});

const TeamFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  role: z.string().trim().max(40).optional().default(''),
  status: z.string().trim().max(40).optional().default('')
});

const LeadsFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().default(''),
  status: z.string().trim().max(40).optional().default(''),
  from: z.string().trim().max(40).optional().default('')
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).max(100000).optional().default(0)
});

function readMock(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  if (!header) return {};
  return header.split(';').reduce((acc, item) => {
    const [rawKey, ...rest] = item.split('=');
    const key = String(rawKey || '').trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

function setSessionCookie(res, token, expiresAt) {
  const maxAgeSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function parseWithSchema(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0] || 'payload';
    const message = issue?.message || 'Validation error';
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: { field }
      }
    };
  }
  return { ok: true, data: parsed.data };
}

function authRateLimit(req, res, next) {
  const key = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
  const now = Date.now();
  let bucket = authRateBuckets.get(key);
  if (!bucket || now - bucket.start > AUTH_RATE_LIMIT_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    authRateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > AUTH_RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' }
    });
  }
  return next();
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

async function notifyOps(event, lines = [], url) {
  const tgToken = process.env.OPS_TG_BOT_TOKEN;
  const tgChat = process.env.OPS_TG_CHAT_ID;
  const emailTo = process.env.OPS_EMAIL_TO;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const textLines = [event, ...lines].filter(Boolean);
  const message = textLines.map(line => escapeHtml(line)).join('\n');

  if (tgToken && tgChat) {
    try {
      const buttons = [];
      if (url) {
        buttons.push([{ text: 'Открыть ЛК', url }]);
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
      console.error('[ops] telegram notify failed', err);
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
        subject: `SkillRadar: ${event}`,
        text: textLines.join('\n')
      });
    } catch (err) {
      console.error('[ops] email notify failed', err);
    }
  }
}

async function sendAuthTokenEmail(email, token, expiresAt) {
  const smtpUrl = process.env.SMTP_URL;
  const smtpHost = process.env.SMTP_HOST;
  const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
  const verifyUrl = appUrl ? `${appUrl}/login?token=${encodeURIComponent(token)}` : '';
  const ttlMinutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 1000)));
  const text = [
    'Вход в SkillRadar',
    '',
    'Используйте код ниже для входа:',
    token,
    '',
    verifyUrl ? `Или перейдите по ссылке: ${verifyUrl}` : null,
    `Код действует ${ttlMinutes} минут.`
  ].filter(Boolean).join('\n');

  if (smtpUrl || smtpHost) {
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
      to: email,
      subject: 'SkillRadar: код входа',
      text
    });
    return { sent: true, channel: 'smtp' };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[auth] login token for ${email}: ${token}`);
    return { sent: true, channel: 'console' };
  }

  throw new Error('Auth delivery is not configured. Set SMTP_* env variables.');
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const cookieToken = cookies[AUTH_COOKIE_NAME] || null;
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = cookieToken || bearerToken;
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  const user = getSessionUser(token);
  if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  req.user = user;
  req.sessionToken = token;
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

  app.get('/oauth/hh/callback', async (req, res) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const error = String(req.query.error || '');
    if (error) {
      return res.status(400).send(`HH OAuth error: ${error}`);
    }
    if (!code || !state || !hhOauthState.has(state)) {
      return res.status(400).send('Invalid HH OAuth callback state.');
    }
    const expiresAt = hhOauthState.get(state);
    hhOauthState.delete(state);
    if (!expiresAt || expiresAt < Date.now()) {
      return res.status(400).send('HH OAuth state expired.');
    }
    try {
      await exchangeCodeForToken(code);
      res.redirect('/portal/settings?hh=connected');
    } catch (err) {
      res.status(500).send(`HH token exchange failed: ${String(err.message || err)}`);
    }
  });

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

  app.post(`${API_BASE}/auth/login`, authRateLimit, async (req, res) => {
    const parsed = parseWithSchema(EmailSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const email = parsed.data.email.toLowerCase();
    const { token, expiresAt } = createAuthToken(email);
    try {
      await sendAuthTokenEmail(email, token, expiresAt);
      res.json({ status: 'sent', expires_at: expiresAt });
    } catch (err) {
      res.status(503).json({
        error: {
          code: 'DELIVERY_NOT_CONFIGURED',
          message: String(err?.message || 'Failed to send auth token')
        }
      });
    }
  });

  app.post(`${API_BASE}/auth/verify`, authRateLimit, (req, res) => {
    const parsed = parseWithSchema(VerifyTokenSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const payload = consumeAuthToken(parsed.data.token);
    if (!payload) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid' } });
    }
    let user = getWebUserForLogin(payload.email);
    if (!user) {
      user = createBootstrapOwnerIfAllowed(payload.email);
    }
    if (!user) {
      return res.status(403).json({
        error: {
          code: 'INVITE_REQUIRED',
          message: 'This email is not invited to any organization'
        }
      });
    }
    const session = createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ status: 'ok', user, expires_at: session.expiresAt });
  });

  app.post(`${API_BASE}/auth/logout`, requireAuth, (req, res) => {
    if (req.sessionToken) {
      deleteSession(req.sessionToken);
    }
    clearSessionCookie(res);
    res.json({ status: 'ok' });
  });

  app.get(`${API_BASE}/me`, requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get(`${API_BASE}/hh/status`, requireAuth, requireRole('admin'), (req, res) => {
    res.json(getHhConnectionStatus());
  });

  app.post(`${API_BASE}/hh/oauth/start`, requireAuth, requireRole('admin'), (req, res) => {
    const status = getHhConnectionStatus();
    if (!status.configured) {
      return res.status(400).json({ error: { code: 'HH_NOT_CONFIGURED', message: 'Set HH_CLIENT_ID / HH_CLIENT_SECRET / HH_REDIRECT_URI' } });
    }
    const state = randomUUID();
    hhOauthState.set(state, Date.now() + 10 * 60 * 1000);
    res.json({ url: getAuthorizeUrl(state) });
  });

  app.get(`${API_BASE}/hh/areas`, requireAuth, requireRole('analyst'), async (req, res) => {
    const areas = await getAreas();
    res.json({ items: areas });
  });

  app.get(`${API_BASE}/hh/professional_roles`, requireAuth, requireRole('analyst'), async (req, res) => {
    const roles = await getProfessionalRoles();
    res.json(roles);
  });

  app.get(`${API_BASE}/hh/skills/suggest`, requireAuth, requireRole('analyst'), async (req, res) => {
    const parsed = parseWithSchema(SkillSuggestSchema, req.query || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const items = await suggestSkills(parsed.data.text, parsed.data.limit);
    res.json({ items });
  });

  app.post(`${API_BASE}/leads`, async (req, res) => {
    const parsed = parseWithSchema(CreateLeadSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const lead = createLead({
      company: parsed.data.company,
      email: parsed.data.email.toLowerCase(),
      message: parsed.data.message,
      source: parsed.data.source
    });
    await notifyLead(lead);
    res.json({ status: 'ok', lead });
  });

  app.get(`${API_BASE}/leads`, requireAuth, requireRole('admin'), (req, res) => {
    const pageParsed = parseWithSchema(PaginationSchema, req.query || {});
    if (!pageParsed.ok) return res.status(400).json({ error: pageParsed.error });
    const limit = pageParsed.data.limit;
    const offset = pageParsed.data.offset;
    const filterParsed = parseWithSchema(LeadsFiltersSchema, req.query || {});
    if (!filterParsed.ok) return res.status(400).json({ error: filterParsed.error });
    const filters = {
      query: filterParsed.data.q,
      status: filterParsed.data.status,
      from: filterParsed.data.from
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
    const parsed = parseWithSchema(UpdateLeadSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const lead = updateLead(req.params.id, { status: parsed.data.status, note: parsed.data.note });
    addAuditLog(req.user.org_id, req.user.id, 'lead.update', String(req.params.id), { status: parsed.data.status, note: parsed.data.note });
    notifyOps('Обновлён лид', [
      `ID: ${req.params.id}`,
      parsed.data.status ? `Статус: ${parsed.data.status}` : null,
      parsed.data.note ? `Заметка: ${parsed.data.note}` : null
    ].filter(Boolean), `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/leads`);
    res.json({ status: 'updated', lead });
  });

  app.get(`${API_BASE}/reports`, requireAuth, (req, res) => {
    const pageParsed = parseWithSchema(PaginationSchema, req.query || {});
    if (!pageParsed.ok) return res.status(400).json({ error: pageParsed.error });
    const limit = pageParsed.data.limit;
    const offset = pageParsed.data.offset;
    const filterParsed = parseWithSchema(ReportsFiltersSchema, req.query || {});
    if (!filterParsed.ok) return res.status(400).json({ error: filterParsed.error });
    const filters = {
      role: filterParsed.data.role,
      city: filterParsed.data.city,
      from: filterParsed.data.from
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
    const parsed = parseWithSchema(ReportCreateSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const report = createReport(req.user.org_id, parsed.data);
    addAuditLog(req.user.org_id, req.user.id, 'report.create', report.id, { role: report.role, type: report.type });
    notifyOps('Создан отчёт', [
      `ID: ${report.id}`,
      `Роль: ${report.role}`,
      `Тип: ${report.type}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/reports`);
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
    const parsed = parseWithSchema(RoleCreateSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const role = createRoleProfile(req.user.org_id, parsed.data, req.user.id);
    addAuditLog(req.user.org_id, req.user.id, 'role.create', role.id, { role: role.role });
    notifyOps('Создан профиль роли', [
      `ID: ${role.id}`,
      `Роль: ${role.role}`,
      role.city ? `Город: ${role.city}` : null
    ].filter(Boolean), `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/roles`);
    res.json(role);
  });

  app.delete(`${API_BASE}/roles/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteRoleProfile(req.user.org_id, req.params.id);
    addAuditLog(req.user.org_id, req.user.id, 'role.delete', req.params.id, {});
    notifyOps('Удалён профиль роли', [
      `ID: ${req.params.id}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/roles`);
    res.json({ status: 'deleted' });
  });

  app.delete(`${API_BASE}/reports/:id`, requireAuth, requireRole('admin'), (req, res) => {
    const report = getReport(req.user.org_id, req.params.id);
    if (!report) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Report not found' } });
    }
    deleteReport(req.user.org_id, req.params.id);
    addAuditLog(req.user.org_id, req.user.id, 'report.delete', req.params.id, {});
    notifyOps('Удалён отчёт', [
      `ID: ${req.params.id}`,
      `Роль: ${report.role}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/reports`);
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
    const pageParsed = parseWithSchema(PaginationSchema, req.query || {});
    if (!pageParsed.ok) return res.status(400).json({ error: pageParsed.error });
    const limit = pageParsed.data.limit;
    const offset = pageParsed.data.offset;
    const filterParsed = parseWithSchema(TeamFiltersSchema, req.query || {});
    if (!filterParsed.ok) return res.status(400).json({ error: filterParsed.error });
    const filters = {
      query: filterParsed.data.q,
      role: filterParsed.data.role,
      status: filterParsed.data.status
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
    const parsed = parseWithSchema(TeamInviteSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const email = parsed.data.email.toLowerCase();
    const role = parsed.data.role;
    try {
      const user = inviteTeamMember(req.user.org_id, email, role);
      addAuditLog(req.user.org_id, req.user.id, 'team.invite', user.id, { email, role });
      notifyOps('Приглашение в команду', [
        `Email: ${email}`,
        `Роль: ${role}`
      ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/team`);
      res.json({ status: 'invited', user });
    } catch (err) {
      if (err?.code === 'EMAIL_IN_USE_IN_OTHER_ORG') {
        return res.status(409).json({
          error: { code: 'EMAIL_IN_USE', message: 'Email already belongs to another organization' }
        });
      }
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to invite user' }
      });
    }
  });

  app.patch(`${API_BASE}/team/:id`, requireAuth, requireRole('admin'), (req, res) => {
    const parsed = parseWithSchema(TeamRolePatchSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const role = parsed.data.role;
    const user = updateTeamRole(req.user.org_id, req.params.id, role);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team member not found' } });
    }
    addAuditLog(req.user.org_id, req.user.id, 'team.role.update', req.params.id, { role });
    notifyOps('Обновлена роль в команде', [
      `User ID: ${req.params.id}`,
      `Новая роль: ${role}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/team`);
    res.json({ status: 'updated', user });
  });

  app.delete(`${API_BASE}/team/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteTeamMember(req.user.org_id, req.params.id);
    addAuditLog(req.user.org_id, req.user.id, 'team.delete', req.params.id, {});
    notifyOps('Удалён участник команды', [
      `User ID: ${req.params.id}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/team`);
    res.json({ status: 'deleted' });
  });

  app.get(`${API_BASE}/billing/plan`, requireAuth, requireRole('owner'), (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/billing`, requireAuth, requireRole('owner'), (req, res) => {
    res.json(readMock('billing'));
  });

  app.get(`${API_BASE}/settings`, requireAuth, requireRole('admin'), (req, res) => {
    const base = readMock('settings');
    res.json({
      ...base,
      hh: getHhConnectionStatus(),
      use_mocks: String(process.env.USE_MOCKS || 'false')
    });
  });

  app.post(`${API_BASE}/billing/checkout`, requireAuth, requireRole('owner'), (req, res) => {
    addAuditLog(req.user.org_id, req.user.id, 'billing.checkout', req.user.org_id, { plan: req.body?.plan || 'unknown' });
    notifyOps('Запуск оплаты', [
      `План: ${req.body?.plan || 'unknown'}`,
      `Org: ${req.user.org_id}`
    ], `${process.env.APP_URL?.replace(/\/$/, '') || ''}/portal/billing`);
    res.json({ url: 'https://example.com/checkout' });
  });

  app.post(`${API_BASE}/billing/webhook`, (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get(`${API_BASE}/audit`, requireAuth, requireRole('admin'), (req, res) => {
    const pageParsed = parseWithSchema(PaginationSchema, req.query || {});
    if (!pageParsed.ok) return res.status(400).json({ error: pageParsed.error });
    const limit = pageParsed.data.limit;
    const offset = pageParsed.data.offset;
    const filterParsed = parseWithSchema(AuditFiltersSchema, req.query || {});
    if (!filterParsed.ok) return res.status(400).json({ error: filterParsed.error });
    const filters = {
      query: filterParsed.data.q,
      action: filterParsed.data.action,
      from: filterParsed.data.from
    };
    const items = listAuditLogsFiltered(req.user.org_id, filters, limit, offset);
    const total = countAuditLogs(req.user.org_id, filters);
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
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(buildApiRouter());
  app.use(express.static(STATIC_DIR));
  app.listen(WEB_PORT, () => {
    console.log(`[web] listening on http://localhost:${WEB_PORT}`);
  });
}

module.exports = { startWebServer, buildApiRouter };
