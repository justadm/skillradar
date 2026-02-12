const { request } = require('undici');
const { saveHhToken, getHhToken } = require('../db');

const HH_AUTH_BASE = process.env.HH_AUTH_BASE || 'https://hh.ru';

function getOAuthConfig() {
  return {
    clientId: process.env.HH_CLIENT_ID || '',
    clientSecret: process.env.HH_CLIENT_SECRET || '',
    redirectUri: process.env.HH_REDIRECT_URI || '',
    authBase: HH_AUTH_BASE
  };
}

function getAuthorizeUrl(state) {
  const cfg = getOAuthConfig();
  const url = new URL('/oauth/authorize', cfg.authBase);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForToken(code) {
  const cfg = getOAuthConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri
  }).toString();

  const res = await request(new URL('/oauth/token', cfg.authBase).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });

  const text = await res.body.text();
  if (res.statusCode >= 400) {
    throw new Error(`Token exchange failed: ${res.statusCode} ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text);
  saveHhToken(payload);
  return payload;
}

function getHhConnectionStatus() {
  const cfg = getOAuthConfig();
  const token = getHhToken();
  const now = Date.now();
  const expiresAtMs = token?.expires_at ? new Date(token.expires_at).getTime() : null;
  const connected = Boolean(token?.access_token && expiresAtMs && expiresAtMs > now);
  return {
    configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri),
    connected,
    expires_at: token?.expires_at || null,
    obtained_at: token?.obtained_at || null,
    last_success_at: token?.last_success_at || null,
    last_error_at: token?.last_error_at || null,
    last_error: token?.last_error || null
  };
}

module.exports = {
  getOAuthConfig,
  getAuthorizeUrl,
  exchangeCodeForToken,
  getHhConnectionStatus
};
