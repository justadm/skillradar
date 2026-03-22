# Questions / TBD

1. Auth method for web portal (magic link vs OAuth vs password)?
2. Billing provider (Stripe vs YooKassa) and currency?
3. Report export format priority (PDF vs CSV first)?
4. Data retention policy for reports and queries?
5. Multi-tenant org model (single org per user vs many)?

## Notes from latest discussion (фиксируем решения/направления)

- Архитектура: единый сервер `NestJS + Vite SSR middleware` (один процесс, общая авторизация, проще деплой).
- Доступ: авторизация на весь сайт; неавторизованные видят демо‑данные в публичных разделах.
- UI: Bootstrap предпочтителен; Tailwind допустим, если будет явный выигрыш.
- Учет окружений: сейчас есть домен `valo.loc` (позже будет переименован). Важно не путать конфиги/порты/сертификаты при переносе.
- Перед релизом зафиксировать новый бренд GridAI во всех каналах и доменах.
