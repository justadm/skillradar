const mockVacancies = [
  {
    id: 'mock-1',
    name: 'Frontend Developer (React)',
    employer: { name: 'Acme Product' },
    area: { name: 'Москва' },
    salary: { from: 150000, to: 220000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/1',
    snippet: {
      requirement: 'React, TypeScript, REST, Git',
      responsibility: 'Разработка UI, интеграция API'
    }
  },
  {
    id: 'mock-6',
    name: 'Product Manager',
    employer: { name: 'Sigma Apps' },
    area: { name: 'Казань' },
    salary: { from: 160000, to: 230000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/6',
    snippet: {
      requirement: 'Product sense, аналитика, коммуникации',
      responsibility: 'Развитие продукта и коммуникация со стейкхолдерами'
    }
  },
  {
    id: 'mock-7',
    name: 'UI/UX Designer',
    employer: { name: 'Pixel Works' },
    area: { name: 'Екатеринбург' },
    salary: { from: 130000, to: 190000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/7',
    snippet: {
      requirement: 'Figma, UX research, прототипирование',
      responsibility: 'Проектирование интерфейсов и тесты'
    }
  },
  {
    id: 'mock-8',
    name: 'Data Engineer',
    employer: { name: 'DataRail' },
    area: { name: 'Новосибирск' },
    salary: { from: 200000, to: 320000, currency: 'RUR' },
    experience: { id: 'between3And6' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/8',
    snippet: {
      requirement: 'Python, Airflow, Spark, SQL',
      responsibility: 'Пайплайны и качество данных'
    }
  },
  {
    id: 'mock-9',
    name: 'QA Automation Engineer',
    employer: { name: 'TestLab' },
    area: { name: 'Москва' },
    salary: { from: 140000, to: 210000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/9',
    snippet: {
      requirement: 'Python, Selenium, CI/CD',
      responsibility: 'Автотесты и интеграция'
    }
  },
  {
    id: 'mock-10',
    name: 'Mobile Developer (Flutter)',
    employer: { name: 'Mobile Fox' },
    area: { name: 'Москва' },
    salary: { from: 170000, to: 240000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/10',
    snippet: {
      requirement: 'Flutter, Dart, REST',
      responsibility: 'Мобильные приложения'
    }
  },
  {
    id: 'mock-11',
    name: 'System Analyst',
    employer: { name: 'BankCore' },
    area: { name: 'Санкт-Петербург' },
    salary: { from: 150000, to: 210000, currency: 'RUR' },
    experience: { id: 'between3And6' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/11',
    snippet: {
      requirement: 'UML, BPMN, SQL',
      responsibility: 'Сбор требований и документация'
    }
  },
  {
    id: 'mock-12',
    name: 'ML Engineer',
    employer: { name: 'NeuroLab' },
    area: { name: 'Москва' },
    salary: { from: 250000, to: 400000, currency: 'RUR' },
    experience: { id: 'between3And6' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/12',
    snippet: {
      requirement: 'Python, PyTorch, MLOps',
      responsibility: 'Модели и деплой'
    }
  },
  {
    id: 'mock-2',
    name: 'Backend Node.js Developer',
    employer: { name: 'Beta Tech' },
    area: { name: 'Санкт-Петербург' },
    salary: { from: 180000, to: 260000, currency: 'RUR' },
    experience: { id: 'between3And6' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/2',
    snippet: {
      requirement: 'Node.js, PostgreSQL, REST, Docker',
      responsibility: 'Разработка API и интеграции'
    }
  },
  {
    id: 'mock-3',
    name: 'QA Engineer (Manual/Auto)',
    employer: { name: 'Gamma QA' },
    area: { name: 'Удаленно' },
    salary: { from: 90000, to: 140000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/3',
    snippet: {
      requirement: 'Тест-кейсы, API testing, Postman',
      responsibility: 'Ручное/авто тестирование'
    }
  },
  {
    id: 'mock-4',
    name: 'Data Analyst',
    employer: { name: 'Delta Analytics' },
    area: { name: 'Москва' },
    salary: { from: 120000, to: 180000, currency: 'RUR' },
    experience: { id: 'between1And3' },
    schedule: { id: 'fullDay' },
    alternate_url: 'https://example.com/vacancy/4',
    snippet: {
      requirement: 'SQL, Excel, Power BI, Python',
      responsibility: 'Отчеты, дашборды, анализ'
    }
  },
  {
    id: 'mock-5',
    name: 'DevOps Engineer',
    employer: { name: 'Omega Cloud' },
    area: { name: 'Москва' },
    salary: { from: 200000, to: 300000, currency: 'RUR' },
    experience: { id: 'between3And6' },
    schedule: { id: 'remote' },
    alternate_url: 'https://example.com/vacancy/5',
    snippet: {
      requirement: 'Kubernetes, CI/CD, AWS, Linux',
      responsibility: 'Инфраструктура и автоматизация'
    }
  }
];

function mockSearchVacancies() {
  return {
    found: mockVacancies.length,
    pages: 1,
    items: mockVacancies
  };
}

function mockGetVacancy(id) {
  return mockVacancies.find(v => v.id === id) || mockVacancies[0];
}

module.exports = {
  mockSearchVacancies,
  mockGetVacancy
};
