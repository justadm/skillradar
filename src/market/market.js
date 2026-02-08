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
  let remoteCount = 0;
  let salaryFrom = [];
  let salaryTo = [];

  for (const v of vacancies) {
    const req = v.snippet?.requirement || '';
    const resp = v.snippet?.responsibility || '';
    const tokens = extractKeywords(`${req} ${resp}`);
    for (const t of tokens) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    const scheduleId = v.schedule?.id || '';
    if (String(scheduleId).toLowerCase().includes('remote')) remoteCount += 1;

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

  return {
    total_found: totalFound || vacancies.length,
    sample_size: vacancies.length,
    remote_share: vacancies.length ? Math.round((remoteCount / vacancies.length) * 100) : 0,
    salary_from_avg: avg(salaryFrom),
    salary_to_avg: avg(salaryTo),
    top_skills: topSkills
  };
}

module.exports = {
  computeMarketStats
};
