const crypto = require('crypto');
const OpenAI = require('openai');
const { z } = require('zod');
const { getLlmCache, saveLlmCache } = require('../db');

const apiKey = process.env.OPENAI_API_KEY;
const modelMain = process.env.OPENAI_MODEL_MAIN || 'gpt-4.1-mini';
const modelMarket = process.env.OPENAI_MODEL_MARKET || 'gpt-4.1-nano';
const LLM_CACHE_TTL_MS = Number(process.env.LLM_CACHE_TTL_MS || 24 * 60 * 60 * 1000);
const USE_MOCKS = String(process.env.USE_MOCKS || '').toLowerCase() === 'true';
const USE_LLM_MOCKS = USE_MOCKS || !apiKey;

const client = USE_LLM_MOCKS ? null : new OpenAI({ apiKey });

const CriteriaSchema = z.object({
  role: z.string().optional().default(''),
  skills: z.array(z.string()).optional().default([]),
  salary: z.object({
    amount: z.number().optional().default(0),
    currency: z.string().optional().default('RUR')
  }).optional().default({ amount: 0, currency: 'RUR' }),
  experience: z.enum(['junior', 'middle', 'senior', 'unknown']).optional().default('unknown'),
  keywords: z.array(z.string()).optional().default([]),
  exclude: z.array(z.string()).optional().default([]),
  area: z.string().optional()
});

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

function hashText(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex');
}

function getCacheJson(cacheKey) {
  const cached = getLlmCache(cacheKey);
  if (!cached) return null;
  const age = Date.now() - new Date(cached.fetched_at).getTime();
  if (age > LLM_CACHE_TTL_MS) return null;
  try {
    return JSON.parse(cached.value_json);
  } catch (_) {
    return null;
  }
}

function setCacheJson(cacheKey, value) {
  saveLlmCache(cacheKey, value);
}

async function parseCriteria(rawText) {
  if (USE_LLM_MOCKS) {
    const text = String(rawText || '');
    const num = text.match(/(\d{2,6})/);
    const amount = num ? Number(num[1]) : 0;
    return {
      role: 'Software Engineer',
      skills: ['JavaScript', 'Node.js'],
      salary: { amount, currency: 'RUR' },
      experience: 'middle',
      keywords: [],
      exclude: []
    };
  }
  const cacheKey = `criteria:${hashText(rawText)}`;
  const cached = getCacheJson(cacheKey);
  if (cached) {
    const data = CriteriaSchema.safeParse(cached);
    if (data.success) return data.data;
  }

  const system = 'Ты парсер вакансий для hh.ru (РФ). Верни строго JSON без пояснений.';
  const user = `Извлеки из текста критерии: роль, навыки, зарплата (число), уровень (junior|middle|senior), ключевые слова, исключения ("не хочу").\n\nТекст: ${rawText}`;

  const res = await client.chat.completions.create({
    model: modelMain,
    temperature: 0.1,
    max_tokens: 300,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  const content = res.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse(content) || {};
  const data = CriteriaSchema.safeParse(parsed);
  if (!data.success) {
    return CriteriaSchema.parse({});
  }
  setCacheJson(cacheKey, data.data);
  return data.data;
}

async function explainFits(vacancies, criteria) {
  if (!vacancies.length) return {};
  if (USE_LLM_MOCKS) {
    const res = {};
    for (const v of vacancies) {
      res[v.id] = 'Совпадают навыки и уровень, зарплата близка к ожиданиям.';
    }
    return res;
  }
  const criteriaKey = hashText(JSON.stringify(criteria || {}));
  const result = {};

  const missing = [];
  for (const v of vacancies) {
    const key = `explain:${v.id}:${criteriaKey}`;
    const cached = getCacheJson(key);
    if (cached && typeof cached.text === 'string') {
      result[v.id] = cached.text;
    } else {
      missing.push(v);
    }
  }

  if (!missing.length) return result;

  const items = missing.map(v => ({
    id: v.id,
    name: v.name,
    employer: v.employer?.name || '',
    salary: v.salary ? `${v.salary.from || ''}-${v.salary.to || ''} ${v.salary.currency || ''}` : 'не указана',
    requirement: v.snippet?.requirement || '',
    responsibility: v.snippet?.responsibility || ''
  }));

  const system = 'Сгенерируй короткое объяснение (1-2 предложения), почему вакансия подходит. Укажи 1-2 конкретные причины (навыки/опыт/зарплата/формат). Верни JSON объект: {"id": "text"}. Только JSON.';
  const user = `Критерии пользователя: ${JSON.stringify(criteria)}\n\nВакансии: ${JSON.stringify(items)}`;

  const res = await client.chat.completions.create({
    model: modelMain,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  const content = res.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse(content);
  if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([id, text]) => {
      if (typeof text === 'string') {
        result[id] = text;
        const key = `explain:${id}:${criteriaKey}`;
        setCacheJson(key, { text });
      }
    });
  }
  return result;
}

async function marketComment(stats, query) {
  if (USE_LLM_MOCKS) {
    return 'Рынок выглядит стабильным: спрос есть, по зарплатам — средний уровень.';
  }
  const system = 'Сделай короткий аналитический комментарий (1-2 предложения). Без воды.';
  const user = `Запрос: ${query}\nСтатистика: ${JSON.stringify(stats)}`;

  const res = await client.chat.completions.create({
    model: modelMarket,
    temperature: 0.3,
    max_tokens: 80,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  return res.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = {
  parseCriteria,
  explainFits,
  marketComment
};
