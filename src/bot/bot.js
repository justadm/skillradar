const { Telegraf, Markup } = require('telegraf');
const PDFDocument = require('pdfkit');
const { parseCriteria, explainFits, marketComment } = require('../llm/openai');
const { searchVacancies } = require('../hh/client');
const { getHhConnectionStatus } = require('../hh/oauth');
const { criteriaToSearchParams } = require('../hh/mappers');
const { rankVacancies } = require('../score/scoring');
const { computeMarketStats } = require('../market/market');
const {
  getOrCreateUser,
  listStopWords,
  addStopWord,
  removeStopWord,
  saveQuery,
  getMarketCache,
  saveMarketCache,
  listRecentQueries,
  setUserMode,
  getUserMode,
  hasUserConsent,
  markUserConsent,
  getB2BUsage,
  incrementB2BUsage,
  upsertJobDigestSubscription,
  listUserJobDigestSubscriptions,
  updateUserJobDigestSubscription,
  deactivateUserJobDigestSubscription
} = require('../db');
const { escapeHtml, includesAny } = require('../utils/text');

const STARTED_AT = Date.now();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 10);
const ADMIN_TG_IDS = String(process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const B2B_DAILY_LIMIT = Number(process.env.B2B_DAILY_LIMIT || 3);
const BRAND_NAME = process.env.BRAND_NAME || 'GridAI';
const HR_CONTACT_HANDLE = process.env.HR_CONTACT_HANDLE || '@gridai_hr_bot';

const BOT_AUDIENCE = {
  COMBINED: 'combined',
  JOBS: 'jobs',
  HR: 'hr'
};

const rateBuckets = new Map();
const searchCache = new Map();
const savedQueries = new Map();
const b2bReportCache = new Map();
const START_CALLBACK = {
  CONSENT: 'start:consent',
  DATA: 'start:data'
};

const STATE = {
  IDLE: 'idle',
  AWAIT_SEARCH: 'await_search',
  AWAIT_MARKET: 'await_market',
  STOP_ADD: 'stop_add',
  STOP_REMOVE: 'stop_remove',
  DIGEST_CREATE: 'digest_create',
  DIGEST_EDIT: 'digest_edit',
  DIGEST_DISABLE: 'digest_disable',
  B2B_MARKET: 'b2b_market',
  B2B_COMP: 'b2b_comp',
  B2B_TEMPLATE: 'b2b_template'
};

const userState = new Map();

function setState(tgId, state) {
  userState.set(String(tgId), state);
}

function getState(tgId) {
  return userState.get(String(tgId)) || STATE.IDLE;
}

function isAdmin(tgId) {
  return ADMIN_TG_IDS.includes(String(tgId));
}

async function completeTelegramWebLogin(requestId, profile) {
  const baseUrl = String(process.env.AUTH_WEB_LOGIN_BASE_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (!baseUrl) return false;
  const response = await fetch(`${baseUrl}/api/v1/auth/telegram/web-login/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AUTH_WEB_LOGIN_SECRET
        ? { 'X-Auth-Web-Login-Secret': String(process.env.AUTH_WEB_LOGIN_SECRET) }
        : {})
    },
    body: JSON.stringify({
      requestId,
      telegramUser: profile
    })
  });
  if (!response.ok) return false;
  const data = await response.json().catch(() => ({}));
  return Boolean(data?.ok);
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function stripHtml(text) {
  return decodeHtml(String(text || '').replace(/<[^>]*>/g, ''));
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: process.env.TZ || 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function buildReportPdf(title, body) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(18).text(title, { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(body, { align: 'left' });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function rateLimitOk(tgId) {
  const key = String(tgId);
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  if (now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

function jobsMenu() {
  return Markup.keyboard([
    ['Подбор вакансий', 'Рынок навыков'],
    ['Мои стоп-слова', 'Мои дайджесты'],
  ]).resize();
}

function hrMenu() {
  return Markup.keyboard([
    ['Рынок роли', 'Конкуренты'],
    ['Шаблон вакансии', 'Экспорт отчета'],
    ['Тарифы и лимиты'],
    ['Главное меню']
  ]).resize();
}

function combinedMenu(userId) {
  const mode = getUserMode(userId);
  return mode === 'b2b'
    ? Markup.keyboard([
      ['Рынок роли', 'Конкуренты'],
      ['Шаблон вакансии', 'Экспорт отчета'],
      ['Тарифы и лимиты', 'Соискательский режим'],
      ['Главное меню']
    ]).resize()
    : Markup.keyboard([
      ['Подбор вакансий', 'Рынок навыков'],
      ['Мои стоп-слова', 'Мои дайджесты'],
      ['B2B Аналитика']
    ]).resize();
}

function menuForAudience(audience, userId) {
  if (audience === BOT_AUDIENCE.HR) return hrMenu();
  if (audience === BOT_AUDIENCE.JOBS) return jobsMenu();
  return combinedMenu(userId);
}

function b2bMenuForAudience(audience) {
  if (audience === BOT_AUDIENCE.HR) return hrMenu();
  return Markup.keyboard([
    ['Рынок роли', 'Конкуренты'],
    ['Шаблон вакансии', 'Экспорт отчета'],
    ['Тарифы и лимиты', 'Соискательский режим'],
    ['Главное меню']
  ]).resize();
}

function getAudienceFromCtx(ctx) {
  return ctx?.state?.botAudience || BOT_AUDIENCE.COMBINED;
}

function getStartPayload(ctx) {
  const direct = String(ctx?.startPayload || '').trim();
  if (direct) return direct;
  const text = String(ctx?.message?.text || '').trim();
  const match = text.match(/^\/start(?:@\w+)?\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function isJobsAudience(audience) {
  return audience === BOT_AUDIENCE.JOBS || audience === BOT_AUDIENCE.COMBINED;
}

function isHrAudience(audience) {
  return audience === BOT_AUDIENCE.HR || audience === BOT_AUDIENCE.COMBINED;
}

function stoplistMenu() {
  return Markup.keyboard([
    ['Добавить стоп-слово', 'Удалить стоп-слово'],
    ['Главное меню']
  ]).resize();
}

function digestMenu() {
  return Markup.keyboard([
    ['Создать дайджест', 'Мои подписки'],
    ['Изменить дайджест', 'Отключить дайджест'],
    ['Главное меню']
  ]).resize();
}

function startConsentMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Продолжить', START_CALLBACK.CONSENT)],
    [Markup.button.callback('Как мы используем данные', START_CALLBACK.DATA)]
  ]);
}

function getStartPrompt(audience, brandName) {
  if (audience === BOT_AUDIENCE.HR) {
    return [
      `<b>${escapeHtml(brandName)} Recruiter</b>`,
      'AI-аналитика вакансий, ролей и навыков для HR и рекрутеров.',
      '',
      'Что умеет бот:',
      '• рынок роли и спрос по навыкам',
      '• конкуренты и активные работодатели',
      '• шаблон вакансии и быстрый экспорт',
      '',
      'Нажмите «Продолжить», чтобы открыть меню.'
    ].join('\n');
  }

  if (audience === BOT_AUDIENCE.JOBS) {
    return [
      `<b>${escapeHtml(brandName)} Careers</b>`,
      'AI-поиск вакансий и ежедневные дайджесты для соискателей.',
      '',
      'Что умеет бот:',
      '• поиск вакансий по запросу в свободной форме',
      '• объяснение, почему вакансия подходит',
      '• стоп-слова и daily-дайджест новых вакансий',
      '',
      'Нажмите «Продолжить», чтобы открыть меню.'
    ].join('\n');
  }

  return [
    `<b>${escapeHtml(brandName)}</b>`,
    'AI-аналитика вакансий, ролей и навыков.',
    '',
    'В этом боте доступны два сценария:',
    '• соискателю: поиск вакансий, стоп-слова и дайджесты',
    '• HR: рынок ролей, конкуренты и шаблон вакансии',
    '',
    'Нажмите «Продолжить», чтобы открыть меню.'
  ].join('\n');
}

function getStartReadyMessage(audience, brandName) {
  if (audience === BOT_AUDIENCE.HR) {
    return `${brandName} Recruiter готов. Открываю меню HR-аналитики.`;
  }
  if (audience === BOT_AUDIENCE.JOBS) {
    return `${brandName} Careers готов. Открываю меню поиска вакансий.`;
  }
  return `${brandName} готов. Открываю главное меню.`;
}

function getConsentAlert() {
  return [
    'Мы используем только сообщения, которые вы отправляете в бот, и публичные данные вакансий.',
    'Никакие действия от вашего имени на hh.ru не выполняются.',
    'Для дайджестов сохраняются ваши поисковые запросы и история отправок.'
  ].join('\n');
}

async function replyStartPrompt(ctx, audience, user, brandName) {
  setState(ctx.from.id, STATE.IDLE);
  await ctx.reply(getStartPrompt(audience, brandName), {
    parse_mode: 'HTML',
    ...startConsentMenu()
  });
}

function getConsentBotKey(audience) {
  if (audience === BOT_AUDIENCE.HR) return BOT_AUDIENCE.HR;
  if (audience === BOT_AUDIENCE.JOBS) return BOT_AUDIENCE.JOBS;
  return BOT_AUDIENCE.COMBINED;
}

function paginationMenu() {
  return Markup.keyboard([
    ['Показать еще', 'Сохранить запрос'],
    ['Подписаться на дайджест'],
    ['Главное меню']
  ]).resize();
}

function formatSalary(salary) {
  if (!salary) return 'не указана';
  const from = salary.from ? `от ${salary.from}` : '';
  const to = salary.to ? `до ${salary.to}` : '';
  const sep = from && to ? ' ' : '';
  return `${from}${sep}${to} ${salary.currency || ''}`.trim();
}

function getDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function b2bPaywallMessage() {
  return [
    'Лимит B2B‑отчетов на сегодня исчерпан.',
    `Текущий лимит: ${B2B_DAILY_LIMIT} отчетов/день.`,
    'Напишите нам, чтобы увеличить лимит или подключить тариф.',
    `Контакт: ${HR_CONTACT_HANDLE}`
  ].join('\n');
}

function b2bPricingMessage() {
  return [
    '<b>Тарифы B2B (пилот)</b>',
    'Starter — 3 отчета/день, 1 пользователь, 1 роль в фокусе.',
    'Pro — 10 отчетов/день, до 3 пользователей, экспорт PDF.',
    'Team — 30 отчетов/день, до 10 пользователей, SLA и кастом.',
    '',
    `Чтобы подключить тариф — напишите: ${HR_CONTACT_HANDLE}`
  ].join('\n');
}

function canUseB2B(user) {
  const dayKey = getDayKey();
  const used = getB2BUsage(user.id, dayKey);
  return { used, allowed: used < B2B_DAILY_LIMIT, dayKey };
}

function extractUserFilters(text) {
  const t = String(text || '').toLowerCase();
  const locationMap = [
    ['москва', 'Москва'],
    ['moscow', 'Москва'],
    ['санкт-петербург', 'Санкт-Петербург'],
    ['питер', 'Санкт-Петербург'],
    ['спб', 'Санкт-Петербург'],
    ['ekaterinburg', 'Екатеринбург'],
    ['екатеринбург', 'Екатеринбург'],
    ['новосибирск', 'Новосибирск'],
    ['казань', 'Казань']
  ];

  let location = '';
  for (const [key, name] of locationMap) {
    if (t.includes(key)) {
      location = name;
      break;
    }
  }

  const remote = /удаленк|remote|удаленно/.test(t);
  const office = /офис/.test(t);
  const hybrid = /гибрид|hybrid/.test(t);
  const fullDay = /полный день/.test(t);
  const partTime = /частичн|part[-\s]?time/.test(t);
  const project = /проектн|project/.test(t);

  return { location, remote, office, hybrid, fullDay, partTime, project };
}

function applyUserFilters(items, filters) {
  let res = items;
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    res = res.filter(v => String(v.area?.name || '').toLowerCase().includes(loc));
  }
  if (filters.remote) {
    res = res.filter(v => {
      const schedule = String(v.schedule?.id || '').toLowerCase();
      const area = String(v.area?.name || '').toLowerCase();
      return schedule.includes('remote') || area.includes('удал');
    });
  }
  if (filters.office) {
    res = res.filter(v => {
      const schedule = String(v.schedule?.id || '').toLowerCase();
      return !schedule.includes('remote');
    });
  }
  if (filters.hybrid) {
    res = res.filter(v => {
      const schedule = String(v.schedule?.id || '').toLowerCase();
      return schedule.includes('flex') || schedule.includes('hybrid');
    });
  }
  if (filters.fullDay) {
    res = res.filter(v => String(v.schedule?.id || '').toLowerCase().includes('fullday'));
  }
  if (filters.partTime) {
    res = res.filter(v => {
      const schedule = String(v.schedule?.id || '').toLowerCase();
      const employment = String(v.employment?.id || '').toLowerCase();
      return schedule.includes('part') || employment.includes('part');
    });
  }
  if (filters.project) {
    res = res.filter(v => String(v.employment?.id || '').toLowerCase().includes('project'));
  }
  return res;
}

function extractB2BFilters(text) {
  const t = String(text || '').toLowerCase();
  const locationMap = [
    ['москва', 'Москва'],
    ['moscow', 'Москва'],
    ['санкт-петербург', 'Санкт-Петербург'],
    ['питер', 'Санкт-Петербург'],
    ['спб', 'Санкт-Петербург'],
    ['екатеринбург', 'Екатеринбург'],
    ['новосибирск', 'Новосибирск'],
    ['казань', 'Казань']
  ];

  let location = '';
  for (const [key, name] of locationMap) {
    if (t.includes(key)) {
      location = name;
      break;
    }
  }

  const remote = /удаленк|remote|удаленно/.test(t);
  const office = /офис/.test(t);
  const hybrid = /гибрид|hybrid/.test(t);

  let level = '';
  if (/junior|интерн|стаж/.test(t)) level = 'junior';
  if (/middle|mid|2\+|2-4|2–4/.test(t)) level = level || 'middle';
  if (/senior|lead|team lead|старш|лид/.test(t)) level = 'senior';

  const avoid = [];
  if (/аутсорс/.test(t)) avoid.push('аутсорс');
  if (/аутстафф/.test(t)) avoid.push('аутстафф');
  if (/агентств/.test(t)) avoid.push('агентство');

  const include = [];
  if (/fintech|финтех|банк|банки|bank/.test(t)) include.push('банк', 'fintech', 'финтех');
  if (/retail|ритейл|ecom|e-commerce|маркетплейс/.test(t)) include.push('ритейл', 'retail', 'e-commerce', 'маркетплейс');
  if (/telecom|телеком/.test(t)) include.push('телеком', 'telecom');
  if (/gamedev|игров/.test(t)) include.push('gamedev', 'игров');
  if (/edtech|образован/.test(t)) include.push('edtech', 'образован');
  if (/health|медиц|medtech/.test(t)) include.push('health', 'медиц', 'medtech');
  if (/gov|гос|госкомп/.test(t)) include.push('гос', 'gov');

  return { location, remote, office, hybrid, level, avoid, include };
}

function applyB2BFilters(items, filters) {
  let res = items;
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    res = res.filter(v => String(v.area?.name || '').toLowerCase().includes(loc));
  }
  if (filters.remote) {
    res = res.filter(v => String(v.schedule?.id || '').toLowerCase().includes('remote'));
  }
  if (filters.office) {
    res = res.filter(v => !String(v.schedule?.id || '').toLowerCase().includes('remote'));
  }
  if (filters.hybrid) {
    res = res.filter(v => String(v.schedule?.id || '').toLowerCase().includes('flex'));
  }
  if (filters.level) {
    res = res.filter(v => {
      const id = String(v.experience?.id || '');
      if (filters.level === 'junior') return id === 'noExperience';
      if (filters.level === 'middle') return id === 'between1And3';
      if (filters.level === 'senior') return id === 'between3And6' || id === 'moreThan6';
      return true;
    });
  }
  if (filters.include?.length) {
    res = res.filter(v => {
      const text = [
        v.name,
        v.employer?.name,
        v.snippet?.requirement,
        v.snippet?.responsibility
      ].filter(Boolean).join(' ').toLowerCase();
      return filters.include.some(word => text.includes(word));
    });
  }
  if (filters.avoid?.length) {
    res = res.filter(v => {
      const text = [
        v.name,
        v.employer?.name,
        v.snippet?.requirement,
        v.snippet?.responsibility
      ].filter(Boolean).join(' ').toLowerCase();
      return !filters.avoid.some(word => text.includes(word));
    });
  }
  return res;
}

function uniqTopSkills(list, limit) {
  const res = [];
  const seen = new Set();
  for (const item of list) {
    const key = String(item.skill || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    res.push(`${item.skill} (${item.count})`);
    if (res.length >= limit) break;
  }
  return res.join(', ');
}

function isStopMatch(vacancy, stoplist) {
  if (!stoplist.length) return false;
  const text = [
    vacancy.name,
    vacancy.snippet?.requirement,
    vacancy.snippet?.responsibility,
    vacancy.employer?.name
  ].filter(Boolean).join(' ');
  return includesAny(text, stoplist);
}

async function handleSearch(ctx, text) {
  const tgId = ctx.from.id;
  const user = getOrCreateUser(tgId);

  console.log(`[search] tg_id=${tgId} text_len=${String(text || '').length}`);
  await ctx.reply('Ищу подходящие вакансии…', { reply_markup: { remove_keyboard: true } });

  const userFilters = extractUserFilters(text);
  const criteria = await parseCriteria(text);
  saveQuery(user.id, 'search', text, criteria);

  const params = criteriaToSearchParams(criteria);
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }

  const stoplist = listStopWords(user.id);
  const desiredSalary = criteria.salary?.amount || 0;
  let filtered = items.filter(v => {
    if (isStopMatch(v, stoplist)) return false;
    if (desiredSalary > 0 && v.salary) {
      const max = Math.max(v.salary.from || 0, v.salary.to || 0);
      if (max > 0 && max < desiredSalary) return false;
    }
    return true;
  });

  filtered = applyUserFilters(filtered, userFilters);

  const ranked = rankVacancies(filtered, criteria, stoplist);
  const all = ranked.map(r => r.vacancy);
  if (!all.length) {
    await ctx.reply('Ничего не нашлось по этим критериям. Попробуй упростить запрос.');
    return;
  }

  searchCache.set(String(tgId), { items: all, index: 0, criteria, rawText: text });
  await sendNextBatch(ctx);
}

async function sendNextBatch(ctx) {
  const tgId = ctx.from.id;
  const entry = searchCache.get(String(tgId));
  if (!entry) {
    await ctx.reply('Нет активного поиска. Нажми «Подбор вакансий».', jobsMenu());
    return;
  }
  const batchSize = 3;
  const slice = entry.items.slice(entry.index, entry.index + batchSize);
  entry.index += slice.length;

  const explanations = await explainFits(slice, entry.criteria);
  const baseIndex = entry.index - slice.length;

  const lines = slice.map((v, i) => {
    const expl = explanations?.[v.id] ? `\nПочему: ${escapeHtml(explanations[v.id])}` : '';
    return `<b>${baseIndex + i + 1}. ${escapeHtml(v.name)}</b>\n` +
      `Компания: ${escapeHtml(v.employer?.name || '—')}\n` +
      `Зарплата: ${escapeHtml(formatSalary(v.salary))}\n` +
      `Город: ${escapeHtml(v.area?.name || '—')}\n` +
      `Ссылка: ${escapeHtml(v.alternate_url || '')}${expl}`;
  });

  await ctx.reply(lines.join('\n\n'), { parse_mode: 'HTML', disable_web_page_preview: true });

  if (entry.index < entry.items.length) {
    await ctx.reply('Еще результаты?', paginationMenu());
  } else {
    searchCache.delete(String(tgId));
    await ctx.reply('Главное меню', menuForAudience(getAudienceFromCtx(ctx), getOrCreateUser(ctx.from.id).id));
  }
}

async function handleMarket(ctx, text) {
  const tgId = ctx.from.id;
  const user = getOrCreateUser(tgId);

  console.log(`[market] tg_id=${tgId} text_len=${String(text || '').length}`);
  await ctx.reply('Собираю срез рынка…', { reply_markup: { remove_keyboard: true } });

  const cacheKey = `market:${(text || '').toLowerCase()}:${process.env.HH_AREA_DEFAULT || '113'}`;
  const cached = getMarketCache(cacheKey);
  if (cached) {
    const cachedStats = JSON.parse(cached.stats_json);
    const comment = await marketComment(cachedStats, text);
    const topSkills = uniqTopSkills(cachedStats.top_skills || [], 5);
    const msg = [
      `<b>Рынок: ${escapeHtml(text)}</b>`,
      `Всего вакансий (оценка): ${cachedStats.total_found}`,
      `В выборке: ${cachedStats.sample_size}`,
      `Удаленка: ~${cachedStats.remote_share}%`,
      cachedStats.salary_from_avg ? `Средняя \"от\": ${cachedStats.salary_from_avg} RUR` : 'Средняя \"от\": —',
      cachedStats.salary_to_avg ? `Средняя \"до\": ${cachedStats.salary_to_avg} RUR` : 'Средняя \"до\": —',
      topSkills ? `Топ навыков: ${escapeHtml(topSkills)}` : 'Топ навыков: —',
      comment ? `Комментарий: ${escapeHtml(comment)}` : ''
    ].filter(Boolean).join('\n');

    await ctx.reply(msg, { parse_mode: 'HTML' });
    await ctx.reply('Главное меню', menuForAudience(getAudienceFromCtx(ctx), getOrCreateUser(ctx.from.id).id));
    return;
  }

  const params = { text, area: process.env.HH_AREA_DEFAULT || '113' };
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }

  const stats = computeMarketStats(items, first.found || items.length);
  saveMarketCache(cacheKey, stats);
  saveQuery(user.id, 'market', text, stats);

  const comment = await marketComment(stats, text);
  const topSkills = uniqTopSkills(stats.top_skills || [], 5);

  const msg = [
    `<b>Рынок: ${escapeHtml(text)}</b>`,
    `Всего вакансий (оценка): ${stats.total_found}`,
    `В выборке: ${stats.sample_size}`,
    `Удаленка: ~${stats.remote_share}%`,
    stats.salary_from_avg ? `Средняя "от": ${stats.salary_from_avg} RUR` : 'Средняя "от": —',
    stats.salary_to_avg ? `Средняя "до": ${stats.salary_to_avg} RUR` : 'Средняя "до": —',
    topSkills ? `Топ навыков: ${escapeHtml(topSkills)}` : 'Топ навыков: —',
    comment ? `Комментарий: ${escapeHtml(comment)}` : ''
  ].filter(Boolean).join('\n');

  await ctx.reply(msg, { parse_mode: 'HTML' });
  await ctx.reply('Главное меню', menuForAudience(getAudienceFromCtx(ctx), getOrCreateUser(ctx.from.id).id));
}

async function handleB2BMarket(ctx, text) {
  const user = getOrCreateUser(ctx.from.id);
  const limit = canUseB2B(user);
  if (!limit.allowed) {
    await ctx.reply(b2bPaywallMessage());
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  await ctx.reply('Собираю аналитику рынка…', { reply_markup: { remove_keyboard: true } });
  const cacheKey = `b2b:market:${String(text || '').toLowerCase()}:${process.env.HH_AREA_DEFAULT || '113'}`;
  const cached = getMarketCache(cacheKey);
  const filters = extractB2BFilters(text);
  if (cached) {
    const stats = JSON.parse(cached.stats_json);
    const topSkills = uniqTopSkills(stats.top_skills || [], 7);
    const topCities = (stats.top_cities || []).map(c => `${c.city} (${c.count})`).join(', ');
    const levels = stats.levels || {};
    const trend = stats.trend_7d || {};
    const msg = [
      `<b>Рынок: ${escapeHtml(text)}</b>`,
      `Вакансий (оценка): ${stats.total_found}`,
      `Удаленка: ~${stats.remote_share}%`,
      stats.salary_from_avg ? `Средняя "от": ${stats.salary_from_avg} RUR` : 'Средняя "от": —',
      stats.salary_to_avg ? `Средняя "до": ${stats.salary_to_avg} RUR` : 'Средняя "до": —',
      topCities ? `Топ городов: ${escapeHtml(topCities)}` : 'Топ городов: —',
      `Уровни: junior ${levels.junior || 0} / middle ${levels.middle || 0} / senior ${levels.senior || 0}`,
      Number.isFinite(trend.delta_percent) ? `Тренд 7д: ${trend.delta_percent >= 0 ? '+' : ''}${trend.delta_percent}%` : '',
      topSkills ? `Топ навыков: ${escapeHtml(topSkills)}` : 'Топ навыков: —'
    ].filter(Boolean).join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
    incrementB2BUsage(user.id, limit.dayKey);
    b2bReportCache.set(String(ctx.from.id), { title: `Рынок: ${text}`, body: stripHtml(msg) });
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  const params = { text, area: process.env.HH_AREA_DEFAULT || '113' };
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }
  items = applyB2BFilters(items, filters);
  const stats = computeMarketStats(items, first.found || items.length);
  saveMarketCache(cacheKey, stats);
  const topSkills = uniqTopSkills(stats.top_skills || [], 7);
  const topCities = (stats.top_cities || []).map(c => `${c.city} (${c.count})`).join(', ');
  const levels = stats.levels || {};
  const trend = stats.trend_7d || {};
  const msg = [
    `<b>Рынок: ${escapeHtml(text)}</b>`,
    `Вакансий (оценка): ${stats.total_found}`,
    `Удаленка: ~${stats.remote_share}%`,
    stats.salary_from_avg ? `Средняя "от": ${stats.salary_from_avg} RUR` : 'Средняя "от": —',
    stats.salary_to_avg ? `Средняя "до": ${stats.salary_to_avg} RUR` : 'Средняя "до": —',
    topCities ? `Топ городов: ${escapeHtml(topCities)}` : 'Топ городов: —',
    `Уровни: junior ${levels.junior || 0} / middle ${levels.middle || 0} / senior ${levels.senior || 0}`,
    Number.isFinite(trend.delta_percent) ? `Тренд 7д: ${trend.delta_percent >= 0 ? '+' : ''}${trend.delta_percent}%` : '',
    topSkills ? `Топ навыков: ${escapeHtml(topSkills)}` : 'Топ навыков: —'
  ].filter(Boolean).join('\n');
  await ctx.reply(msg, { parse_mode: 'HTML' });
  incrementB2BUsage(user.id, limit.dayKey);
  b2bReportCache.set(String(ctx.from.id), { title: `Рынок: ${text}`, body: stripHtml(msg) });
  await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
}

async function handleB2BCompetitors(ctx, text) {
  const user = getOrCreateUser(ctx.from.id);
  const limit = canUseB2B(user);
  if (!limit.allowed) {
    await ctx.reply(b2bPaywallMessage());
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  await ctx.reply('Собираю список конкурентов…', { reply_markup: { remove_keyboard: true } });
  const cacheKey = `b2b:comp:${String(text || '').toLowerCase()}:${process.env.HH_AREA_DEFAULT || '113'}`;
  const cached = getMarketCache(cacheKey);
  const filters = extractB2BFilters(text);
  if (cached) {
    const data = JSON.parse(cached.stats_json);
    const lines = (data.lines || []).join('\n');
    const msg = [
      `<b>Конкуренты: ${escapeHtml(text)}</b>`,
      lines.length ? lines : 'Нет данных'
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
    incrementB2BUsage(user.id, limit.dayKey);
    b2bReportCache.set(String(ctx.from.id), { title: `Конкуренты: ${text}`, body: stripHtml(msg) });
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  const params = { text, area: process.env.HH_AREA_DEFAULT || '113' };
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }
  items = applyB2BFilters(items, filters);
  const counts = new Map();
  for (const v of items) {
    const name = v.employer?.name || '—';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const top = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const lines = top.map((t, i) => `${i + 1}. ${t[0]} — ${t[1]}`);
  saveMarketCache(cacheKey, { lines });
  const msg = [
    `<b>Конкуренты: ${escapeHtml(text)}</b>`,
    lines.length ? lines.join('\n') : 'Нет данных'
  ].join('\n');
  await ctx.reply(msg, { parse_mode: 'HTML' });
  incrementB2BUsage(user.id, limit.dayKey);
  b2bReportCache.set(String(ctx.from.id), { title: `Конкуренты: ${text}`, body: stripHtml(msg) });
  await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
}

async function handleB2BTemplate(ctx, text) {
  const user = getOrCreateUser(ctx.from.id);
  const limit = canUseB2B(user);
  if (!limit.allowed) {
    await ctx.reply(b2bPaywallMessage());
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  await ctx.reply('Формирую шаблон вакансии…', { reply_markup: { remove_keyboard: true } });
  const cacheKey = `b2b:template:${String(text || '').toLowerCase()}:${process.env.HH_AREA_DEFAULT || '113'}`;
  const cached = getMarketCache(cacheKey);
  const filters = extractB2BFilters(text);
  if (cached) {
    const stats = JSON.parse(cached.stats_json);
    const topSkills = uniqTopSkills(stats.top_skills || [], 6);
    const msg = [
      `<b>Шаблон вакансии: ${escapeHtml(text)}</b>`,
      stats.salary_from_avg && stats.salary_to_avg
        ? `Рекомендуемая вилка: ${stats.salary_from_avg}–${stats.salary_to_avg} RUR`
        : 'Рекомендуемая вилка: —',
      topSkills ? `Ключевые требования: ${escapeHtml(topSkills)}` : 'Ключевые требования: —'
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
    incrementB2BUsage(user.id, limit.dayKey);
    b2bReportCache.set(String(ctx.from.id), { title: `Шаблон вакансии: ${text}`, body: stripHtml(msg) });
    await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
    return;
  }
  const params = { text, area: process.env.HH_AREA_DEFAULT || '113' };
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }
  items = applyB2BFilters(items, filters);
  const stats = computeMarketStats(items, first.found || items.length);
  saveMarketCache(cacheKey, stats);
  const topSkills = uniqTopSkills(stats.top_skills || [], 6);
  const msg = [
    `<b>Шаблон вакансии: ${escapeHtml(text)}</b>`,
    stats.salary_from_avg && stats.salary_to_avg
      ? `Рекомендуемая вилка: ${stats.salary_from_avg}–${stats.salary_to_avg} RUR`
      : 'Рекомендуемая вилка: —',
    topSkills ? `Ключевые требования: ${escapeHtml(topSkills)}` : 'Ключевые требования: —'
  ].join('\n');
  await ctx.reply(msg, { parse_mode: 'HTML' });
  incrementB2BUsage(user.id, limit.dayKey);
  b2bReportCache.set(String(ctx.from.id), { title: `Шаблон вакансии: ${text}`, body: stripHtml(msg) });
  await ctx.reply('B2B меню', b2bMenuForAudience(getAudienceFromCtx(ctx)));
}

async function handleStoplist(ctx) {
  const user = getOrCreateUser(ctx.from.id);
  const list = listStopWords(user.id);
  const text = list.length ? `Текущий стоп‑лист: ${list.join(', ')}` : 'Стоп‑лист пуст.';
  await ctx.reply(text, stoplistMenu());
}

function formatDigestSubscription(subscription) {
  const status = subscription.active ? 'Активна' : 'Отключена';
  return [
    `<b>#${subscription.id}</b> • ${escapeHtml(status)}`,
    `Запрос: ${escapeHtml(subscription.raw_query)}`,
    `Последняя отправка: ${escapeHtml(formatDateTime(subscription.last_success_at))}`,
    `Ошибка: ${escapeHtml(subscription.last_error || '—')}`
  ].join('\n');
}

async function handleDigestMenu(ctx) {
  getOrCreateUser(ctx.from.id);
  setState(ctx.from.id, STATE.IDLE);
  await ctx.reply('Управление ежедневными дайджестами вакансий.', digestMenu());
}

async function handleListDigestSubscriptions(ctx) {
  const user = getOrCreateUser(ctx.from.id);
  const items = listUserJobDigestSubscriptions(user.id);
  if (!items.length) {
    await ctx.reply('Подписок пока нет. Нажми «Создать дайджест».', digestMenu());
    return;
  }
  const text = items.map(formatDigestSubscription).join('\n\n────────\n\n');
  await ctx.reply(text, { parse_mode: 'HTML', ...digestMenu() });
}

async function createDigestSubscription(ctx, rawQuery, criteria = null) {
  const user = getOrCreateUser(ctx.from.id);
  const cleanQuery = String(rawQuery || '').trim();
  if (!cleanQuery) {
    await ctx.reply('Запрос пустой. Пример: «Backend, Node.js, удаленка, от 200к».', digestMenu());
    return;
  }
  const resolvedCriteria = criteria || await parseCriteria(cleanQuery);
  const subscription = upsertJobDigestSubscription(
    user.id,
    ctx.from.id,
    cleanQuery,
    resolvedCriteria,
    {
      cadence: 'daily',
      timezone: process.env.TZ || 'Europe/Moscow',
      botKey: getAudienceFromCtx(ctx) === BOT_AUDIENCE.COMBINED ? 'combined' : 'jobs'
    }
  );
  await ctx.reply(`Дайджест сохранен.\n\n${formatDigestSubscription(subscription)}`, { parse_mode: 'HTML', ...digestMenu() });
}

function parseDigestEditInput(text) {
  const value = String(text || '').trim();
  const match = value.match(/^(\d+)\s*[:\-]\s*(.+)$/);
  if (match) {
    return { subscriptionId: Number(match[1]), rawQuery: match[2].trim() };
  }
  const firstSpace = value.indexOf(' ');
  if (firstSpace > 0) {
    const maybeId = Number(value.slice(0, firstSpace));
    const rawQuery = value.slice(firstSpace + 1).trim();
    if (Number.isFinite(maybeId) && maybeId > 0 && rawQuery) {
      return { subscriptionId: maybeId, rawQuery };
    }
  }
  return null;
}

async function handleEditDigestSubscription(ctx, text) {
  const user = getOrCreateUser(ctx.from.id);
  const parsed = parseDigestEditInput(text);
  if (!parsed) {
    await ctx.reply('Формат: `ID: новый запрос`.\nПример: `12: Backend, Node.js, Москва`', {
      parse_mode: 'Markdown',
      ...digestMenu()
    });
    return;
  }
  const criteria = await parseCriteria(parsed.rawQuery);
  const updated = updateUserJobDigestSubscription(user.id, parsed.subscriptionId, {
    raw_query: parsed.rawQuery,
    criteria_json: criteria,
    active: 1
  });
  if (!updated) {
    await ctx.reply('Подписка не найдена.', digestMenu());
    return;
  }
  await ctx.reply(`Подписка обновлена.\n\n${formatDigestSubscription(updated)}`, { parse_mode: 'HTML', ...digestMenu() });
}

async function handleDisableDigestSubscription(ctx, text) {
  const user = getOrCreateUser(ctx.from.id);
  const subscriptionId = Number(String(text || '').trim());
  if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) {
    await ctx.reply('Укажи числовой ID подписки. Пример: `12`', {
      parse_mode: 'Markdown',
      ...digestMenu()
    });
    return;
  }
  const updated = deactivateUserJobDigestSubscription(user.id, subscriptionId);
  if (!updated) {
    await ctx.reply('Подписка не найдена.', digestMenu());
    return;
  }
  await ctx.reply(`Подписка отключена.\n\n${formatDigestSubscription(updated)}`, { parse_mode: 'HTML', ...digestMenu() });
}

function startBot(options = {}) {
  const audience = options.audience || BOT_AUDIENCE.COMBINED;
  const botToken = options.token || process.env.TELEGRAM_BOT_TOKEN;
  const brandName = options.brandName || BRAND_NAME;
  const botLabel = audience === BOT_AUDIENCE.HR ? 'HR bot' : audience === BOT_AUDIENCE.JOBS ? 'Jobs bot' : 'Combined bot';

  if (!botToken) {
    throw new Error(`Telegram token is missing for ${botLabel}`);
  }

  const bot = new Telegraf(botToken);
  bot.use(async (ctx, next) => {
    ctx.state.botAudience = audience;
    await next();
  });

  bot.command('status', async ctx => {
    const hh = getHhConnectionStatus();
    const uptimeSec = Math.floor((Date.now() - STARTED_AT) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptime = `${hours}h ${minutes}m ${seconds}s`;
    const msg = [
      `<b>${escapeHtml(brandName)} статус</b>`,
      `Audience: ${audience}`,
      `Uptime: ${uptime}`,
      `HH area: ${process.env.HH_AREA_DEFAULT || '113'}`,
      `HH cache TTL: ${process.env.HH_CACHE_TTL_MS || '21600000'}`,
      `HH connected: ${hh.connected ? 'yes' : 'no'}`,
      `HH token expires: ${hh.expires_at || 'n/a'}`,
      `HH last success: ${hh.last_success_at || 'n/a'}`,
      `LLM cache TTL: ${process.env.LLM_CACHE_TTL_MS || '86400000'}`,
      `USE_MOCKS: ${String(process.env.USE_MOCKS || 'false')}`,
      `DB: ${process.env.DB_PATH ? 'configured' : 'data/db.sqlite'}`
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  bot.command('reset', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    searchCache.delete(String(ctx.from.id));
    const user = getOrCreateUser(ctx.from.id);
    await ctx.reply('Состояние сброшено. Главное меню:', menuForAudience(audience, user.id));
  });

  bot.command('help', async ctx => {
    const isJobs = isJobsAudience(audience);
    const isHr = isHrAudience(audience);
    const msg = [
      `<b>${escapeHtml(brandName)}</b>`,
      isJobs && !isHr ? 'Бот для соискателей: поиск вакансий, рынок навыков и дайджесты.' : '',
      isHr && !isJobs ? 'Бот для HR: рынок ролей, конкуренты, шаблоны вакансий и экспорт.' : '',
      '',
      isJobs ? '<b>Соискателю</b>' : '',
      isJobs ? '• Поиск вакансий по роли, навыкам, зарплате и формату работы' : '',
      isJobs ? '• Стоп-слова и ежедневные дайджесты новых вакансий' : '',
      isHr ? '<b>HR / Recruiter</b>' : '',
      isHr ? '• Рынок роли, конкуренты, шаблон вакансии, экспорт отчета' : '',
      isHr ? '• Тарифы и лимиты для B2B-режима' : '',
      '',
      `Команды: /start, /help${isJobs ? ', /digest' : ''}, /status, /reset, /health, /debug`
    ].filter(Boolean).join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  bot.command('digest', async ctx => {
    if (!isJobsAudience(audience)) {
      await ctx.reply('В этом боте дайджесты недоступны.');
      return;
    }
    await handleDigestMenu(ctx);
  });

  bot.command('id', async ctx => {
    const chat = ctx.chat;
    await ctx.reply(`chat_id: ${chat.id}`);
  });

  bot.command('admin', async ctx => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply('Недостаточно прав.');
      return;
    }
    const items = listRecentQueries(10);
    if (!items.length) {
      await ctx.reply('Нет запросов.');
      return;
    }
    const lines = items.map(q => {
      return `#${q.id} [${q.type}] tg:${q.tg_id} ${q.created_at}\n${q.raw_text}`;
    });
    await ctx.reply(lines.join('\n\n'));
  });

  bot.command('debug', async ctx => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply('Недостаточно прав.');
      return;
    }
    const hh = getHhConnectionStatus();
    const msg = [
      `<b>${escapeHtml(brandName)} debug</b>`,
      `Audience: ${audience}`,
      `NODE_ENV: ${process.env.NODE_ENV || 'development'}`,
      `HH area: ${process.env.HH_AREA_DEFAULT || '113'}`,
      `HH cache TTL: ${process.env.HH_CACHE_TTL_MS || '21600000'}`,
      `HH connected: ${hh.connected ? 'yes' : 'no'}`,
      `HH token expires: ${hh.expires_at || 'n/a'}`,
      `HH last success: ${hh.last_success_at || 'n/a'}`,
      `HH last error: ${hh.last_error || 'n/a'}`,
      `LLM cache TTL: ${process.env.LLM_CACHE_TTL_MS || '86400000'}`,
      `USE_MOCKS: ${String(process.env.USE_MOCKS || 'false')}`
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  bot.command('health', async ctx => {
    await ctx.reply('ok');
  });

  bot.start(async ctx => {
    const startPayload = getStartPayload(ctx);
    if (startPayload.startsWith('login_')) {
      const requestId = startPayload.slice('login_'.length).trim();
      const ok = await completeTelegramWebLogin(requestId, {
        id: String(ctx.from.id || ''),
        first_name: ctx.from.first_name || '',
        last_name: ctx.from.last_name || '',
        username: ctx.from.username || '',
        language_code: ctx.from.language_code || ''
      });
      await ctx.reply(
        ok
          ? 'Вход для веба подтверждён. Вернитесь на страницу GridAI, авторизация завершится автоматически.'
          : 'Ссылка для входа недействительна или устарела. Запустите вход с сайта ещё раз.'
      );
      return;
    }
    const user = getOrCreateUser(ctx.from.id);
    const consentKey = getConsentBotKey(audience);
    if (!hasUserConsent(user.id, consentKey)) {
      await replyStartPrompt(ctx, audience, user, brandName);
      return;
    }
    setState(ctx.from.id, STATE.IDLE);
    await ctx.reply(getStartReadyMessage(audience, brandName), menuForAudience(audience, user.id));
  });

  bot.action(START_CALLBACK.DATA, async ctx => {
    await ctx.answerCbQuery(getConsentAlert(), { show_alert: true });
  });

  bot.action(START_CALLBACK.CONSENT, async ctx => {
    const user = getOrCreateUser(ctx.from.id);
    markUserConsent(user.id, getConsentBotKey(audience));
    setState(ctx.from.id, STATE.IDLE);
    await ctx.answerCbQuery('Доступ открыт');
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch (_) {}
    await ctx.reply(getStartReadyMessage(audience, brandName), menuForAudience(audience, user.id));
  });

  bot.hears('Подбор вакансий', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.AWAIT_SEARCH);
    await ctx.reply('Опиши запрос: роль, опыт, навыки, зарплата.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Рынок навыков', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.AWAIT_MARKET);
    await ctx.reply('Введи роль или навык для анализа.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Мои стоп-слова', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.IDLE);
    await handleStoplist(ctx);
  });

  bot.hears('Мои дайджесты', async ctx => {
    if (!isJobsAudience(audience)) return;
    await handleDigestMenu(ctx);
  });

  bot.hears('Создать дайджест', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.DIGEST_CREATE);
    await ctx.reply('Отправь запрос для ежедневного дайджеста.\nПример: Backend, Node.js, удаленка, от 200к', {
      reply_markup: { remove_keyboard: true }
    });
  });

  bot.hears('Мои подписки', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.IDLE);
    await handleListDigestSubscriptions(ctx);
  });

  bot.hears('Изменить дайджест', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.DIGEST_EDIT);
    await ctx.reply('Отправь в формате: ID: новый запрос\nПример: 12: Backend, Node.js, Москва', {
      reply_markup: { remove_keyboard: true }
    });
  });

  bot.hears('Отключить дайджест', async ctx => {
    if (!isJobsAudience(audience)) return;
    setState(ctx.from.id, STATE.DIGEST_DISABLE);
    await ctx.reply('Отправь ID подписки, которую нужно отключить.\nПример: 12', {
      reply_markup: { remove_keyboard: true }
    });
  });

  bot.hears('B2B Аналитика', async ctx => {
    if (!isHrAudience(audience)) return;
    const user = getOrCreateUser(ctx.from.id);
    setUserMode(user.id, 'b2b');
    setState(ctx.from.id, STATE.IDLE);
    await ctx.reply('Режим HR‑аналитики включен.', b2bMenuForAudience(audience));
  });

  bot.hears('Тарифы и лимиты', async ctx => {
    const user = getOrCreateUser(ctx.from.id);
    const { used } = canUseB2B(user);
    const msg = [
      b2bPricingMessage(),
      '',
      `Сегодня использовано: ${used}/${B2B_DAILY_LIMIT}`
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
    await ctx.reply('B2B меню', b2bMenuForAudience(audience));
  });

  bot.hears('Экспорт отчета', async ctx => {
    const cached = b2bReportCache.get(String(ctx.from.id));
    if (!cached) {
      await ctx.reply('Сначала сформируйте отчет (рынок/конкуренты/шаблон).', b2bMenuForAudience(audience));
      return;
    }
    const content = `${cached.title}\n\n${cached.body}`;
    const filename = `gridai-report-${Date.now()}.txt`;
    const pdfBuffer = await buildReportPdf(cached.title, cached.body);
    const pdfName = `gridai-report-${Date.now()}.pdf`;
    await ctx.replyWithDocument({ source: pdfBuffer, filename: pdfName }, { caption: 'Экспорт отчета (PDF)' });
    await ctx.replyWithDocument({ source: Buffer.from(content, 'utf8'), filename }, { caption: 'Экспорт отчета (TXT)' });
    await ctx.reply('B2B меню', b2bMenuForAudience(audience));
  });

  bot.hears('Соискательский режим', async ctx => {
    if (audience !== BOT_AUDIENCE.COMBINED) return;
    const user = getOrCreateUser(ctx.from.id);
    setUserMode(user.id, 'jobseeker');
    setState(ctx.from.id, STATE.IDLE);
    await ctx.reply('Соискательский режим включен.', jobsMenu());
  });

  bot.hears('Добавить стоп-слово', async ctx => {
    setState(ctx.from.id, STATE.STOP_ADD);
    await ctx.reply('Отправь слово или компанию (можно через запятую).');
  });

  bot.hears('Удалить стоп-слово', async ctx => {
    setState(ctx.from.id, STATE.STOP_REMOVE);
    await ctx.reply('Отправь слово или компанию для удаления (можно через запятую).');
  });

  bot.hears('Назад', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    const user = getOrCreateUser(ctx.from.id);
    await ctx.reply('Главное меню', menuForAudience(audience, user.id));
  });

  bot.hears('Главное меню', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    searchCache.delete(String(ctx.from.id));
    const user = getOrCreateUser(ctx.from.id);
    await ctx.reply('Главное меню', menuForAudience(audience, user.id));
  });

  bot.hears('Показать еще', async ctx => {
    await sendNextBatch(ctx);
  });

  bot.hears('Сохранить запрос', async ctx => {
    const tgId = ctx.from.id;
    const entry = searchCache.get(String(tgId));
    if (!entry) {
      const user = getOrCreateUser(tgId);
      await ctx.reply('Нет активного поиска для сохранения.', menuForAudience(audience, user.id));
      return;
    }
    savedQueries.set(String(tgId), entry);
    const user = getOrCreateUser(tgId);
    await ctx.reply('Запрос сохранен. Используй команду /repeat, чтобы повторить.', menuForAudience(audience, user.id));
  });

  bot.hears('Подписаться на дайджест', async ctx => {
    if (!isJobsAudience(audience)) return;
    const tgId = ctx.from.id;
    const entry = searchCache.get(String(tgId));
    const user = getOrCreateUser(tgId);
    if (!entry?.rawText || !entry?.criteria) {
      await ctx.reply('Нет активного поиска для подписки. Сначала сделайте поиск вакансий.', menuForAudience(audience, user.id));
      return;
    }
    const subscription = upsertJobDigestSubscription(
      user.id,
      tgId,
      entry.rawText,
      entry.criteria,
      { cadence: 'daily', timezone: process.env.TZ || 'Europe/Moscow', botKey: audience === BOT_AUDIENCE.COMBINED ? 'combined' : 'jobs' }
    );
    await ctx.reply(`Дайджест сохранен.\n\n${formatDigestSubscription(subscription)}`, { parse_mode: 'HTML', ...digestMenu() });
  });

  bot.command('repeat', async ctx => {
    const tgId = ctx.from.id;
    const entry = savedQueries.get(String(tgId));
    if (!entry) {
      await ctx.reply('Нет сохраненного запроса.');
      return;
    }
    searchCache.set(String(tgId), { ...entry, index: 0 });
    await sendNextBatch(ctx);
  });

  bot.hears('Рынок роли', async ctx => {
    setState(ctx.from.id, STATE.B2B_MARKET);
    await ctx.reply('Введите роль или навык для рынка.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Конкуренты', async ctx => {
    setState(ctx.from.id, STATE.B2B_COMP);
    await ctx.reply('Введите роль или навык для конкурентов.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Шаблон вакансии', async ctx => {
    setState(ctx.from.id, STATE.B2B_TEMPLATE);
    await ctx.reply('Введите роль и уровень (например: Backend Middle, Москва).', { reply_markup: { remove_keyboard: true } });
  });

  bot.on('text', async ctx => {
    const text = ctx.message.text?.trim();
    if (!text) return;

    const state = getState(ctx.from.id);
    if (!rateLimitOk(ctx.from.id)) {
      await ctx.reply('Слишком много запросов. Подожди минуту и попробуй снова.');
      return;
    }

    try {
      if (state === STATE.DIGEST_DISABLE) {
        setState(ctx.from.id, STATE.IDLE);
        await handleDisableDigestSubscription(ctx, text);
        return;
      }
    } catch (err) {
      console.error('[bot:error]', err);
      await ctx.reply('Не удалось обновить подписку на дайджест. Попробуйте позже.');
      const user = getOrCreateUser(ctx.from.id);
      await ctx.reply('Главное меню', menuForAudience(audience, user.id));
      return;
    }

    const hasLetters = /[a-zа-я]/i.test(text);
    if (!text || text.length < 3 || !hasLetters) {
      await ctx.reply('Запрос слишком короткий. Пример: «Backend, 3+ года, Node.js, от 200к».');
      return;
    }

    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    const keywords = [
      'backend', 'frontend', 'fullstack', 'qa', 'аналит', 'аналитик', 'data',
      'product', 'manager', 'продакт', 'менеджер', 'designer', 'дизайнер',
      'разработчик', 'инженер', 'dev', 'node', 'python', 'java', 'go', 'react',
      'sql', 'ml', 'mobile', 'android', 'ios', 'flutter', 'bitrix', 'bitrix24'
    ];
    const hasKeyword = keywords.some(k => text.toLowerCase().includes(k));
    if (!hasKeyword && tokens.length <= 1) {
      await ctx.reply('Запрос выглядит случайным. Пример: «Backend, 3+ года, Node.js, от 200к».');
      return;
    }

    try {
      if (state === STATE.AWAIT_SEARCH) {
        setState(ctx.from.id, STATE.IDLE);
        await handleSearch(ctx, text);
        return;
      }
      if (state === STATE.AWAIT_MARKET) {
        setState(ctx.from.id, STATE.IDLE);
        await handleMarket(ctx, text);
        return;
      }
      if (state === STATE.DIGEST_CREATE) {
        setState(ctx.from.id, STATE.IDLE);
        await createDigestSubscription(ctx, text);
        return;
      }
      if (state === STATE.DIGEST_EDIT) {
        setState(ctx.from.id, STATE.IDLE);
        await handleEditDigestSubscription(ctx, text);
        return;
      }
      if (state === STATE.B2B_MARKET) {
        setState(ctx.from.id, STATE.IDLE);
        await handleB2BMarket(ctx, text);
        return;
      }
      if (state === STATE.B2B_COMP) {
        setState(ctx.from.id, STATE.IDLE);
        await handleB2BCompetitors(ctx, text);
        return;
      }
      if (state === STATE.B2B_TEMPLATE) {
        setState(ctx.from.id, STATE.IDLE);
        await handleB2BTemplate(ctx, text);
        return;
      }
      if (state === STATE.STOP_ADD) {
        const user = getOrCreateUser(ctx.from.id);
        text.split(',').map(s => s.trim()).filter(Boolean).forEach(w => addStopWord(user.id, w));
        await handleStoplist(ctx);
        return;
      }
      if (state === STATE.STOP_REMOVE) {
        const user = getOrCreateUser(ctx.from.id);
        text.split(',').map(s => s.trim()).filter(Boolean).forEach(w => removeStopWord(user.id, w));
        await handleStoplist(ctx);
        return;
      }
    } catch (err) {
      console.error('[bot:error]', err);
      await ctx.reply('Похоже, есть проблема с сетью или API. Попробуйте позже.');
      const user = getOrCreateUser(ctx.from.id);
      await ctx.reply('Главное меню', menuForAudience(audience, user.id));
    }
  });

  bot.catch(err => {
    console.error('[bot:unhandled]', err);
  });

  bot.launch();
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = {
  startBot
};
