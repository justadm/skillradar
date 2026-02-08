const { request } = require('undici');

const HH_API_BASE = process.env.HH_API_BASE || 'https://api.hh.ru';

function buildUrl(path, params = {}) {
  const url = new URL(path, HH_API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function getJson(url) {
  const res = await request(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'skillradar-bot/0.1',
      'Accept': 'application/json'
    }
  });
  if (res.statusCode >= 400) {
    const body = await res.body.text();
    throw new Error(`HH API error ${res.statusCode}: ${body.slice(0, 200)}`);
  }
  return res.body.json();
}

async function searchVacancies(params, page = 0, perPage = 50) {
  const url = buildUrl('/vacancies', { ...params, page, per_page: perPage });
  return getJson(url);
}

async function getVacancy(vacancyId) {
  const url = buildUrl(`/vacancies/${vacancyId}`);
  return getJson(url);
}

module.exports = {
  searchVacancies,
  getVacancy
};
