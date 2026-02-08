const SRPortal = (() => {
  const qs = sel => document.querySelector(sel);

  const badgeForStatus = status => {
    if (!status) return 'secondary';
    const normalized = status.toLowerCase();
    if (normalized.includes('готов')) return 'success';
    if (normalized.includes('работ')) return 'warning';
    return 'secondary';
  };

  const loadJson = async page => {
    try {
      const res = await fetch(`../data/${page}.json`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const renderDashboard = data => {
    if (!data) return;
    const stats = qs('#sr-stats');
    if (stats) {
      stats.innerHTML = data.stats
        .map(
          item => `
          <div class="col-md-4">
            <div class="card sr-card h-100">
              <div class="card-body">
                <p class="sr-muted mb-2">${item.label}</p>
                <h2 class="h4 mb-0">${item.value}</h2>
                <small class="sr-muted">${item.delta}</small>
              </div>
            </div>
          </div>`
        )
        .join('');
    }

    const reports = qs('#sr-reports');
    if (reports) {
      reports.innerHTML = data.reports
        .map(
          item => `
          <tr>
            <td>${item.role}</td>
            <td>${item.region}</td>
            <td>${item.date}</td>
            <td><span class="badge text-bg-${badgeForStatus(item.status)}">${item.status}</span></td>
          </tr>`
        )
        .join('');
    }

    const activity = qs('#sr-activity');
    if (activity) {
      activity.innerHTML = data.activity
        .map(item => `<li>• ${item}</li>`)
        .join('');
    }
  };

  const renderReports = data => {
    if (!data) return;
    const tbody = qs('#sr-reports-table');
    if (!tbody) return;
    tbody.innerHTML = data.items
      .map(
        item => `
        <tr>
          <td>${item.role}</td>
          <td>${item.region}</td>
          <td>${item.type}</td>
          <td>${item.date}</td>
          <td><span class="badge text-bg-${badgeForStatus(item.status)}">${item.status}</span></td>
          <td><button class="btn btn-outline-secondary btn-sm">Открыть</button></td>
        </tr>`
      )
      .join('');
  };

  const renderRoles = data => {
    if (!data) return;
    const container = qs('#sr-roles');
    if (!container) return;
    container.innerHTML = data.items
      .map(
        item => `
        <div class="col-md-6 col-lg-4">
          <div class="card sr-card h-100">
            <div class="card-body">
              <h3 class="h6">${item.title}</h3>
              <p class="sr-muted">${item.region} · ${item.level}</p>
              <p class="sr-muted">Навыки: ${item.skills}</p>
              <button class="btn btn-outline-secondary btn-sm">Открыть</button>
            </div>
          </div>
        </div>`
      )
      .join('');
  };

  const renderCompetitors = data => {
    if (!data) return;
    const list = qs('#sr-competitors');
    if (list) {
      list.innerHTML = data.leaders
        .map(item => `<li>${item.company} — ${item.count}</li>`)
        .join('');
    }
    const index = qs('#sr-competitors-index');
    if (index) index.textContent = data.index;
    const summary = qs('#sr-competitors-summary');
    if (summary) summary.textContent = data.summary;
  };

  const renderTemplate = data => {
    if (!data) return;
    const role = qs('#sr-template-role');
    if (role) role.textContent = data.role;
    const meta = qs('#sr-template-meta');
    if (meta) meta.textContent = `Уровень: ${data.level} · Формат: ${data.format}`;
    const req = qs('#sr-template-req');
    if (req) req.innerHTML = data.requirements.map(item => `<li>${item}</li>`).join('');
    const tasks = qs('#sr-template-tasks');
    if (tasks) tasks.innerHTML = data.tasks.map(item => `<li>${item}</li>`).join('');
    const salary = qs('#sr-template-salary');
    if (salary) salary.textContent = data.salary;
    const note = qs('#sr-template-note');
    if (note) note.textContent = data.salaryNote;
  };

  const renderTeam = data => {
    if (!data) return;
    const container = qs('#sr-team');
    if (!container) return;
    container.innerHTML = data.members
      .map(
        item => `
        <div class="col-md-6 col-lg-4">
          <div class="card sr-card h-100">
            <div class="card-body">
              <h3 class="h6 mb-1">${item.name}</h3>
              <p class="sr-muted">${item.role} · ${item.access}</p>
              <button class="btn btn-outline-secondary btn-sm">Управлять</button>
            </div>
          </div>
        </div>`
      )
      .join('');
  };

  const renderBilling = data => {
    if (!data) return;
    const container = qs('#sr-plans');
    if (!container) return;
    container.innerHTML = data.plans
      .map(
        plan => `
        <div class="col-md-6 col-lg-4">
          <div class="card sr-card h-100${plan.featured ? ' border border-primary' : ''}">
            <div class="card-body">
              ${plan.featured ? '<span class="badge text-bg-primary">Популярный</span>' : ''}
              <h3 class="h6${plan.featured ? ' mt-2' : ''}">${plan.name}</h3>
              <p class="display-6 fw-semibold">${plan.price}</p>
              <p class="sr-muted">${plan.desc}</p>
              <button class="btn ${plan.featured ? 'btn-primary' : 'btn-outline-secondary'} btn-sm">${plan.cta}</button>
            </div>
          </div>
        </div>`
      )
      .join('');
  };

  const renderSettings = data => {
    if (!data) return;
    const notifications = qs('#sr-notifications');
    if (notifications) {
      notifications.innerHTML = data.notifications
        .map(
          (item, idx) => `
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="notif${idx}" ${
              item.enabled ? 'checked' : ''
            } />
            <label class="form-check-label" for="notif${idx}">${item.label}</label>
          </div>`
        )
        .join('');
    }
    const limits = qs('#sr-limits');
    if (limits) {
      limits.innerHTML = data.limits.map(item => `<p class="sr-muted">${item.label}: ${item.value}</p>`).join('');
    }
  };

  const renderers = {
    dashboard: renderDashboard,
    reports: renderReports,
    roles: renderRoles,
    competitors: renderCompetitors,
    template: renderTemplate,
    team: renderTeam,
    billing: renderBilling,
    settings: renderSettings
  };

  const init = async () => {
    const page = document.body.dataset.page;
    if (!page || !renderers[page]) return;
    const data = await loadJson(page);
    renderers[page](data);
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  SRPortal.init();
});
