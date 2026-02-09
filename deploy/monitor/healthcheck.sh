#!/bin/sh
set -eu

ALERT_TG_BOT_TOKEN="${ALERT_TG_BOT_TOKEN:-}"
ALERT_TG_CHAT_ID="${ALERT_TG_CHAT_ID:-}"
ALERT_URL="${ALERT_URL:-http://web:3000}"
INTERVAL="${ALERT_INTERVAL:-60}"
BOT_CONTAINER="${ALERT_BOT_CONTAINER:-skillradar-bot}"

send_alert() {
  if [ -z "$ALERT_TG_BOT_TOKEN" ] || [ -z "$ALERT_TG_CHAT_ID" ]; then
    return 0
  fi
  curl -s -X POST "https://api.telegram.org/bot${ALERT_TG_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "{\"chat_id\":\"${ALERT_TG_CHAT_ID}\",\"text\":\"$1\"}" >/dev/null 2>&1 || true
}

check_bot() {
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  status=$(docker inspect -f '{{.State.Status}}' "$BOT_CONTAINER" 2>/dev/null || true)
  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$BOT_CONTAINER" 2>/dev/null || true)
  if [ "$status" != "running" ]; then
    send_alert "[SkillRadar] Bot container not running: ${BOT_CONTAINER} (status: ${status:-unknown})"
    return 0
  fi
  if [ "$health" != "none" ] && [ "$health" != "healthy" ]; then
    send_alert "[SkillRadar] Bot health not OK: ${BOT_CONTAINER} (health: ${health})"
  fi
}

while true; do
  if ! curl -fsS "$ALERT_URL" >/dev/null 2>&1; then
    send_alert "[SkillRadar] Web healthcheck failed: ${ALERT_URL}"
  fi
  check_bot
  sleep "$INTERVAL"
done
