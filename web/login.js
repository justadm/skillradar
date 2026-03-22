const apiBase = '/api/v1';

const loginForm = document.getElementById('login-form');
const verifyForm = document.getElementById('verify-form');
const loginResult = document.getElementById('login-result');
const verifyResult = document.getElementById('verify-result');
const inviteResult = document.getElementById('invite-result');
const oauthBlock = document.getElementById('oauth-block');
const oauthProviders = document.getElementById('oauth-providers');
const emailInput = document.getElementById('email');
const tokenInput = document.getElementById('token');
const requestInviteBtn = document.getElementById('request-invite');
let telegramPollTimer = null;
let maxPollTimer = null;
const pendingLoginKey = 'sr-pending-web-login';

function getIntent() {
  const params = new URLSearchParams(window.location.search);
  const queryIntent = String(params.get('intent') || '').toLowerCase();
  if (queryIntent === 'career' || queryIntent === 'hiring') return queryIntent;
  const host = window.location.hostname;
  if (host === 'career.gridai.ru') return 'career';
  if (host === 'hiring.gridai.ru') return 'hiring';
  const path = window.location.pathname.toLowerCase();
  if (path === '/hiring' || path.startsWith('/hiring/')) return 'hiring';
  return 'career';
}

function syncIntentInUrl(intent) {
  const params = new URLSearchParams(window.location.search);
  params.set('intent', intent);
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}?${query}`);
}

function getAuthOrigin() {
  return window.location.hostname === 'auth.gridai.ru'
    ? 'https://auth.gridai.ru'
    : window.location.origin;
}

function getAppOrigin(intent = getIntent()) {
  if (!window.location.hostname.endsWith('gridai.ru')) return window.location.origin;
  return intent === 'hiring' ? 'https://hiring.gridai.ru' : 'https://career.gridai.ru';
}

function getAppHome(intent = getIntent()) {
  return intent === 'hiring' ? '/hiring/dashboard.html' : '/career/dashboard.html';
}

const providerMeta = {
  yandex: { label: 'Яндекс ID', icon: 'Я' },
  google: { label: 'Google', icon: 'G' },
  vk: { label: 'VK', icon: 'VK' },
  telegram: { label: 'Telegram', icon: 'TG' },
  max: { label: 'MAX', icon: 'M' }
};

function finishLogin(intent = getIntent(), redirectUrl = '') {
  localStorage.setItem('sr-authed', '1');
  localStorage.removeItem('sr-token');
  localStorage.setItem('sr-api-base', apiBase);
  sessionStorage.removeItem(pendingLoginKey);
  setTimeout(() => {
    window.location.href = redirectUrl || `${getAppOrigin(intent)}${getAppHome(intent)}`;
  }, 800);
}

function stopPolling(kind) {
  if (kind === 'telegram' && telegramPollTimer) {
    clearInterval(telegramPollTimer);
    telegramPollTimer = null;
  }
  if (kind === 'max' && maxPollTimer) {
    clearInterval(maxPollTimer);
    maxPollTimer = null;
  }
}

function savePendingLogin(payload) {
  sessionStorage.setItem(pendingLoginKey, JSON.stringify(payload));
}

function loadPendingLogin() {
  try {
    const raw = sessionStorage.getItem(pendingLoginKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function pollBotLogin(kind, payload) {
  const intent = payload.intent || getIntent();
  const deadline = Number(payload.deadline || 0);
  const requestId = String(payload.requestId || '');
  if (!requestId) return;
  loginResult.classList.remove('d-none');
  const tick = async () => {
    if (Date.now() > deadline) {
      stopPolling(kind);
      sessionStorage.removeItem(pendingLoginKey);
      loginResult.className = 'alert alert-warning mt-3';
      loginResult.textContent = 'Время ожидания истекло. Попробуйте снова.';
      return;
    }
    const statusRes = await fetch(`${apiBase}/auth/${kind}/web-login/status?requestId=${encodeURIComponent(requestId)}`, {
      credentials: 'include'
    });
    const statusData = await statusRes.json().catch(() => ({}));
    if (statusData?.status === 'authorized' && statusData?.user) {
      stopPolling(kind);
      loginResult.className = 'alert alert-success mt-3';
      loginResult.textContent = 'Готово! Переходим в кабинет…';
      finishLogin(statusData.intent || intent, statusData.redirectUrl || '');
      return;
    }
    if (statusData?.status === 'error') {
      stopPolling(kind);
      sessionStorage.removeItem(pendingLoginKey);
      loginResult.className = 'alert alert-warning mt-3';
      loginResult.textContent = `Вход не завершён: ${statusData.error || 'unknown_error'}`;
      return;
    }
    if (statusData?.status === 'expired') {
      stopPolling(kind);
      sessionStorage.removeItem(pendingLoginKey);
      loginResult.className = 'alert alert-warning mt-3';
      loginResult.textContent = 'Ссылка устарела. Запустите вход заново.';
    }
  };

  await tick();
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, 2000);
  if (kind === 'telegram') {
    telegramPollTimer = timer;
  } else {
    maxPollTimer = timer;
  }
}

async function startBotLogin(kind) {
  const intent = getIntent();
  loginResult.className = 'alert alert-info mt-3';
  loginResult.textContent = `Запускаем вход через ${kind === 'telegram' ? 'Telegram' : 'MAX'}...`;
  loginResult.classList.remove('d-none');
  stopPolling(kind);
  const res = await fetch(`${apiBase}/auth/${kind}/web-login/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ intent })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    loginResult.className = 'alert alert-warning mt-3';
    loginResult.textContent = data?.error?.message || `Не удалось запустить вход через ${kind}.`;
    return;
  }

  const pendingPayload = {
    kind,
    intent,
    requestId: data.requestId,
    deadline: Date.now() + Math.max(30, Number(data.expiresIn || 180)) * 1000
  };
  savePendingLogin(pendingPayload);

  const botUrl = String(data.botUrl || '').trim();
  if (botUrl) {
    window.open(botUrl, '_blank', 'noopener,noreferrer');
  }
  loginResult.textContent = kind === 'max' && data.command
    ? `Откройте MAX-бота и подтвердите вход. Если deeplink не сработал, отправьте команду: ${data.command}`
    : `Откройте ${kind === 'telegram' ? 'Telegram-бота' : 'MAX-бота'} и подтвердите вход. Мы завершим его автоматически.`;

  await pollBotLogin(kind, pendingPayload);
}

function renderOAuthProviders(items) {
  if (!oauthProviders) return;
  oauthProviders.innerHTML = '';
  const enabled = Array.isArray(items) ? items.filter(item => item?.enabled) : [];
  if (!enabled.length) {
    oauthBlock?.classList.add('d-none');
    return;
  }
  enabled.forEach((item) => {
    const provider = String(item.provider || '').toLowerCase();
    const meta = providerMeta[provider] || { label: provider, icon: provider.charAt(0).toUpperCase() };
    const mode = String(item.mode || 'oauth');
    const button = document.createElement(mode === 'oauth' ? 'a' : 'button');
    button.className = 'sr-provider-btn';
    button.innerHTML = `<span class="sr-provider-icon">${meta.icon}</span><span>Продолжить через ${meta.label}</span>`;
    if (mode === 'oauth') {
      button.href = `${getAuthOrigin()}${apiBase}/auth/oauth/${provider}/start?intent=${encodeURIComponent(getIntent())}`;
    } else {
      button.type = 'button';
      button.addEventListener('click', () => {
        startBotLogin(provider).catch(() => {});
      });
    }
    oauthProviders.appendChild(button);
  });
  oauthBlock?.classList.remove('d-none');
}

const currentIntent = getIntent();
syncIntentInUrl(currentIntent);

fetch(`${apiBase}/auth/oauth/providers?intent=${encodeURIComponent(currentIntent)}`)
  .then((res) => res.ok ? res.json() : { items: [] })
  .then((data) => renderOAuthProviders(data?.items))
  .catch(() => {});

const params = new URLSearchParams(window.location.search);
const tokenFromUrl = params.get('token');
const oauthError = params.get('oauth_error');
if (tokenFromUrl && tokenInput) {
  tokenInput.value = tokenFromUrl;
  tokenInput.focus();
}
if (oauthError) {
  loginResult.textContent = `OAuth вход не удался: ${oauthError}`;
  loginResult.classList.remove('d-none');
}

const pendingLogin = loadPendingLogin();
if (pendingLogin && pendingLogin.intent === currentIntent && Number(pendingLogin.deadline || 0) > Date.now()) {
  loginResult.className = 'alert alert-info mt-3';
  loginResult.textContent = `Возобновляем вход через ${pendingLogin.kind === 'telegram' ? 'Telegram' : 'MAX'}...`;
  loginResult.classList.remove('d-none');
  pollBotLogin(String(pendingLogin.kind || 'telegram'), pendingLogin).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  const pending = loadPendingLogin();
  if (!pending || document.visibilityState !== 'visible') return;
  pollBotLogin(String(pending.kind || 'telegram'), pending).catch(() => {});
});

window.addEventListener('focus', () => {
  const pending = loadPendingLogin();
  if (!pending) return;
  pollBotLogin(String(pending.kind || 'telegram'), pending).catch(() => {});
});

document.querySelectorAll('[data-auth-intent]').forEach((node) => {
  const intent = String(node.getAttribute('data-auth-intent') || '');
  node.classList.toggle('active', intent === currentIntent);
  node.addEventListener('click', () => {
    window.location.href = `${getAuthOrigin()}/${intent}`;
  });
});

document.querySelectorAll('[data-auth-copy]').forEach((node) => {
  const intent = String(node.getAttribute('data-auth-copy') || '');
  node.classList.toggle('d-none', intent !== currentIntent);
});

if (requestInviteBtn) {
  requestInviteBtn.addEventListener('click', async () => {
    inviteResult.className = 'alert alert-info mt-3';
    inviteResult.textContent = 'Отправляем запрос...';
    const email = emailInput.value.trim();
    if (!email) {
      inviteResult.className = 'alert alert-warning mt-3';
      inviteResult.textContent = 'Сначала укажите email, на который нужно отправить приглашение.';
      return;
    }
    const res = await fetch(`${apiBase}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        company: '',
        source: `login_invite_${currentIntent}`,
        message: currentIntent === 'hiring'
          ? 'Запрос приглашения на hiring-контур со страницы входа'
          : 'Запрос приглашения на career-контур со страницы входа'
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      inviteResult.className = 'alert alert-warning mt-3';
      inviteResult.textContent = data?.error?.message || 'Не удалось отправить запрос приглашения.';
      return;
    }
    inviteResult.className = 'alert alert-success mt-3';
    inviteResult.textContent = 'Запрос приглашения отправлен. Мы свяжемся с вами после проверки доступа.';
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginResult.classList.add('d-none');
  const email = emailInput.value.trim();
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, intent: currentIntent })
  });
  const data = await res.json();
  if (!res.ok) {
    loginResult.textContent = data?.error?.message || 'Ошибка отправки.';
    loginResult.classList.remove('d-none');
    return;
  }
  loginResult.textContent = 'Ссылка для входа отправлена на email. Можно перейти по ней или вставить код ниже.';
  loginResult.classList.remove('d-none');
  tokenInput.focus();
});

verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  verifyResult.classList.add('d-none');
  const token = tokenInput.value.trim();
  const res = await fetch(`${apiBase}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, intent: currentIntent })
  });
  const data = await res.json();
  if (!res.ok) {
    verifyResult.textContent = data?.error?.message || 'Ошибка проверки.';
    verifyResult.classList.remove('d-none');
    return;
  }
  verifyResult.textContent = 'Готово! Переходим в кабинет…';
  verifyResult.classList.remove('d-none');
  finishLogin(data.intent || currentIntent, data.redirect_url || '');
});
