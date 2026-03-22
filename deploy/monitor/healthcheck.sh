#!/bin/sh
set -eu

ALERT_TG_BOT_TOKEN="${ALERT_TG_BOT_TOKEN:-}"
ALERT_TG_CHAT_ID="${ALERT_TG_CHAT_ID:-}"
ALERT_URL="${ALERT_URL:-http://web:3000}"
INTERVAL="${ALERT_INTERVAL:-60}"
BOT_CONTAINER="${ALERT_BOT_CONTAINER:-gridai-bot}"
NGINX_CONTAINER="${ALERT_NGINX_CONTAINER:-gridai-nginx}"
ALERT_ON_5XX="${ALERT_ON_5XX:-true}"

send_alert() {
  if [ -z "$ALERT_TG_BOT_TOKEN" ] || [ -z "$ALERT_TG_CHAT_ID" ]; then
    return 0
  fi
  curl -s -X POST "https://api.telegram.org/bot${ALERT_TG_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "{\"chat_id\":\"${ALERT_TG_CHAT_ID}\",\"text\":\"$1\"}" >/dev/null 2>&1 || true
}

check_container() {
  name="$1"
  label="$2"
  if [ -z "$name" ]; then
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)
  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || true)
  if [ "$status" != "running" ]; then
    send_alert "[GridAI] ${label} container not running: ${name} (status: ${status:-unknown})"
    return 0
  fi
  if [ "$health" != "none" ] && [ "$health" != "healthy" ]; then
    send_alert "[GridAI] ${label} health not OK: ${name} (health: ${health})"
  fi
}

check_web() {
  if command -v curl >/dev/null 2>&1; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$ALERT_URL" || true)
    if [ "$status" = "" ] || [ "$status" -lt 200 ] || [ "$status" -ge 500 ]; then
      send_alert "[GridAI] Web healthcheck failed: ${ALERT_URL} (status: ${status:-unknown})"
    fi
    if [ "$ALERT_ON_5XX" = "true" ] && [ "$status" -ge 500 ]; then
      send_alert "[GridAI] Web 5xx detected: ${ALERT_URL} (status: ${status})"
    fi
  fi
}

while true; do
  check_web
  check_container "$BOT_CONTAINER" "Bot"
  check_container "$NGINX_CONTAINER" "Nginx"
  sleep "$INTERVAL"
done
