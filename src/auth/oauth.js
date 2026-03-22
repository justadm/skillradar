const { randomBytes, createHash } = require('crypto');

const PROVIDERS = ['yandex', 'vk', 'google'];

const DEFAULTS = {
  yandex: {
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    userInfoUrl: 'https://login.yandex.ru/info',
    scope: 'login:email login:info'
  },
  vk: {
    authUrl: 'https://id.vk.com/authorize',
    tokenUrl: 'https://id.vk.com/oauth2/auth',
    userInfoUrl: 'https://id.vk.com/oauth2/user_info',
    scope: 'openid profile email phone'
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile'
  }
};

function toBase64Url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = toBase64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function isSupportedProvider(provider) {
  return PROVIDERS.includes(String(provider || '').toLowerCase());
}

function getProviderEnv(provider) {
  const upper = String(provider || '').toUpperCase();
  const defaults = DEFAULTS[provider] || {};
  const fromEnv = (key, fallback = '') => String(process.env[`OAUTH_${upper}_${key}`] || fallback).trim();
  return {
    provider,
    clientId: fromEnv('CLIENT_ID'),
    clientSecret: fromEnv('CLIENT_SECRET'),
    redirectUri: fromEnv('REDIRECT_URI'),
    authUrl: fromEnv('AUTH_URL', defaults.authUrl || ''),
    tokenUrl: fromEnv('TOKEN_URL', defaults.tokenUrl || ''),
    userInfoUrl: fromEnv('USERINFO_URL', defaults.userInfoUrl || ''),
    scope: fromEnv('SCOPE', defaults.scope || ''),
    userEmailPath: fromEnv('USERINFO_EMAIL_PATH', ''),
    userNamePath: fromEnv('USERINFO_NAME_PATH', '')
  };
}

function getProviderConfig(provider) {
  const normalized = String(provider || '').toLowerCase();
  if (!isSupportedProvider(normalized)) return null;
  const cfg = getProviderEnv(normalized);
  cfg.enabled = Boolean(cfg.clientId && cfg.redirectUri && cfg.authUrl && cfg.tokenUrl && cfg.userInfoUrl);
  return cfg;
}

function getProviderList() {
  return PROVIDERS.map(provider => {
    const cfg = getProviderConfig(provider);
    return {
      provider,
      enabled: Boolean(cfg?.enabled)
    };
  });
}

function buildAuthorizeUrl(config, state, codeChallenge) {
  const url = new URL(config.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function exchangeCodeForAccessToken(config, code, verifier, options = {}) {
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: verifier
  });
  if (config.provider === 'vk') {
    const state = String(options.state || '').trim();
    const deviceId = String(options.deviceId || '').trim();
    if (state) payload.set('state', state);
    if (deviceId) payload.set('device_id', deviceId);
  }
  if (config.clientSecret) {
    payload.set('client_secret', config.clientSecret);
  }
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_) {
    parsed = { raw: text };
  }
  if (!response.ok || !parsed.access_token) {
    throw new Error(`OAuth token exchange failed (${response.status})`);
  }
  return parsed;
}

function pickByPath(input, pathExpr) {
  if (!pathExpr) return '';
  const keys = String(pathExpr).split('.').map(v => v.trim()).filter(Boolean);
  let value = input;
  for (const key of keys) {
    if (!value || typeof value !== 'object') return '';
    value = value[key];
  }
  return typeof value === 'string' ? value : '';
}

function normalizeUserProfile(provider, profile, config) {
  if (provider === 'yandex') {
    const email = String(
      profile.default_email
      || (Array.isArray(profile.emails) ? profile.emails[0] : '')
      || ''
    ).toLowerCase();
    const name = String(profile.real_name || profile.display_name || profile.first_name || '').trim();
    return {
      externalUserId: String(profile.id || profile.psuid || '').trim(),
      email,
      name,
      raw: profile
    };
  }
  if (provider === 'google') {
    const email = String(profile.email || '').toLowerCase();
    const name = String(profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ')).trim();
    return {
      externalUserId: String(profile.sub || profile.id || '').trim(),
      email,
      name,
      raw: profile
    };
  }
  if (provider === 'vk') {
    const source = profile.user && typeof profile.user === 'object'
      ? profile.user
      : profile.response && typeof profile.response === 'object'
        ? profile.response
        : profile;
    const email = String(
      source.email
      || profile.email
      || ''
    ).toLowerCase();
    const name = String(
      source.name
      || [source.first_name, source.last_name].filter(Boolean).join(' ')
      || profile.name
      || ''
    ).trim();
    return {
      externalUserId: String(
        source.user_id
        || source.id
        || profile.user_id
        || profile.sub
        || ''
      ).trim(),
      email,
      name,
      raw: profile
    };
  }
  const email = String(
    pickByPath(profile, config.userEmailPath)
    || profile.email
    || profile.mail
    || ''
  ).toLowerCase();
  const name = String(
    pickByPath(profile, config.userNamePath)
    || profile.name
    || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  ).trim();
  return {
    externalUserId: String(
      pickByPath(profile, 'sub')
      || profile.id
      || profile.user_id
      || profile.uid
      || ''
    ).trim(),
    email,
    name,
    raw: profile
  };
}

async function fetchUserProfile(config, accessToken) {
  const url = new URL(config.userInfoUrl);
  if (config.provider === 'yandex') {
    url.searchParams.set('format', 'json');
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_) {
    parsed = {};
  }
  if (!response.ok) {
    throw new Error(`OAuth userinfo failed (${response.status})`);
  }
  const normalized = normalizeUserProfile(config.provider, parsed, config);
  if (!normalized.externalUserId) {
    throw new Error('OAuth profile external user id is missing');
  }
  return normalized;
}

module.exports = {
  createPkcePair,
  getProviderConfig,
  getProviderList,
  buildAuthorizeUrl,
  exchangeCodeForAccessToken,
  fetchUserProfile
};
