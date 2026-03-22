const path = require('path');
const fs = require('fs');
const express = require('express');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const { getHhConnectionStatus, getAuthorizeUrl, exchangeCodeForToken } = require('../hh/oauth');
const {
  createPkcePair,
  getProviderConfig,
  getProviderList,
  buildAuthorizeUrl,
  exchangeCodeForAccessToken,
  fetchUserProfile
} = require('../auth/oauth');
const {
  createWebLoginRequest,
  completeWebLoginRequest,
  getWebLoginRequestStatus,
  consumeWebLoginRequest
} = require('../auth/web-login');
const { getAreas, getProfessionalRoles, suggestSkills } = require('../hh/client');
const {
  createAuthToken,
  consumeAuthToken,
  createSession,
  deleteSession,
  getWebUserForLogin,
  createBootstrapOwnerIfAllowed,
  getSessionUser,
  getWebUserBySocialAccount,
  upsertSocialAuthAccount,
  createSocialAuthUser,
  elevateWebUserRole,
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
const WEB_HOST = process.env.WEB_HOST || '0.0.0.0';
const API_BASE = '/api/v1';
const DATA_DIR = path.join(__dirname, '../../web/data');
const STATIC_DIR = path.join(__dirname, '../../web');
const hhOauthState = new Map();
const socialOauthState = new Map();
const AUTH_COOKIE_NAME = 'sr_session';
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim();
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
const authRateBuckets = new Map();
const BRAND_NAME = process.env.BRAND_NAME || 'GridAI';
const DEFAULT_FROM_EMAIL = process.env.SMTP_FROM || `${BRAND_NAME} <no-reply@gridai.ru>`;
const SITE_URL = String(process.env.SITE_URL || process.env.APP_URL || 'https://gridai.ru').replace(/\/$/, '');
const AUTH_URL = String(process.env.AUTH_URL || 'https://auth.gridai.ru').replace(/\/$/, '');
const CAREER_URL = String(process.env.CAREER_URL || 'https://career.gridai.ru').replace(/\/$/, '');
const HIRING_URL = String(process.env.HIRING_URL || process.env.LK_URL || 'https://hiring.gridai.ru').replace(/\/$/, '');
const ADMIN_URL = String(process.env.ADMIN_URL || 'https://admin.gridai.ru').replace(/\/$/, '');
const API_PUBLIC_URL = String(process.env.API_PUBLIC_URL || 'https://api.gridai.ru').replace(/\/$/, '');
const SMSC_ALERT_STATUSES = String(process.env.SMSC_ALERT_STATUSES || 'DELIVRD,UNDELIV')
  .split(',')
  .map(v => v.trim().toUpperCase())
  .filter(Boolean);

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
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
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
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
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
    `<b>Новая заявка ${BRAND_NAME}</b>`,
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
        buttons.push([{ text: 'Открыть ЛК', url: portalUrl('/portal/leads') }]);
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
        from: DEFAULT_FROM_EMAIL,
        to: emailTo,
        subject: `Новая заявка ${BRAND_NAME}`,
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
        from: DEFAULT_FROM_EMAIL,
        to: emailTo,
        subject: `${BRAND_NAME}: ${event}`,
        text: textLines.join('\n')
      });
    } catch (err) {
      console.error('[ops] email notify failed', err);
    }
  }
}

async function sendAuthTokenEmail(email, token, expiresAt, intent = 'career') {
  const smtpUrl = process.env.SMTP_URL;
  const smtpHost = process.env.SMTP_HOST;
  const normalizedIntent = normalizeIntent(intent);
  const verifyUrl = AUTH_URL
    ? `${AUTH_URL}${authEntryPath(normalizedIntent)}?token=${encodeURIComponent(token)}&intent=${encodeURIComponent(normalizedIntent)}`
    : '';
  const ttlMinutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 1000)));
  const text = [
    `Вход в ${BRAND_NAME}`,
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
      from: DEFAULT_FROM_EMAIL,
      to: email,
      subject: `${BRAND_NAME}: код входа`,
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

function getTelegramBotUsername() {
  return String(process.env.TELEGRAM_BOT_USERNAME_JOBS || process.env.TELEGRAM_BOT_USERNAME || 'GridAI_Careers_bot')
    .replace(/^@/, '')
    .trim();
}

function normalizeIntent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'hiring' || normalized === 'recruiter' || normalized === 'hr') return 'hiring';
  return 'career';
}

function getIntentFromRequest(req) {
  const host = getRequestHost(req);
  if (isSubdomainHost(host, 'career')) return 'career';
  if (isSubdomainHost(host, 'hiring')) return 'hiring';
  const path = String(req.path || '').toLowerCase();
  if (path === '/career' || path.startsWith('/career/')) return 'career';
  if (path === '/hiring' || path.startsWith('/hiring/')) return 'hiring';
  const bodyIntent = req.body && typeof req.body === 'object' ? req.body.intent : '';
  return normalizeIntent(req.query.intent || bodyIntent || '');
}

function getAppOrigin(intent = 'career') {
  return normalizeIntent(intent) === 'hiring' ? HIRING_URL : CAREER_URL;
}

function getAppHomePath(intent = 'career') {
  return normalizeIntent(intent) === 'hiring' ? '/hiring/dashboard.html' : '/career/dashboard.html';
}

function buildAppUrl(intent = 'career', pathname = '') {
  return `${getAppOrigin(intent)}${pathname || getAppHomePath(intent)}`;
}

function authEntryPath(intent = 'career') {
  return normalizeIntent(intent) === 'hiring' ? '/hiring' : '/career';
}

function authLoginUrl(query = '', intent = 'career') {
  return `${AUTH_URL}${authEntryPath(intent)}${query || ''}`;
}

function getTelegramBotUsernameForIntent(intent = 'career') {
  if (normalizeIntent(intent) === 'hiring') {
    return String(process.env.TELEGRAM_BOT_USERNAME_HR || process.env.TELEGRAM_BOT_USERNAME || 'GridAI_Recruiter_bot')
      .replace(/^@/, '')
      .trim();
  }
  return getTelegramBotUsername();
}

function resolveMaxBotLaunch(requestId, intent = 'career') {
  const oauthUrl = String(process.env.MAX_OAUTH_URL || '').trim();
  const normalizedIntent = normalizeIntent(intent);
  const botName = String(
    normalizedIntent === 'hiring'
      ? process.env.MAX_BOT_NAME_HIRING || process.env.MAX_BOT_NAME_HR || process.env.MAX_BOT_NAME || ''
      : process.env.MAX_BOT_NAME_CAREER || process.env.MAX_BOT_NAME_JOBS || process.env.MAX_BOT_NAME || ''
  ).trim().replace(/^@/, '');
  const command = `login_${requestId}`;
  if (oauthUrl) {
    const botUrl = oauthUrl.includes('{request_id}')
      ? oauthUrl.replaceAll('{request_id}', requestId)
      : `${oauthUrl}${oauthUrl.includes('?') ? '&' : '?'}start=${encodeURIComponent(command)}`;
    return { botUrl, command };
  }
  if (botName) {
    return { botUrl: `https://max.ru/${botName}?start=${encodeURIComponent(command)}`, command };
  }
  return { botUrl: '', command };
}

function getRequestHost(req) {
  return String(req.headers.host || '').toLowerCase().split(':')[0];
}

function isSubdomainHost(host, subdomain) {
  return host === `${subdomain}.gridai.ru`;
}

function portalUrl(pathname = '') {
  const normalizedPath = String(pathname || getAppHomePath('hiring')).replace(/^\/portal\b/, '/hiring');
  return `${HIRING_URL}${normalizedPath}`;
}

function extractMaxLoginRequestId(payload) {
  const direct = String(payload?.payload || payload?.start_payload || '').trim();
  if (direct.startsWith('login_')) return direct.slice('login_'.length).trim();

  const messageText = String(
    payload?.message?.body?.text
    || payload?.message?.text
    || payload?.body?.text
    || payload?.text
    || ''
  ).trim();

  if (messageText.startsWith('login_')) return messageText.slice('login_'.length).trim();
  const startMatch = messageText.match(/^\/start\s+login_(.+)$/i);
  if (startMatch) return String(startMatch[1] || '').trim();
  return '';
}

function extractMaxUser(payload) {
  const sender = payload?.message?.sender || payload?.sender || payload?.user || {};
  const id = String(
    sender?.user_id
    || sender?.id
    || payload?.user_id
    || payload?.from_id
    || ''
  ).trim();
  if (!id) return null;

  return {
    id,
    first_name: String(sender?.first_name || sender?.name || '').trim(),
    last_name: String(sender?.last_name || '').trim(),
    username: String(sender?.username || sender?.nick || '').trim(),
    language_code: String(sender?.language_code || sender?.lang || payload?.language_code || '').trim(),
    email: String(sender?.email || payload?.email || '').trim().toLowerCase()
  };
}

function resolveSocialUser(provider, profile, intent = 'career') {
  const normalizedProvider = String(provider || '').toLowerCase();
  const normalizedIntent = normalizeIntent(intent);
  const targetRole = normalizedIntent === 'hiring' ? 'owner' : 'viewer';
  const externalUserId = String(profile?.externalUserId || '').trim();
  if (!externalUserId) {
    return { user: null, reason: 'external_id_missing' };
  }

  const linkedUser = getWebUserBySocialAccount(normalizedProvider, externalUserId);
  if (linkedUser) {
    const effectiveUser = elevateWebUserRole(linkedUser.id, targetRole) || linkedUser;
    upsertSocialAuthAccount(linkedUser.id, normalizedProvider, externalUserId, {
      email: profile?.email || null,
      profile: profile?.raw || profile || {}
    });
    return { user: effectiveUser, reason: 'linked' };
  }

  const email = String(profile?.email || '').trim().toLowerCase();
  if (email) {
    let user = getWebUserForLogin(email);
    if (!user) {
      user = createBootstrapOwnerIfAllowed(email);
    }
    if (user) {
      const effectiveUser = elevateWebUserRole(user.id, targetRole) || user;
      upsertSocialAuthAccount(user.id, normalizedProvider, externalUserId, {
        email,
        profile: profile?.raw || profile || {}
      });
      return { user: effectiveUser, reason: 'email_match' };
    }
  }

  const created = createSocialAuthUser(normalizedProvider, externalUserId, {
    email,
    name: profile?.name || '',
    username: profile?.username || '',
    role: targetRole
  });
  if (created) {
    upsertSocialAuthAccount(created.id, normalizedProvider, externalUserId, {
      email: email || null,
      profile: profile?.raw || profile || {}
    });
    return { user: created, reason: 'auto_created' };
  }

  return { user: null, reason: email ? 'invite_required' : 'email_missing' };
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
      res.redirect(portalUrl('/portal/settings?hh=connected'));
    } catch (err) {
      res.status(500).send(`HH token exchange failed: ${String(err.message || err)}`);
    }
  });

  app.get(`${API_BASE}/auth/oauth/providers`, (req, res) => {
    const intent = getIntentFromRequest(req);
    const oauthItems = getProviderList().map(item => ({ ...item, mode: 'oauth' }));
    const customItems = [
      {
        provider: 'telegram',
        enabled: Boolean(getTelegramBotUsernameForIntent(intent)),
        mode: 'telegram_web_login'
      },
      {
        provider: 'max',
        enabled: Boolean(resolveMaxBotLaunch('preview', intent).botUrl),
        mode: 'max_web_login'
      }
    ];
    res.json({ items: [...customItems, ...oauthItems] });
  });

  app.get(`${API_BASE}/auth/oauth/:provider/start`, (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const intent = getIntentFromRequest(req);
    const cfg = getProviderConfig(provider);
    if (!cfg) {
      return res.status(404).json({ error: { code: 'UNKNOWN_PROVIDER', message: 'Unsupported OAuth provider' } });
    }
    if (!cfg.enabled) {
      return res.status(400).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: `Provider ${provider} is not configured` } });
    }
    const state = randomUUID();
    const { verifier, challenge } = createPkcePair();
    socialOauthState.set(state, {
      provider,
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
      intent
    });
    const url = buildAuthorizeUrl(cfg, state, challenge);
    const mode = String(req.query.mode || '').toLowerCase();
    if (mode === 'json') {
      return res.json({ url, provider });
    }
    return res.redirect(url);
  });

  app.get(`${API_BASE}/auth/oauth/:provider/callback`, async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const cfg = getProviderConfig(provider);
    if (!cfg || !cfg.enabled) {
      return res.redirect(authLoginUrl('?oauth_error=not_configured', getIntentFromRequest(req)));
    }
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const providerError = String(req.query.error || '');
    if (providerError) {
      return res.redirect(authLoginUrl(`?oauth_error=${encodeURIComponent(providerError)}`, getIntentFromRequest(req)));
    }
    const stateRow = socialOauthState.get(state);
    socialOauthState.delete(state);
    if (!code || !stateRow || stateRow.provider !== provider || stateRow.expiresAt < Date.now()) {
      return res.redirect(authLoginUrl('?oauth_error=invalid_state', getIntentFromRequest(req)));
    }
    try {
      const tokenPayload = await exchangeCodeForAccessToken(cfg, code, stateRow.verifier, {
        state,
        deviceId: req.query.device_id
      });
      const profile = await fetchUserProfile(cfg, tokenPayload.access_token);
      const resolved = resolveSocialUser(provider, profile, stateRow.intent);
      const user = resolved.user;
      if (!user) {
        return res.redirect(authLoginUrl(`?oauth_error=${encodeURIComponent(resolved.reason)}`, stateRow.intent));
      }
      const session = createSession(user.id);
      setSessionCookie(res, session.token, session.expiresAt);
      return res.redirect(buildAppUrl(stateRow.intent));
    } catch (err) {
      return res.redirect(authLoginUrl(`?oauth_error=${encodeURIComponent(String(err?.message || 'oauth_failed'))}`, stateRow?.intent));
    }
  });

  app.post(`${API_BASE}/auth/telegram/web-login/start`, (req, res) => {
    const intent = getIntentFromRequest(req);
    const { requestId, expiresIn } = createWebLoginRequest('telegram', 180, { intent });
    res.json({
      requestId,
      botUrl: `https://t.me/${getTelegramBotUsernameForIntent(intent)}?start=login_${requestId}`,
      intent,
      expiresIn
    });
  });

  app.get(`${API_BASE}/auth/telegram/web-login/status`, (req, res) => {
    const requestId = String(req.query.requestId || '').trim();
    const state = getWebLoginRequestStatus('telegram', requestId);
    if (state.status === 'pending') {
      return res.json({ status: 'pending', expiresIn: state.expiresIn || 0 });
    }
    if (state.status !== 'authorized' || !state.profile) {
      return res.json({ status: 'expired' });
    }
    const profile = {
      externalUserId: String(state.profile.id || ''),
      email: '',
      name: String([state.profile.first_name, state.profile.last_name].filter(Boolean).join(' ') || state.profile.username || '').trim(),
      username: String(state.profile.username || '').trim(),
      raw: state.profile
    };
    const intent = normalizeIntent(state.context?.intent || 'career');
    const resolved = resolveSocialUser('telegram', profile, intent);
    if (!resolved.user) {
      consumeWebLoginRequest('telegram', requestId);
      return res.json({ status: 'error', error: resolved.reason });
    }
    const session = createSession(resolved.user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    consumeWebLoginRequest('telegram', requestId);
    return res.json({ status: 'authorized', user: resolved.user, redirectUrl: buildAppUrl(intent), intent });
  });

  app.post(`${API_BASE}/auth/telegram/web-login/complete`, (req, res) => {
    const requiredSecret = String(process.env.AUTH_WEB_LOGIN_SECRET || '').trim();
    const providedSecret = String(req.headers['x-auth-web-login-secret'] || '').trim();
    if (requiredSecret && providedSecret !== requiredSecret) {
      return res.status(401).json({ error: { code: 'INVALID_SECRET', message: 'Invalid web login secret' } });
    }
    const requestId = String(req.body?.requestId || '').trim();
    const telegramUser = req.body?.telegramUser || null;
    const ok = completeWebLoginRequest('telegram', requestId, telegramUser);
    res.json({ ok });
  });

  app.post(`${API_BASE}/auth/max/web-login/start`, (req, res) => {
    const intent = getIntentFromRequest(req);
    const { requestId, expiresIn } = createWebLoginRequest('max', 180, { intent });
    const launch = resolveMaxBotLaunch(requestId, intent);
    res.json({ requestId, expiresIn, intent, ...launch });
  });

  app.get(`${API_BASE}/auth/max/web-login/status`, (req, res) => {
    const requestId = String(req.query.requestId || '').trim();
    const state = getWebLoginRequestStatus('max', requestId);
    if (state.status === 'pending') {
      return res.json({ status: 'pending', expiresIn: state.expiresIn || 0 });
    }
    if (state.status !== 'authorized' || !state.profile) {
      return res.json({ status: 'expired' });
    }
    const profile = {
      externalUserId: String(state.profile.id || ''),
      email: String(state.profile.email || state.profile.mail || '').trim().toLowerCase(),
      name: String(
        state.profile.full_name
        || state.profile.display_name
        || [state.profile.first_name, state.profile.last_name].filter(Boolean).join(' ')
        || state.profile.username
        || ''
      ).trim(),
      username: String(state.profile.username || '').trim(),
      raw: state.profile
    };
    const intent = normalizeIntent(state.context?.intent || 'career');
    const resolved = resolveSocialUser('max', profile, intent);
    if (!resolved.user) {
      consumeWebLoginRequest('max', requestId);
      return res.json({ status: 'error', error: resolved.reason });
    }
    const session = createSession(resolved.user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    consumeWebLoginRequest('max', requestId);
    return res.json({ status: 'authorized', user: resolved.user, redirectUrl: buildAppUrl(intent), intent });
  });

  app.post(`${API_BASE}/auth/max/web-login/complete`, (req, res) => {
    const requiredSecret = String(process.env.MAX_WEBHOOK_SECRET || process.env.AUTH_WEB_LOGIN_SECRET || '').trim();
    const providedSecret = String(req.headers['x-max-bot-api-secret'] || req.headers['x-max-secret'] || '').trim();
    if (requiredSecret && providedSecret !== requiredSecret) {
      return res.status(401).json({ error: { code: 'INVALID_SECRET', message: 'Invalid MAX web login secret' } });
    }
    const requestId = String(req.body?.requestId || '').trim();
    const maxUser = req.body?.maxUser || null;
    const ok = completeWebLoginRequest('max', requestId, maxUser);
    res.json({ ok });
  });

  app.post(`${API_BASE}/auth/max/web-login/webhook`, (req, res) => {
    const requiredSecret = String(process.env.MAX_WEBHOOK_SECRET || process.env.AUTH_WEB_LOGIN_SECRET || '').trim();
    const providedSecret = String(req.headers['x-max-bot-api-secret'] || req.headers['x-max-secret'] || '').trim();
    if (requiredSecret && providedSecret !== requiredSecret) {
      return res.status(401).json({ error: { code: 'INVALID_SECRET', message: 'Invalid MAX webhook secret' } });
    }

    const payload = req.body || {};
    const eventType = String(payload.type || payload.update_type || '').trim().toLowerCase();
    const supportedTypes = new Set(['', 'message_created', 'bot_started']);
    if (!supportedTypes.has(eventType)) {
      return res.json({ ok: true, ignored: true, reason: 'unsupported_event' });
    }

    const requestId = extractMaxLoginRequestId(payload);
    if (!requestId) {
      return res.json({ ok: true, ignored: true, reason: 'not_login_message' });
    }

    const maxUser = extractMaxUser(payload);
    if (!maxUser) {
      return res.json({ ok: false, ignored: false, reason: 'missing_user' });
    }

    const ok = completeWebLoginRequest('max', requestId, maxUser);
    return res.json({ ok, requestId });
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

  const handleAuthLogin = async (req, res) => {
    const parsed = parseWithSchema(EmailSchema, req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const email = parsed.data.email.toLowerCase();
    const intent = getIntentFromRequest(req);
    const { token, expiresAt } = createAuthToken(email);
    try {
      await sendAuthTokenEmail(email, token, expiresAt, intent);
      res.json({ status: 'sent', expires_at: expiresAt, intent });
    } catch (err) {
      res.status(503).json({
        error: {
          code: 'DELIVERY_NOT_CONFIGURED',
          message: String(err?.message || 'Failed to send auth token')
        }
      });
    }
  };

  app.post(`${API_BASE}/auth/login`, authRateLimit, handleAuthLogin);
  app.post(`${API_BASE}/auth/sign-in`, authRateLimit, handleAuthLogin);
  app.post(`${API_BASE}/auth/signin`, authRateLimit, handleAuthLogin);

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
    const intent = getIntentFromRequest(req);
    res.json({ status: 'ok', user, expires_at: session.expiresAt, intent, redirect_url: buildAppUrl(intent) });
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
    ].filter(Boolean), portalUrl('/portal/leads'));
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

  app.get(`${API_BASE}/dashboard`, requireAuth, (req, res) => {
    res.json(readMock('dashboard'));
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
    ], portalUrl('/portal/reports'));
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
    ].filter(Boolean), portalUrl('/portal/roles'));
    res.json(role);
  });

  app.delete(`${API_BASE}/roles/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteRoleProfile(req.user.org_id, req.params.id);
    addAuditLog(req.user.org_id, req.user.id, 'role.delete', req.params.id, {});
    notifyOps('Удалён профиль роли', [
      `ID: ${req.params.id}`
    ], portalUrl('/portal/roles'));
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
    ], portalUrl('/portal/reports'));
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
      ], portalUrl('/portal/team'));
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
    ], portalUrl('/portal/team'));
    res.json({ status: 'updated', user });
  });

  app.delete(`${API_BASE}/team/:id`, requireAuth, requireRole('admin'), (req, res) => {
    deleteTeamMember(req.user.org_id, req.params.id);
    addAuditLog(req.user.org_id, req.user.id, 'team.delete', req.params.id, {});
    notifyOps('Удалён участник команды', [
      `User ID: ${req.params.id}`
    ], portalUrl('/portal/team'));
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
    ], portalUrl('/portal/billing'));
    res.json({ url: 'https://example.com/checkout' });
  });

  app.post(`${API_BASE}/billing/webhook`, (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get(`${API_BASE}/integrations/smsc/webhook`, (req, res) => {
    const expectedKey = String(process.env.SMSC_WEBHOOK_KEY || '').trim();
    const providedKey = String(req.query.key || '').trim();
    if (expectedKey && providedKey !== expectedKey) {
      return res.status(403).send('FORBIDDEN');
    }
    return res.status(200).send('OK');
  });

  app.post(`${API_BASE}/integrations/smsc/webhook`, (req, res) => {
    const expectedKey = String(process.env.SMSC_WEBHOOK_KEY || '').trim();
    const providedKey = String(req.query.key || '').trim();
    if (expectedKey && providedKey !== expectedKey) {
      return res.status(403).send('FORBIDDEN');
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const eventType = payload.status ? 'smsc.status' : 'smsc.incoming';
    const target = String(payload.id || payload.phone || '');
    addAuditLog('', null, eventType, target, payload);
    const status = String(payload.status || '').toUpperCase();
    if (status && SMSC_ALERT_STATUSES.includes(status)) {
      const isUndeliv = status === 'UNDELIV';
      const eventTitle = isUndeliv ? 'SMSC UNDELIV [HIGH]' : `SMSC status: ${status}`;
      const lines = [
        isUndeliv ? 'PRIORITY: HIGH' : 'PRIORITY: NORMAL',
        `Status: ${status}`,
        `Message ID: ${payload.id || 'n/a'}`,
        `Phone: ${payload.phone || 'n/a'}`,
        `Time: ${payload.time || payload.ts || new Date().toISOString()}`,
        payload.err ? `Error: ${payload.err}` : null,
        payload.error ? `Error Code: ${payload.error}` : null,
        payload.operator ? `Operator: ${payload.operator}` : null
      ].filter(Boolean);
      notifyOps(
        eventTitle,
        lines,
        portalUrl('/portal/audit')
      ).catch(err => console.error('[smsc] notify failed', err));
    }
    return res.status(200).send('OK');
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
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const host = getRequestHost(req);
    if (isSubdomainHost(host, 'api') && (req.path === '/' || req.path === '')) {
      return res.json({
        service: 'gridai-api',
        status: 'ok',
        base: API_BASE
      });
    }
    if (isSubdomainHost(host, 'auth') && (req.path === '/' || req.path === '/index.html')) {
      return res.redirect('/career');
    }
    if (isSubdomainHost(host, 'career') && (req.path === '/' || req.path === '/index.html')) {
      return res.redirect('/career/dashboard.html');
    }
    if (isSubdomainHost(host, 'hiring') && (req.path === '/' || req.path === '/index.html')) {
      return res.redirect('/hiring/dashboard.html');
    }
    if (isSubdomainHost(host, 'admin') && (req.path === '/' || req.path === '/index.html')) {
      return res.redirect('/hiring/settings.html');
    }
    if ((host === 'gridai.ru' || host === 'www.gridai.ru') && req.path.startsWith('/portal')) {
      return res.redirect(`${HIRING_URL}${req.originalUrl.replace(/^\/portal/, '/hiring')}`);
    }
    if ((host === 'gridai.ru' || host === 'www.gridai.ru') && (req.path === '/login' || req.path === '/sign-in' || req.path === '/signin' || req.path === '/career' || req.path === '/hiring' || req.path.startsWith('/oauth/'))) {
      return res.redirect(`${AUTH_URL}${req.originalUrl}`);
    }
    next();
  });
  app.use(buildApiRouter());
  app.get('/oauth/:provider/start', (req, res) => {
    const provider = encodeURIComponent(String(req.params.provider || '').toLowerCase());
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`${API_BASE}/auth/oauth/${provider}/start${query}`);
  });
  app.get('/oauth/:provider/callback', (req, res) => {
    const provider = encodeURIComponent(String(req.params.provider || '').toLowerCase());
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`${API_BASE}/auth/oauth/${provider}/callback${query}`);
  });
  app.get('/career', (req, res) => {
    const intent = normalizeIntent(req.query.intent || 'career');
    return res.sendFile(path.join(STATIC_DIR, 'login.html'));
  });
  app.get('/hiring', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'login.html'));
  });
  app.get('/login', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'login.html'));
  });
  app.get('/sign-in', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'login.html'));
  });
  app.get('/signin', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'login.html'));
  });
  app.get('/privacy', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'privacy.html'));
  });
  app.get('/privacy.html', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'privacy.html'));
  });
  app.get('/portal', (_req, res) => {
    res.redirect('/hiring/dashboard.html');
  });
  app.use('/hiring', express.static(path.join(STATIC_DIR, 'portal')));
  app.use('/career', express.static(path.join(STATIC_DIR, 'career')));
  app.use(express.static(STATIC_DIR));
  app.listen(WEB_PORT, WEB_HOST, () => {
    console.log(`[web] listening on http://${WEB_HOST}:${WEB_PORT}`);
  });
}

module.exports = { startWebServer, buildApiRouter };
