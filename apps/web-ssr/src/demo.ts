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
      { role: 'Backend Node.js', region: 'Москва', type: 'Рынок роли', date: '2026-02-08', status: 'Готов' },
      { role: 'Product Manager', region: 'Казань', type: 'Конкуренты', date: '2026-02-07', status: 'В работе' },
      { role: 'QA Automation', region: 'СПб', type: 'Шаблон вакансии', date: '2026-02-06', status: 'Готов' }
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
      { name: 'Константин Т.', role: 'Owner', access: 'Admin' },
      { name: 'HR Lead', role: 'Editor', access: 'B2B аналитика' },
      { name: 'Recruiter', role: 'Viewer', access: 'Отчёты' }
    ]
  },
  billing: {
    plans: [
      { name: 'Starter', price: '$99', desc: 'До 3 отчётов в месяц, 1 команда.', cta: 'Выбрать' },
      { name: 'Pro', price: '$199', desc: 'До 10 отчётов, экспорт CSV/PDF.', cta: 'Текущий', featured: true },
      { name: 'Enterprise', price: 'Custom', desc: 'SLA, SSO, кастомные отчёты.', cta: 'Связаться' }
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
  }
};
