const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCriteriaHeuristic } = require('../src/llm/openai');

const {
  processSubscription,
  runDailyDigest,
  getCutoffIso,
  filterFreshVacancies
} = require('../src/bot/job-digest');

test('getCutoffIso falls back to lookback window when subscription is new', () => {
  const now = new Date('2026-03-20T12:00:00.000Z');
  assert.equal(
    getCutoffIso({}, now, 24),
    '2026-03-19T12:00:00.000Z'
  );
});

test('filterFreshVacancies keeps only vacancies newer than cutoff', () => {
  const items = [
    { id: '1', published_at: '2026-03-20T09:00:00.000Z' },
    { id: '2', published_at: '2026-03-18T09:00:00.000Z' }
  ];
  const filtered = filterFreshVacancies(items, '2026-03-19T12:00:00.000Z');
  assert.deepEqual(filtered.map(item => item.id), ['1']);
});

test('processSubscription sends only new unseen vacancies and records delivery', async () => {
  const now = new Date('2026-03-20T12:00:00.000Z');
  const sent = [];
  const deliveries = [];
  const runs = [];

  const subscription = {
    id: 7,
    user_id: 11,
    tg_id: '123456',
    raw_query: 'Node.js backend',
    criteria_json: JSON.stringify({
      role: 'Backend',
      skills: ['Node.js'],
      salary: { amount: 200000, currency: 'RUR' },
      experience: 'middle',
      keywords: [],
      exclude: []
    }),
    last_success_at: '2026-03-19T08:00:00.000Z'
  };

  const result = await processSubscription(subscription, {
    now,
    searchVacancies: async (_params, page) => ({
      pages: 2,
      items: page === 0
        ? [
            {
              id: 'old-seen',
              name: 'Backend Engineer',
              employer: { name: 'Seen Co' },
              area: { name: 'Москва' },
              salary: { from: 220000, to: 260000, currency: 'RUR' },
              experience: { id: 'between1And3' },
              published_at: '2026-03-20T09:00:00.000Z',
              alternate_url: 'https://example.com/old-seen'
            },
            {
              id: 'fresh-best',
              name: 'Senior Backend Engineer',
              employer: { name: 'Fresh Co' },
              area: { name: 'Москва' },
              salary: { from: 260000, to: 320000, currency: 'RUR' },
              experience: { id: 'between3And6' },
              published_at: '2026-03-20T10:00:00.000Z',
              alternate_url: 'https://example.com/fresh-best'
            }
          ]
        : [
            {
              id: 'too-old',
              name: 'Legacy Backend',
              employer: { name: 'Archive Co' },
              area: { name: 'Москва' },
              salary: { from: 300000, to: 350000, currency: 'RUR' },
              experience: { id: 'between1And3' },
              published_at: '2026-03-18T10:00:00.000Z',
              alternate_url: 'https://example.com/too-old'
            },
            {
              id: 'fresh-second',
              name: 'Node.js Developer',
              employer: { name: 'Second Co' },
              area: { name: 'СПб' },
              salary: { from: 210000, to: 240000, currency: 'RUR' },
              experience: { id: 'between1And3' },
              published_at: '2026-03-20T11:00:00.000Z',
              alternate_url: 'https://example.com/fresh-second'
            }
          ]
    }),
    listStopWords: () => ['archive'],
    listSentVacancyIds: () => ['old-seen'],
    saveDeliveries: (subscriptionId, vacancyIds, sentAt) => {
      deliveries.push({ subscriptionId, vacancyIds, sentAt });
    },
    markRun: (subscriptionId, payload) => {
      runs.push({ subscriptionId, payload });
    },
    sendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
    }
  });

  assert.equal(result.sentCount, 2);
  assert.deepEqual([...result.vacancyIds].sort(), ['fresh-best', 'fresh-second']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '123456');
  assert.match(sent[0].text, /Ежедневный дайджест вакансий/);
  assert.equal(deliveries.length, 1);
  assert.deepEqual([...deliveries[0].vacancyIds].sort(), ['fresh-best', 'fresh-second']);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].payload.success, true);
});

test('runDailyDigest continues after one subscription fails', async () => {
  const summary = await runDailyDigest({
    now: new Date('2026-03-20T12:00:00.000Z'),
    subscriptions: [
      { id: 1, tg_id: '1' },
      { id: 2, tg_id: '2' }
    ],
    processSubscription: async (subscription) => {
      if (subscription.id === 1) {
        throw new Error('boom');
      }
      return { subscriptionId: 2, sentCount: 3 };
    }
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.success, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.sent, 3);
  assert.equal(summary.results[0].ok, false);
  assert.equal(summary.results[1].ok, true);
});

test('parseCriteriaHeuristic keeps role, salary and keywords for backend query', () => {
  const criteria = parseCriteriaHeuristic('AI Backend Engineer, удаленка, от 300к');
  assert.equal(criteria.role, 'AI Backend Engineer');
  assert.equal(criteria.salary.amount, 300000);
  assert.equal(criteria.salary.currency, 'RUR');
  assert.equal(criteria.experience, 'unknown');
  assert.ok(criteria.skills.includes('Node.js') || criteria.skills.includes('Backend') || criteria.skills.includes('AI'));
  assert.ok(criteria.keywords.includes('удаленка'));
});

test('parseCriteriaHeuristic keeps Bitrix24 and seniority for russian lead query', () => {
  const criteria = parseCriteriaHeuristic('Ведущий разработчик Битрикс24, удаленка, от 220к');
  assert.equal(criteria.role, 'Ведущий разработчик Битрикс24');
  assert.equal(criteria.salary.amount, 220000);
  assert.equal(criteria.experience, 'senior');
  assert.ok(criteria.skills.includes('Bitrix24'));
  assert.ok(criteria.keywords.includes('удаленка'));
});
