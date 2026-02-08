const { normalizeText, includesAny } = require('../utils/text');

function getVacancyText(vacancy) {
  const parts = [
    vacancy.name,
    vacancy.snippet?.requirement,
    vacancy.snippet?.responsibility,
    vacancy.employer?.name
  ];
  return parts.filter(Boolean).join(' ');
}

function mapVacancyExperience(expId) {
  if (!expId) return 'unknown';
  if (expId === 'noExperience') return 'junior';
  if (expId === 'between1And3') return 'middle';
  if (expId === 'between3And6' || expId === 'moreThan6') return 'senior';
  return 'unknown';
}

function scoreVacancy(vacancy, criteria, stoplist = []) {
  let score = 0;
  const text = getVacancyText(vacancy);

  const skills = Array.isArray(criteria.skills) ? criteria.skills : [];
  const skillHits = skills.filter(s => includesAny(text, [s]));
  if (skillHits.length >= 1) score += 3;
  if (skillHits.length >= 2) score += 1;

  const desiredExp = criteria.experience;
  const vacExp = mapVacancyExperience(vacancy.experience?.id);
  if (desiredExp && desiredExp !== 'unknown' && desiredExp === vacExp) score += 2;

  const desiredSalary = criteria.salary?.amount || 0;
  if (desiredSalary > 0 && vacancy.salary) {
    const from = vacancy.salary.from || 0;
    const to = vacancy.salary.to || 0;
    const best = Math.max(from, to);
    if (best >= desiredSalary) score += 2;
    if (best > 0 && best < desiredSalary) score -= 3;
  }

  if (stoplist.length && includesAny(text, stoplist)) score -= 2;

  return score;
}

function rankVacancies(vacancies, criteria, stoplist) {
  return vacancies
    .map(v => ({ vacancy: v, score: scoreVacancy(v, criteria, stoplist) }))
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  scoreVacancy,
  rankVacancies
};
