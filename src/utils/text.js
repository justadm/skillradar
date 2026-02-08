function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function includesAny(text, words) {
  const hay = normalizeText(text);
  return words.some(w => w && hay.includes(normalizeText(w)));
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  normalizeText,
  includesAny,
  escapeHtml
};
