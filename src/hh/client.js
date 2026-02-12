const { request } = require('undici');
const { getVacancyCache, saveVacancyCache, getHhToken, markHhApiSuccess, markHhApiError } = require('../db');
const { mockSearchVacancies, mockGetVacancy } = require('./mocks');

const HH_API_BASE = process.env.HH_API_BASE || 'https://api.hh.ru';
const HH_CACHE_TTL_MS = Number(process.env.HH_CACHE_TTL_MS || 6 * 60 * 60 * 1000);

function isMocksEnabled() {
  return String(process.env.USE_MOCKS || '').toLowerCase() === 'true';
}

function buildUrl(path, params = {}) {
  const url = new URL(path, HH_API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function getJson(url) {
  const token = getHhToken();
  const authHeader = token?.access_token ? { Authorization: `Bearer ${token.access_token}` } : {};
  const res = await request(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'skillradar-bot/0.1',
      'Accept': 'application/json',
      ...authHeader
    }
  });
  if (res.statusCode >= 400) {
    const body = await res.body.text();
    markHhApiError(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
    throw new Error(`HH API error ${res.statusCode}: ${body.slice(0, 200)}`);
  }
  const json = await res.body.json();
  markHhApiSuccess();
  return json;
}

async function searchVacancies(params, page = 0, perPage = 50) {
  if (isMocksEnabled()) return mockSearchVacancies();
  try {
    const url = buildUrl('/vacancies', { ...params, page, per_page: perPage });
    return await getJson(url);
  } catch (err) {
    markHhApiError(err.message);
    return mockSearchVacancies();
  }
}

async function getVacancy(vacancyId) {
  if (isMocksEnabled()) return mockGetVacancy(vacancyId);
  try {
    const cached = getVacancyCache(String(vacancyId));
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < HH_CACHE_TTL_MS) return JSON.parse(cached.raw_json);
    }
    const url = buildUrl(`/vacancies/${vacancyId}`);
    const data = await getJson(url);
    saveVacancyCache(String(vacancyId), data);
    return data;
  } catch (err) {
    markHhApiError(err.message);
    return mockGetVacancy(vacancyId);
  }
}

module.exports = {
  searchVacancies,
  getVacancy
};
