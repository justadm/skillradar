const { Telegraf, Markup } = require('telegraf');
const { parseCriteria, explainFits, marketComment } = require('../llm/openai');
const { searchVacancies } = require('../hh/client');
const { criteriaToSearchParams } = require('../hh/mappers');
const { rankVacancies } = require('../score/scoring');
const { computeMarketStats } = require('../market/market');
const { getOrCreateUser, listStopWords, addStopWord, removeStopWord, saveQuery, getMarketCache, saveMarketCache, listRecentQueries } = require('../db');
const { escapeHtml, includesAny } = require('../utils/text');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const STARTED_AT = Date.now();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 10);
const ADMIN_TG_IDS = String(process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const rateBuckets = new Map();
const searchCache = new Map();

const STATE = {
  IDLE: 'idle',
  AWAIT_SEARCH: 'await_search',
  AWAIT_MARKET: 'await_market',
  STOP_ADD: 'stop_add',
  STOP_REMOVE: 'stop_remove'
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

function mainMenu() {
  return Markup.keyboard([
    ['Подбор вакансий', 'Рынок навыков'],
    ['Мои стоп-слова']
  ]).resize();
}

function stoplistMenu() {
  return Markup.keyboard([
    ['Добавить стоп-слово', 'Удалить стоп-слово'],
    ['Главное меню']
  ]).resize();
}

function paginationMenu() {
  return Markup.keyboard([
    ['Показать еще'],
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
  const fullDay = /полный день/.test(t);

  return { location, remote, office, fullDay };
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
  if (filters.fullDay) {
    res = res.filter(v => String(v.schedule?.id || '').toLowerCase().includes('fullday'));
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

  console.log(`[search] tg_id=${tgId} text="${text}"`);
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

  searchCache.set(String(tgId), { items: all, index: 0, criteria });
  await sendNextBatch(ctx);
}

async function sendNextBatch(ctx) {
  const tgId = ctx.from.id;
  const entry = searchCache.get(String(tgId));
  if (!entry) {
    await ctx.reply('Нет активного поиска. Нажми «Подбор вакансий».', mainMenu());
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
    await ctx.reply('Главное меню', mainMenu());
  }
}

async function handleMarket(ctx, text) {
  const tgId = ctx.from.id;
  const user = getOrCreateUser(tgId);

  console.log(`[market] tg_id=${tgId} text="${text}"`);
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
    await ctx.reply('Главное меню', mainMenu());
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
  await ctx.reply('Главное меню', mainMenu());
}

async function handleStoplist(ctx) {
  const user = getOrCreateUser(ctx.from.id);
  const list = listStopWords(user.id);
  const text = list.length ? `Текущий стоп‑лист: ${list.join(', ')}` : 'Стоп‑лист пуст.';
  await ctx.reply(text, stoplistMenu());
}

function startBot() {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing');
  }

  const bot = new Telegraf(BOT_TOKEN);

  bot.command('status', async ctx => {
    const uptimeSec = Math.floor((Date.now() - STARTED_AT) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptime = `${hours}h ${minutes}m ${seconds}s`;
    const msg = [
      '<b>SkillRadar статус</b>',
      `Uptime: ${uptime}`,
      `HH area: ${process.env.HH_AREA_DEFAULT || '113'}`,
      `HH cache TTL: ${process.env.HH_CACHE_TTL_MS || '21600000'}`,
      `LLM cache TTL: ${process.env.LLM_CACHE_TTL_MS || '86400000'}`,
      `USE_MOCKS: ${String(process.env.USE_MOCKS || 'false')}`,
      `DB: ${process.env.DB_PATH ? 'configured' : 'data/db.sqlite'}`
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  bot.command('reset', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    searchCache.delete(String(ctx.from.id));
    await ctx.reply('Состояние сброшено. Главное меню:', mainMenu());
  });

  bot.command('help', async ctx => {
    const msg = [
      '<b>Как формулировать запрос</b>',
      'Пример: «Backend, 3+ года, Node.js/SQL, от 200к».',
      '',
      '<b>Что можно указать</b>',
      '• Роль (backend/frontend/QA/аналитик)',
      '• Опыт (junior/middle/senior или годы)',
      '• Навыки (React, Node.js, SQL)',
      '• Зарплата (от/до, в рублях)',
      '• Локация/формат (Москва/СПб, удаленка/офис)',
      '',
      'Команды: /start, /help, /status, /reset'
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
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

  bot.start(async ctx => {
    getOrCreateUser(ctx.from.id);
    setState(ctx.from.id, STATE.IDLE);
    await ctx.reply('Привет! Я помогу подобрать вакансии и показать рынок.', mainMenu());
  });

  bot.hears('Подбор вакансий', async ctx => {
    setState(ctx.from.id, STATE.AWAIT_SEARCH);
    await ctx.reply('Опиши запрос: роль, опыт, навыки, зарплата.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Рынок навыков', async ctx => {
    setState(ctx.from.id, STATE.AWAIT_MARKET);
    await ctx.reply('Введи роль или навык для анализа.', { reply_markup: { remove_keyboard: true } });
  });

  bot.hears('Мои стоп-слова', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    await handleStoplist(ctx);
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
    await ctx.reply('Главное меню', mainMenu());
  });

  bot.hears('Главное меню', async ctx => {
    setState(ctx.from.id, STATE.IDLE);
    searchCache.delete(String(ctx.from.id));
    await ctx.reply('Главное меню', mainMenu());
  });

  bot.hears('Показать еще', async ctx => {
    await sendNextBatch(ctx);
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
      await ctx.reply('Главное меню', mainMenu());
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
