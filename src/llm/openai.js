const OpenAI = require('openai');
const { z } = require('zod');

const apiKey = process.env.OPENAI_API_KEY;
const modelMain = process.env.OPENAI_MODEL_MAIN || 'gpt-4.1-mini';
const modelMarket = process.env.OPENAI_MODEL_MARKET || 'gpt-4.1-nano';

const client = new OpenAI({ apiKey });

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

async function parseCriteria(rawText) {
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
  return data.data;
}

async function explainFits(vacancies, criteria) {
  if (!vacancies.length) return {};
  const items = vacancies.map(v => ({
    id: v.id,
    name: v.name,
    employer: v.employer?.name || '',
    salary: v.salary ? `${v.salary.from || ''}-${v.salary.to || ''} ${v.salary.currency || ''}` : 'не указана',
    requirement: v.snippet?.requirement || '',
    responsibility: v.snippet?.responsibility || ''
  }));

  const system = 'Сгенерируй короткое объяснение (1-2 предложения), почему вакансия подходит. Верни JSON объект: {"id": "text"}. Только JSON.';
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
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed;
}

async function marketComment(stats, query) {
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
