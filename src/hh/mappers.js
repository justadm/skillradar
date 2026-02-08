const DEFAULT_AREA = process.env.HH_AREA_DEFAULT || '113';

function mapExperienceToHH(exp) {
  if (!exp) return undefined;
  switch (exp) {
    case 'junior':
      return 'noExperience';
    case 'middle':
      return 'between1And3';
    case 'senior':
      return 'between3And6';
    default:
      return undefined;
  }
}

function criteriaToSearchParams(criteria = {}) {
  const textParts = [];
  if (criteria.role) textParts.push(criteria.role);
  if (Array.isArray(criteria.skills)) textParts.push(...criteria.skills);
  if (Array.isArray(criteria.keywords)) textParts.push(...criteria.keywords);
  const text = textParts.join(' ').trim();

  const params = {
    text,
    area: criteria.area || DEFAULT_AREA,
    experience: mapExperienceToHH(criteria.experience),
    salary_from: criteria.salary?.amount || undefined,
    currency: criteria.salary?.currency || undefined,
    only_with_salary: criteria.salary?.amount ? true : undefined
  };

  return params;
}

module.exports = {
  criteriaToSearchParams,
  mapExperienceToHH
};
