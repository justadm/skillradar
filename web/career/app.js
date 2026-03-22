const SRCareer = (() => {
  const qs = sel => document.querySelector(sel);
  const authEntryUrl = () => (
    window.location.hostname.endsWith('gridai.ru')
      ? 'https://auth.gridai.ru/career'
      : '/career'
  );

  async function ensureSession() {
    const loading = qs('[data-sr-loading]');
    const error = qs('[data-sr-error]');
    loading?.classList.remove('d-none');
    try {
      const res = await fetch('/api/v1/me', { credentials: 'include' });
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      loading?.classList.add('d-none');
      error?.classList.add('d-none');
      return true;
    } catch (err) {
      loading?.classList.add('d-none');
      error?.classList.remove('d-none');
      if (String(err?.message || '') === 'UNAUTHORIZED') {
        setTimeout(() => {
          window.location.href = authEntryUrl();
        }, 900);
      }
      return false;
    }
  }

  async function loadData() {
    const res = await fetch('../data/career-dashboard.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }

  function renderOverview(data) {
    qs('#sr-career-digests-count').textContent = data.overview.digests;
    qs('#sr-career-saved-count').textContent = data.overview.saved;
    qs('#sr-career-market-pulse').textContent = data.overview.marketPulse;
  }

  function renderDigests(items) {
    const node = qs('#sr-career-digests');
    node.innerHTML = items.map(item => `
      <div class="list-group-item px-0">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <strong>${item.query}</strong>
            <div class="sr-muted small mt-1">Последняя отправка: ${item.lastSent}</div>
          </div>
          <span class="badge text-bg-${item.status === 'active' ? 'success' : 'secondary'}">${item.statusLabel}</span>
        </div>
      </div>
    `).join('');
  }

  function renderSaved(items) {
    const node = qs('#sr-career-saved');
    node.innerHTML = items.map(item => `
      <div class="list-group-item px-0">
        <strong>${item.title}</strong>
        <div class="sr-muted small mt-1">${item.company} · ${item.salary} · ${item.mode}</div>
      </div>
    `).join('');
  }

  function renderQueries(items) {
    const node = qs('#sr-career-queries');
    node.innerHTML = items.map(item => `
      <tr>
        <td>${item.query}</td>
        <td>${item.market}</td>
        <td>${item.updatedAt}</td>
      </tr>
    `).join('');
  }

  function renderMarket(items) {
    const node = qs('#sr-career-market');
    node.innerHTML = items.map(item => `<li>• ${item}</li>`).join('');
  }

  function renderProfile(profile) {
    qs('#sr-career-role').textContent = profile.role;
    qs('#sr-career-format').textContent = profile.format;
    qs('#sr-career-salary').textContent = profile.salary;
  }

  async function init() {
    const authed = await ensureSession();
    if (!authed) return;
    const data = await loadData();
    if (!data) return;
    renderOverview(data);
    renderDigests(data.digests || []);
    renderSaved(data.saved || []);
    renderQueries(data.queries || []);
    renderMarket(data.market || []);
    renderProfile(data.profile || {});
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', () => {
  SRCareer.init().catch(() => {});
});
