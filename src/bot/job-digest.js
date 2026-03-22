const { request } = require('undici');
const { parseCriteria } = require('../llm/openai');
const { searchVacancies } = require('../hh/client');
const { criteriaToSearchParams } = require('../hh/mappers');
const { rankVacancies } = require('../score/scoring');
const {
  listStopWords,
  listActiveJobDigestSubscriptions,
  listJobDigestDeliveryVacancyIds,
  saveJobDigestDeliveries,
  markJobDigestSubscriptionRun
} = require('../db');
const { escapeHtml, includesAny } = require('../utils/text');

const DEFAULT_DIGEST_LIMIT = Number(process.env.JOB_DIGEST_LIMIT || 5);
const DEFAULT_LOOKBACK_HOURS = Number(process.env.JOB_DIGEST_LOOKBACK_HOURS || 24);

function getTelegramBotToken(botKey = 'jobs') {
  const normalized = String(botKey || 'jobs').trim().toLowerCase();
  if (normalized === 'hr') {
    return process.env.TELEGRAM_BOT_TOKEN_HR || process.env.TELEGRAM_BOT_TOKEN;
  }
  if (normalized === 'combined') {
    return process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN_JOBS;
  }
  return process.env.TELEGRAM_BOT_TOKEN_JOBS || process.env.TELEGRAM_BOT_TOKEN;
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

function getCutoffIso(subscription, now, lookbackHours = DEFAULT_LOOKBACK_HOURS) {
  const lastSuccessAt = subscription?.last_success_at ? Date.parse(subscription.last_success_at) : NaN;
  if (Number.isFinite(lastSuccessAt)) return new Date(lastSuccessAt).toISOString();
  return new Date(now.getTime() - (lookbackHours * 60 * 60 * 1000)).toISOString();
}

function filterFreshVacancies(vacancies, cutoffIso) {
  const cutoffTs = Date.parse(cutoffIso);
  if (!Number.isFinite(cutoffTs)) return vacancies;
  return vacancies.filter(vacancy => {
    const publishedTs = Date.parse(vacancy?.published_at || '');
    return Number.isFinite(publishedTs) && publishedTs > cutoffTs;
  });
}

function buildDigestMessage(subscription, vacancies) {
  const title = escapeHtml(subscription.raw_query || 'вашему запросу');
  const items = vacancies.map((vacancy, index) => {
    return [
      `<b>${index + 1}. ${escapeHtml(vacancy.name || 'Без названия')}</b>`,
      `Компания: ${escapeHtml(vacancy.employer?.name || '—')}`,
      `Зарплата: ${escapeHtml(formatSalary(vacancy.salary))}`,
      `Город: ${escapeHtml(vacancy.area?.name || '—')}`,
      `Ссылка: ${escapeHtml(vacancy.alternate_url || '')}`
    ].join('\n');
  });

  return [
    `<b>Ежедневный дайджест вакансий</b>`,
    `Запрос: ${title}`,
    '',
    ...items
  ].join('\n\n');
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const botToken = getTelegramBotToken(options.botKey);
  if (!botToken) {
    throw new Error(`Telegram bot token is missing for botKey=${options.botKey || 'jobs'}`);
  }

  const res = await request(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: String(chatId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const data = await res.body.json();
  if (res.statusCode >= 400 || !data?.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.statusCode} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

async function processSubscription(subscription, deps = {}) {
  const now = deps.now instanceof Date ? deps.now : new Date();
  const limit = Number(deps.limit || DEFAULT_DIGEST_LIMIT);
  const searchVacanciesFn = deps.searchVacancies || searchVacancies;
  const parseCriteriaFn = deps.parseCriteria || parseCriteria;
  const rankVacanciesFn = deps.rankVacancies || rankVacancies;
  const criteriaToSearchParamsFn = deps.criteriaToSearchParams || criteriaToSearchParams;
  const listStopWordsFn = deps.listStopWords || listStopWords;
  const listSentVacancyIdsFn = deps.listSentVacancyIds || listJobDigestDeliveryVacancyIds;
  const saveDeliveriesFn = deps.saveDeliveries || saveJobDigestDeliveries;
  const markRunFn = deps.markRun || markJobDigestSubscriptionRun;
  const sendMessageFn = deps.sendMessage || sendTelegramMessage;

  const subscriptionId = subscription?.id;
  if (!subscriptionId) {
    throw new Error('subscription.id is required');
  }

  try {
    const criteria = subscription.criteria_json
      ? JSON.parse(subscription.criteria_json)
      : await parseCriteriaFn(subscription.raw_query || '');
    const params = criteriaToSearchParamsFn(criteria);
    const firstPage = await searchVacanciesFn(params, 0, 50);
    let items = Array.isArray(firstPage?.items) ? firstPage.items.slice() : [];

    if ((firstPage?.pages || 0) > 1) {
      const secondPage = await searchVacanciesFn(params, 1, 50);
      items = items.concat(Array.isArray(secondPage?.items) ? secondPage.items : []);
    }

    const stoplist = listStopWordsFn(subscription.user_id);
    const desiredSalary = criteria.salary?.amount || 0;
    const sentVacancyIds = new Set(listSentVacancyIdsFn(subscriptionId).map(String));
    const cutoffIso = getCutoffIso(subscription, now, deps.lookbackHours);

    const filtered = filterFreshVacancies(items, cutoffIso).filter(vacancy => {
      if (!vacancy?.id) return false;
      if (sentVacancyIds.has(String(vacancy.id))) return false;
      if (isStopMatch(vacancy, stoplist)) return false;
      if (desiredSalary > 0 && vacancy.salary) {
        const max = Math.max(vacancy.salary.from || 0, vacancy.salary.to || 0);
        if (max > 0 && max < desiredSalary) return false;
      }
      return true;
    });

    const ranked = rankVacanciesFn(filtered, criteria, stoplist);
    const topVacancies = ranked.slice(0, limit).map(item => item.vacancy);

    if (!topVacancies.length) {
      markRunFn(subscriptionId, { success: true, ranAt: now.toISOString() });
      return {
        subscriptionId,
        sentCount: 0,
        reason: 'no_fresh_vacancies'
      };
    }

    const message = buildDigestMessage(subscription, topVacancies);
    await sendMessageFn(subscription.tg_id, message, {
      botKey: subscription.bot_key || 'jobs',
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    saveDeliveriesFn(subscriptionId, topVacancies.map(vacancy => vacancy.id), now.toISOString());
    markRunFn(subscriptionId, { success: true, ranAt: now.toISOString() });

    return {
      subscriptionId,
      sentCount: topVacancies.length,
      vacancyIds: topVacancies.map(vacancy => String(vacancy.id))
    };
  } catch (error) {
    markRunFn(subscriptionId, { success: false, ranAt: now.toISOString(), error: error.message });
    throw error;
  }
}

async function runDailyDigest(deps = {}) {
  const listSubscriptionsFn = deps.listSubscriptions || listActiveJobDigestSubscriptions;
  const processSubscriptionFn = deps.processSubscription || processSubscription;
  const now = deps.now instanceof Date ? deps.now : new Date();
  const subscriptions = deps.subscriptions || listSubscriptionsFn(deps.limit || 100, deps.offset || 0);
  const results = [];

  for (const subscription of subscriptions) {
    try {
      const result = await processSubscriptionFn(subscription, { ...deps, now });
      results.push({
        subscriptionId: subscription.id,
        ok: true,
        ...result
      });
    } catch (error) {
      results.push({
        subscriptionId: subscription.id,
        ok: false,
        error: error.message
      });
    }
  }

  return {
    processedAt: now.toISOString(),
    total: subscriptions.length,
    success: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok).length,
    sent: results.reduce((acc, item) => acc + (item.sentCount || 0), 0),
    results
  };
}

module.exports = {
  runDailyDigest,
  processSubscription,
  buildDigestMessage,
  getCutoffIso,
  filterFreshVacancies
};
