const { Telegraf, Markup } = require('telegraf');
const { parseCriteria, explainFits, marketComment } = require('../llm/openai');
const { searchVacancies } = require('../hh/client');
const { criteriaToSearchParams } = require('../hh/mappers');
const { rankVacancies } = require('../score/scoring');
const { computeMarketStats } = require('../market/market');
const { getOrCreateUser, listStopWords, addStopWord, removeStopWord, saveQuery } = require('../db');
const { escapeHtml, includesAny } = require('../utils/text');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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

function mainMenu() {
  return Markup.keyboard([
    ['Подбор вакансий', 'Рынок навыков'],
    ['Мои стоп-слова']
  ]).resize();
}

function stoplistMenu() {
  return Markup.keyboard([
    ['Добавить стоп-слово', 'Удалить стоп-слово'],
    ['Назад']
  ]).resize();
}

function formatSalary(salary) {
  if (!salary) return 'не указана';
  const from = salary.from ? `от ${salary.from}` : '';
  const to = salary.to ? `до ${salary.to}` : '';
  const sep = from && to ? ' ' : '';
  return `${from}${sep}${to} ${salary.currency || ''}`.trim();
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

  await ctx.reply('Ищу подходящие вакансии…');

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
  const filtered = items.filter(v => !isStopMatch(v, stoplist));

  const ranked = rankVacancies(filtered, criteria, stoplist);
  const top = ranked.slice(0, 10).map(r => r.vacancy);

  const explanations = await explainFits(top, criteria);

  if (!top.length) {
    await ctx.reply('Ничего не нашлось по этим критериям. Попробуй упростить запрос.');
    return;
  }

  const lines = top.map((v, i) => {
    const expl = explanations?.[v.id] ? `\nПочему: ${escapeHtml(explanations[v.id])}` : '';
    return `<b>${i + 1}. ${escapeHtml(v.name)}</b>\n` +
      `Компания: ${escapeHtml(v.employer?.name || '—')}\n` +
      `Зарплата: ${escapeHtml(formatSalary(v.salary))}\n` +
      `Город: ${escapeHtml(v.area?.name || '—')}\n` +
      `Ссылка: ${escapeHtml(v.alternate_url || '')}${expl}`;
  });

  await ctx.reply(lines.join('\n\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
}

async function handleMarket(ctx, text) {
  const tgId = ctx.from.id;
  const user = getOrCreateUser(tgId);

  await ctx.reply('Собираю срез рынка…');

  const params = { text, area: process.env.HH_AREA_DEFAULT || '113' };
  const first = await searchVacancies(params, 0, 50);
  let items = first.items || [];
  if ((first.pages || 0) > 1) {
    const second = await searchVacancies(params, 1, 50);
    items = items.concat(second.items || []);
  }

  const stats = computeMarketStats(items, first.found || items.length);
  saveQuery(user.id, 'market', text, stats);

  const comment = await marketComment(stats, text);
  const topSkills = stats.top_skills.slice(0, 5).map(s => `${s.skill} (${s.count})`).join(', ');

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

  bot.on('text', async ctx => {
    const text = ctx.message.text?.trim();
    if (!text) return;

    const state = getState(ctx.from.id);

    try {
      if (state === STATE.AWAIT_SEARCH) {
        setState(ctx.from.id, STATE.IDLE);
        await handleSearch(ctx, text);
        await ctx.reply('Главное меню', mainMenu());
        return;
      }
      if (state === STATE.AWAIT_MARKET) {
        setState(ctx.from.id, STATE.IDLE);
        await handleMarket(ctx, text);
        await ctx.reply('Главное меню', mainMenu());
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
      await ctx.reply(`Ошибка: ${err.message || 'что-то пошло не так'}`);
      await ctx.reply('Главное меню', mainMenu());
    }
  });

  bot.launch();
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = {
  startBot
};
