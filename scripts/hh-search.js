#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { request } = require('undici');
const { criteriaToSearchParams } = require('../src/hh/mappers');
const { rankVacancies } = require('../src/score/scoring');

const HH_API_BASE = process.env.HH_API_BASE || 'https://api.hh.ru';

function printHelp() {
  console.log(`
Usage:
  npm run hh:search -- --role="PHP developer" --skills="bitrix,php,mysql" [options]

Options:
  --role=VALUE           Role title, used in HH search text
  --skills=CSV           Comma-separated skill list
  --keywords=CSV         Extra keywords
  --exclude=CSV          Stop words / unwanted terms
  --experience=VALUE     junior | middle | senior
  --salary=NUMBER        Desired salary lower bound
  --currency=VALUE       Salary currency, default RUR
  --area=ID              HH area id, default from HH_AREA_DEFAULT
  --pages=NUMBER         How many HH pages to fetch, default 2
  --per-page=NUMBER      HH page size, default 20, max 100
  --limit=NUMBER         How many ranked vacancies to print, default 10
  --json                 Print raw JSON result
  --help                 Show this help

Examples:
  npm run hh:search -- --role="PHP Bitrix developer" --skills="bitrix,bitrix24,php,d7,mysql" --salary=200000 --experience=senior
  npm run hh:search -- --role="AI Engineer" --skills="python,llm,rag,api" --keywords="langchain,qdrant" --exclude="ml engineer,data scientist"
`);
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    pages: 2,
    perPage: 20,
    limit: 10,
    json: false
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (!raw.startsWith('--')) continue;

    const eq = raw.indexOf('=');
    const key = eq > -1 ? raw.slice(2, eq) : raw.slice(2);
    const value = eq > -1 ? raw.slice(eq + 1) : '';
    args[key] = value;
  }

  args.skills = parseCsv(args.skills);
  args.keywords = parseCsv(args.keywords);
  args.exclude = parseCsv(args.exclude);
  args.pages = Math.max(1, Number(args.pages || 2));
  args.perPage = Math.min(100, Math.max(1, Number(args['per-page'] || args.perPage || 20)));
  args.limit = Math.max(1, Number(args.limit || 10));
  args.salary = args.salary ? Number(args.salary) : 0;
  args.currency = args.currency || 'RUR';

  return args;
}

function toCriteria(args) {
  return {
    role: args.role || '',
    skills: args.skills,
    keywords: args.keywords,
    exclude: args.exclude,
    experience: args.experience || '',
    area: args.area || '',
    salary: args.salary
      ? { amount: args.salary, currency: args.currency }
      : undefined
  };
}

function buildUrl(pathName, params = {}) {
  const url = new URL(pathName, HH_API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchVacancies(params, page, perPage) {
  const token = process.env.HH_ACCESS_TOKEN || '';
  const headers = {
    'User-Agent': 'gridai-jobsearch/0.1',
    'Accept': 'application/json'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = buildUrl('/vacancies', { ...params, page, per_page: perPage });
  const res = await request(url, { method: 'GET', headers });
  const text = await res.body.text();
  if (res.statusCode >= 400) {
    throw new Error(`HH API error ${res.statusCode}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

function formatSalary(vacancy) {
  if (!vacancy.salary) return 'salary n/a';
  const from = vacancy.salary.from ? `${vacancy.salary.from}` : '';
  const to = vacancy.salary.to ? `${vacancy.salary.to}` : '';
  const cur = vacancy.salary.currency || '';
  if (from && to) return `${from}-${to} ${cur}`;
  if (from) return `from ${from} ${cur}`;
  if (to) return `to ${to} ${cur}`;
  return 'salary n/a';
}

function explainMatch(vacancy, criteria) {
  const hay = [
    vacancy.name,
    vacancy.snippet?.requirement,
    vacancy.snippet?.responsibility
  ].filter(Boolean).join(' ').toLowerCase();

  const matched = [];
  for (const skill of criteria.skills || []) {
    if (hay.includes(String(skill).toLowerCase())) matched.push(skill);
  }
  for (const keyword of criteria.keywords || []) {
    if (hay.includes(String(keyword).toLowerCase()) && !matched.includes(keyword)) matched.push(keyword);
  }

  if (!matched.length) return 'совпадение в основном по роли/зарплате/дате';
  return `совпали: ${matched.slice(0, 6).join(', ')}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.role && !args.skills.length && !args.keywords.length)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const criteria = toCriteria(args);
  const params = criteriaToSearchParams(criteria);

  const vacancies = [];
  let totalFound = 0;

  for (let page = 0; page < args.pages; page += 1) {
    const result = await fetchVacancies(params, page, args.perPage);
    const items = Array.isArray(result?.items) ? result.items : [];
    if (!items.length) break;
    vacancies.push(...items);
    totalFound = Number(result?.found || totalFound || items.length);
    if (page + 1 >= Number(result?.pages || page + 1)) break;
  }

  const ranked = rankVacancies(vacancies, criteria, args.exclude)
    .slice(0, args.limit)
    .map(item => ({
      score: item.score,
      id: item.vacancy.id,
      name: item.vacancy.name,
      employer: item.vacancy.employer?.name || '',
      area: item.vacancy.area?.name || '',
      salary: formatSalary(item.vacancy),
      url: item.vacancy.alternate_url || '',
      why: explainMatch(item.vacancy, criteria),
      vacancy: item.vacancy
    }));

  if (args.json) {
    console.log(JSON.stringify({
      criteria,
      params,
      total_found: totalFound,
      fetched: vacancies.length,
      ranked
    }, null, 2));
    return;
  }

  console.log(`Query: ${[criteria.role, ...(criteria.skills || []), ...(criteria.keywords || [])].filter(Boolean).join(', ')}`);
  console.log(`HH params: ${JSON.stringify(params)}`);
  console.log(`Fetched: ${vacancies.length} / Found: ${totalFound}`);
  console.log('');

  if (!ranked.length) {
    console.log('No vacancies found.');
    return;
  }

  ranked.forEach((item, index) => {
    console.log(`${index + 1}. [score ${item.score}] ${item.name}`);
    console.log(`   ${item.employer} · ${item.area} · ${item.salary}`);
    console.log(`   Почему подходит: ${item.why}`);
    console.log(`   ${item.url}`);
    console.log('');
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
