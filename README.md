# SkillRadar (working name)

Телеграм‑сервис для соискателей в РФ: умный подбор вакансий по навыкам/опыту/зарплате + быстрые инсайты рынка по роли/навыку. Основан на API hh.ru и OpenAI.

## 1. Что это

**SkillRadar** — TG‑бот, который:
- принимает запрос в свободной форме (роль, опыт, навыки, зарплата),
- превращает его в точные фильтры hh.ru,
- выдает топ‑10 вакансий с пояснением «почему подходит»,
- показывает краткий срез рынка по роли/навыкам.

MVP ориентирован на соискателей и рынок РФ. Канал — только Telegram.

## 2. Основные сценарии

### 2.1 Подбор вакансий
1. Пользователь пишет запрос (например: «Frontend, 3+ года, React/TS, от 150к»).
2. LLM парсит критерии → структурированный JSON.
3. Запрос к hh.ru с фильтрами.
4. Фильтрация по стоп‑листу.
5. Скоринг и выдача 10 лучших вакансий + объяснение.

### 2.2 Рынок навыков
1. Пользователь вводит роль/навык.
2. Запрос к hh.ru с широкими фильтрами.
3. Подсчет метрик: количество вакансий, частые навыки, доля удаленки, диапазон зарплат.
4. Короткий аналитический комментарий от LLM.

## 3. Архитектура (MVP)

- **Bot layer**: Telegram (Telegraf).
- **Service layer**: парсинг критериев, запросы hh.ru, скоринг.
- **LLM layer**: OpenAI (парсер и краткие объяснения).
- **Storage**: SQLite (кэш, пользователи, стоп‑лист).

Важно: требования hh.ru к инфраструктуре — размещение серверов в РФ.

## 4. Хранилище (SQLite)

Файл: `data/db.sqlite` (путь configurable через `DB_PATH`).

Таблицы (MVP):
- `users` — `tg_id`, `created_at`, `region`.
- `stoplist` — `user_id`, `word`.
- `queries` — `user_id`, `type`, `raw_text`, `filters_json`, `created_at`.
- `vacancies_cache` — `vacancy_id`, `raw_json`, `fetched_at`.
- `market_cache` — `query_key`, `stats_json`, `fetched_at`.

## 5. Интеграции

### 5.1 hh.ru API (минимальный набор)
- `GET /vacancies` — основной поиск вакансий.
- `GET /vacancies/{id}` — детали вакансии для объяснений.
- `GET /areas` — справочник регионов.
- `GET /professional_roles` — справочник ролей.
- `GET /skills` — справочник навыков.

### 5.2 OpenAI
Модели:
- `gpt-4.1-mini` — парсинг критериев + объяснения.
- `gpt-4.1-nano` — комментарий по рынку.

## 6. Скоринг (MVP)

- `+3` совпадение роли в тексте вакансии.
- `+3` 1+ ключевой навык, `+2` за 2+ навыка, `+1` за 4+ навыка.
- `+1` за совпадение ключевых слов (1+), `+1` за 3+ ключевых слов.
- `+2` опыт совпал (junior/middle/senior), `-1` за явное несоответствие.
- `+2` зарплата ≥ ожиданий, `-3` зарплата ниже ожиданий.
- `-2` совпадение со стоп‑словом.

## 7. Команды TG (MVP)

- `/start` — вход и выбор сценария.
- `Подбор вакансий` — запрос → выдача топ‑10.
- `Рынок навыков` — короткий отчет.
- `Мои стоп‑слова` — добавить/удалить слова/компании.
- `/reset` — сброс состояния и возврат в главное меню.
- `/help` — подсказка по формату запросов.
- `Показать еще` — постраничная выдача (по 3 вакансии).
- `Сохранить запрос` — сохранить текущий поиск.
- `/repeat` — повторить последний сохраненный поиск.
- `B2B Аналитика` — режим HR‑аналитики (TG).
- `Рынок роли` — базовые метрики по роли, сегменты по городам/уровням и тренд 7 дней (по выборке), поддержка фильтров (город/уровень/тип компании).
- `Конкуренты` — топ работодателей по роли.
- `Шаблон вакансии` — требования и вилка по рынку.
- `Экспорт отчета` — выгрузка последнего B2B‑отчета (PDF + TXT).
- `Тарифы и лимиты` — показать текущие лимиты B2B.
- `/health` — быстрый health‑check.
- `/debug` — админский debug‑статус.

## 8. Промпты (MVP)

**Парсер критериев (JSON‑only):**
```json
{
  "role": "",
  "skills": [],
  "salary": {"amount": 0, "currency": "RUR"},
  "experience": "junior|middle|senior|unknown",
  "keywords": [],
  "exclude": []
}
```

**Объяснение вакансии:** 1–2 предложения, кратко.

**Рынок навыков:** 1–2 предложения, без воды.

## 9. Конфигурация (env)

- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL_MAIN` (default: `gpt-4.1-mini`)
- `OPENAI_MODEL_MARKET` (default: `gpt-4.1-nano`)
- `LLM_CACHE_TTL_MS` (default: `86400000`, 24 часа)
- `USE_MOCKS` (default: `false`) — использовать мок‑данные без внешних API.
- `HH_API_BASE` (default: `https://api.hh.ru`)
- `HH_AUTH_BASE` (default: `https://hh.ru`)
- `HH_CLIENT_ID`
- `HH_CLIENT_SECRET`
- `HH_REDIRECT_URI` (например `https://localhost:3000/oauth/hh/callback`)
- `HH_AREA_DEFAULT` (default: `113`)
- `HH_CACHE_TTL_MS` (default: `21600000`, 6 часов)
- `DB_PATH` (default: `data/db.sqlite`)
- `APP_PORT`
- `APP_URL`
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX` (default: `10`)
- `ADMIN_TG_IDS` (comma‑separated Telegram user ids)
- `B2B_DAILY_LIMIT` (default: `3`) — лимит B2B‑отчетов в день.
- `LEAD_TG_BOT_TOKEN` / `LEAD_TG_CHAT_ID` — уведомления о заявках в Telegram.
- `LEAD_EMAIL_TO` + SMTP* — уведомления о заявках по email.
- `OPS_TG_BOT_TOKEN` / `OPS_TG_CHAT_ID` — уведомления об операциях в Telegram.
- `OPS_EMAIL_TO` + SMTP* — уведомления об операциях по email.

## 10. Структура репозитория (план)

```
/Users/just/Sites/sbdb.loc
├── src/
│   ├── bot/          # Telegram handlers
│   ├── hh/           # HH API client + mappers
│   ├── llm/          # OpenAI client + prompts
│   ├── score/        # scoring rules
│   ├── db/           # sqlite schema + repo
│   └── utils/
├── data/
├── README.md
├── ROADMAP.md
└── TODO.md
```

## 11. Ограничения MVP

- Web пока статический (лендинг + демо‑портал на мок‑данных).
- Без рассылок/авто‑уведомлений.
- Только рынок РФ.

---

## 11.1 Compliance (HH API)

- Используем только публичные данные вакансий и справочники.
- Не используем доступ к резюме/откликам.
- Не собираем логины/пароли hh.ru.
- Не формируем отдельную базу данных для выдачи третьим лицам.
- Любое использование данных строго в рамках тематики рынка труда.
- При регистрации пользователей в приложении — обязателен чек‑бокс согласия с офертой hh.ru.
- Архивные вакансии не должны оставаться в выдаче.

## 11.2 Offline / Mock режим

Если есть проблемы с доступом к внешним API (HH/OpenAI), можно работать полностью офлайн:
- `USE_MOCKS=true`
- `OPENAI_API_KEY` можно оставить пустым
- Бот будет использовать мок‑данные вакансий и стабильные ответы LLM

Это позволяет тестировать UX и сценарии без сети.

## 12. Быстрый старт

1. Установить зависимости:
```bash
npm install
```

2. Создать `.env` на основе примера:
```bash
cp .env.example .env
```
Если `.env` отсутствует, при запуске будет автоматически создан из `.env.example`.

3. Заполнить переменные:
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`

4. Запуск в dev:
```bash
npm run dev
```

5. Запуск в prod:
```bash
npm start
```

---

## Docker

Быстрый запуск (SSR + Bot + Nginx):
```bash
docker compose up -d --build
```

Сервисы:
- `web` — SSR (порт 3000)
- `bot` — Telegram‑бот (без web, `DISABLE_WEB=true`)
- `nginx` — прокси на 80 порт

Полезное:
```bash
docker compose logs -f web
docker compose logs -f bot
docker compose down
```

Если нужен только SSR без nginx:
```bash
docker compose up -d --build web
```

Важно:
- База SQLite хранится в `./data` (volume).
- Для bot и web используйте одинаковый `.env`.

### Dev‑режим
Для локальной разработки используйте `docker-compose.override.yml`:
```bash
docker compose up -d --build
```
В dev будет использоваться `npm run dev:ssr` и `npm run dev` (hot reload).

### Runtime‑образ
Для минимального прод‑образа есть `Dockerfile.runtime`:
```bash
docker build -f Dockerfile.runtime -t skillradar-runtime .
```

### Docker env шаблон
Для контейнеров используйте:
```bash
cp .env.docker.example .env
```

### Логи контейнеров (logrotate)
Есть шаблон `deploy/docker-logs.conf`. Установить на сервере:
```bash
sudo cp deploy/docker-logs.conf /etc/logrotate.d/skillradar-docker
sudo logrotate -f /etc/logrotate.d/skillradar-docker
```

### Мониторинг (простые алерты)
Добавлен контейнер `monitor`, который пингует web и отправляет алерты в TG.
Настройки в `.env` / `.env.docker.example`:
```
ALERT_TG_BOT_TOKEN=
ALERT_TG_CHAT_ID=
ALERT_URL=http://web:3000
ALERT_INTERVAL=60
ALERT_BOT_CONTAINER=skillradar-bot
ALERT_NGINX_CONTAINER=skillradar-nginx
ALERT_ON_5XX=true
```

### Systemd (docker compose)
Шаблон юнита: `deploy/skillradar-docker.service`
```bash
sudo cp deploy/skillradar-docker.service /etc/systemd/system/skillradar-docker.service
sudo systemctl daemon-reload
sudo systemctl enable skillradar-docker
sudo systemctl start skillradar-docker
sudo systemctl status skillradar-docker
```

---

## 13. Тест‑сценарии

См. `TEST_SCENARIOS.md`.

---

Если нужно, добавлю техническую спецификацию API, схемы БД и каркас кода.

---

## 14. Deploy (Ubuntu + systemd)

1. Клонировать репозиторий:
```bash
git clone git@github.com:justadm/skillradar.git /opt/skillradar
cd /opt/skillradar
```

2. Установить Node 22 (через nvm) и зависимости:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
npm install
```

3. Создать `.env`:
```bash
cp .env.example .env
```

4. Установить systemd unit (вариант A — через NVM):
```bash
sudo cp /opt/skillradar/deploy/skillradar.service /etc/systemd/system/skillradar.service
sudo systemctl daemon-reload
sudo systemctl enable skillradar
sudo systemctl start skillradar
sudo systemctl status skillradar
```

Вариант B — без NVM (system node):
```bash
sudo cp /opt/skillradar/deploy/skillradar.systemnode.service /etc/systemd/system/skillradar.service
sudo systemctl daemon-reload
sudo systemctl enable skillradar
sudo systemctl start skillradar
sudo systemctl status skillradar
```

Логи:
```bash
sudo tail -f /var/log/skillradar.log
```

---

## 15. Web (Landing)

Web‑сервер (статика + API):
```bash
npm run dev
```

Локально открыть:
```bash
open /Users/just/Sites/sbdb.loc/web/index.html
```

Админ‑страница:
```bash
open /Users/just/Sites/sbdb.loc/web/admin.html
```

ЛК (портал):
```bash
open /Users/just/Sites/sbdb.loc/web/portal/dashboard.html
```

UI‑kit:
```bash
open /Users/just/Sites/sbdb.loc/web/ui-kit.html
```

Логин:
```bash
open /Users/just/Sites/sbdb.loc/web/login.html
```

API (dev):
- `POST /api/v1/auth/login` → вернёт `debug_token` в non‑prod
- `POST /api/v1/auth/verify` → выдаст `Bearer` токен

---

## 16. Web SSR (Vue + Vite + NestJS)

SSR сервер (единый процесс + API, порт по умолчанию: `3001`):
```bash
npm run dev:ssr
```

Сборка SSR:
```bash
npm run build:ssr
npm run start:ssr
```

Код SSR фронта:
- `/Users/just/Sites/sbdb.loc/apps/web-ssr`
