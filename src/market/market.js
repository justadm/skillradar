const { normalizeText } = require('../utils/text');

const STOPWORDS = new Set([
  'и','в','на','по','для','с','к','от','до','или','не','что','это','как','а','но','мы','вы','они','он','она','оно','из','за','по','при','без','над','под','про',
  'the','and','for','with','from','that','this','you','your','our','are','was','were','will','can','able','have','has'
]);

function extractKeywords(text) {
  const tokens = normalizeText(text)
    .replace(/[^a-zа-я0-9+.#]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
  return tokens;
}

function computeMarketStats(vacancies, totalFound) {
  const counts = new Map();
  const cityCounts = new Map();
  const levelCounts = new Map([
    ['junior', 0],
    ['middle', 0],
    ['senior', 0],
    ['unknown', 0]
  ]);
  let remoteCount = 0;
  let salaryFrom = [];
  let salaryTo = [];
  let last7 = 0;
  let prev7 = 0;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const v of vacancies) {
    const req = v.snippet?.requirement || '';
    const resp = v.snippet?.responsibility || '';
    const tokens = extractKeywords(`${req} ${resp}`);
    const unique = new Set(tokens);
    for (const t of unique) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    const scheduleId = v.schedule?.id || '';
    if (String(scheduleId).toLowerCase().includes('remote')) remoteCount += 1;

    const city = v.area?.name || '';
    if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);

    const expId = v.experience?.id || '';
    const expKey = expId === 'noExperience'
      ? 'junior'
      : expId === 'between1And3'
        ? 'middle'
        : expId === 'between3And6' || expId === 'moreThan6'
          ? 'senior'
          : 'unknown';
    levelCounts.set(expKey, (levelCounts.get(expKey) || 0) + 1);

    const published = v.published_at ? Date.parse(v.published_at) : 0;
    if (published) {
      const delta = now - published;
      if (delta <= dayMs * 7) last7 += 1;
      else if (delta <= dayMs * 14) prev7 += 1;
    }

    if (v.salary) {
      if (v.salary.from) salaryFrom.push(v.salary.from);
      if (v.salary.to) salaryTo.push(v.salary.to);
    }
  }

  const topSkills = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }));

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const topCities = Array.from(cityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));

  const trend = prev7 > 0
    ? Math.round(((last7 - prev7) / prev7) * 100)
    : last7 > 0
      ? 100
      : 0;

  return {
    total_found: totalFound || vacancies.length,
    sample_size: vacancies.length,
    remote_share: vacancies.length ? Math.round((remoteCount / vacancies.length) * 100) : 0,
    salary_from_avg: avg(salaryFrom),
    salary_to_avg: avg(salaryTo),
    top_skills: topSkills,
    top_cities: topCities,
    levels: Object.fromEntries(levelCounts),
    trend_7d: {
      last7,
      prev7,
      delta_percent: trend
    }
  };
}

module.exports = {
  computeMarketStats
};
