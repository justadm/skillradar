export const demoData = {
  dashboard: {
    stats: [
      { label: 'Вакансий в рынке', value: '1 240', delta: '+5% за 7 дней' },
      { label: 'Доля удалёнки', value: '38%', delta: 'Стабильно' },
      { label: 'Средняя вилка', value: '170–250k', delta: 'Москва · Backend' }
    ],
    reports: [
      { role: 'Backend Node.js', region: 'Москва', date: '2026-02-08', status: 'Готов' },
      { role: 'QA Automation', region: 'СПб', date: '2026-02-07', status: 'Готов' },
      { role: 'Product Manager', region: 'Казань', date: '2026-02-06', status: 'В работе' }
    ],
    activity: [
      'Запрос «Backend, 3+ года» — 12 минут назад',
      'Сохранён отчёт по конкурентам — 1 час назад',
      'Изменены стоп‑слова — 3 часа назад',
      'Добавлен участник команды — вчера'
    ]
  },
  reports: {
    items: [
      { id: 'rep_demo_1', role: 'Backend Node.js', region: 'Москва', type: 'Рынок роли', date: '2026-02-08', status: 'Готов' },
      { id: 'rep_demo_2', role: 'Product Manager', region: 'Казань', type: 'Конкуренты', date: '2026-02-07', status: 'В работе' },
      { id: 'rep_demo_3', role: 'QA Automation', region: 'СПб', type: 'Шаблон вакансии', date: '2026-02-06', status: 'Готов' }
    ]
  },
  roles: {
    items: [
      { title: 'Backend Node.js', region: 'Москва', level: 'Middle+', skills: 'node.js, sql, docker, rest' },
      { title: 'QA Automation', region: 'СПб', level: 'Middle', skills: 'python, selenium, api, ci' },
      { title: 'Product Manager', region: 'Казань', level: 'Senior', skills: 'discovery, analytics, roadmap' }
    ]
  },
  competitors: {
    leaders: [
      { company: 'Acme Product', count: 24 },
      { company: 'Pixel Works', count: 19 },
      { company: 'Beta Tech', count: 18 },
      { company: 'Delta Analytics', count: 16 }
    ],
    index: '0.74',
    summary: 'Высокая плотность вакансий и активный найм.'
  },
  template: {
    role: 'Backend Node.js (Москва)',
    level: 'Middle+',
    format: 'Гибрид',
    requirements: ['Node.js, TypeScript, SQL', 'Docker, CI/CD, REST', 'Опыт 3+ года'],
    tasks: ['Разработка и поддержка API', 'Оптимизация производительности', 'Взаимодействие с DevOps'],
    salary: '180–260k',
    salaryNote: 'Конкурентный уровень.'
  },
  team: {
    members: [
      { id: 'user_1', name: 'Константин Т.', email: 'owner@gridai.ru', role: 'owner', access: 'Active' },
      { id: 'user_2', name: 'HR Lead', email: 'hr@company.com', role: 'admin', access: 'Active' },
      { id: 'user_3', name: 'Recruiter', email: 'recruit@company.com', role: 'viewer', access: 'Invitation pending' }
    ]
  },
  billing: {
    current_plan: { name: 'Pro', price: '$199', limits: { reports_per_day: 10, team_size: 3 } },
    history: [
      { date: '2026-02-01', amount: '$199', status: 'paid' }
    ],
    plans: [
      { name: 'Starter', price: '$99', desc: 'До 3 отчётов в день, 1 команда.', cta: 'Выбрать' },
      { name: 'Pro', price: '$199', desc: 'До 10 отчётов в день, экспорт CSV/PDF.', cta: 'Текущий', featured: true },
      { name: 'Enterprise', price: 'Custom', desc: 'SLA, SSO, кастомные отчёты.', cta: 'Связаться' }
    ]
  },
  audit: {
    items: [
      { id: 101, actor_id: 'owner', action: 'team.invite', target: 'user_1', payload: { email: 'hr@company.com', role: 'analyst' }, created_at: '2026-02-09T09:12:00Z' },
      { id: 100, actor_id: 'owner', action: 'billing.checkout', target: 'org_1', payload: { plan: 'Pro' }, created_at: '2026-02-09T09:00:00Z' }
    ]
  },
  settings: {
    notifications: [
      { label: 'Еженедельный отчёт', enabled: true },
      { label: 'Алёрты по зарплатам', enabled: false }
    ],
    limits: [
      { label: 'Запросов', value: '120 / месяц' },
      { label: 'Экспортов', value: '30 / месяц' }
    ]
  },
  leads: {
    items: [
      { id: 12, company: 'Acme HR', email: 'lead@acme.com', message: 'Нужен отчет по backend', source: 'pricing', status: 'new', note: '', created_at: '2026-02-09T09:40:00Z' },
      { id: 11, company: 'Beta Tech', email: 'hr@beta.com', message: 'Интересует B2B пилот', source: 'contacts', status: 'qualified', note: 'Позвонить в среду', created_at: '2026-02-09T09:10:00Z' }
    ]
  }
};
