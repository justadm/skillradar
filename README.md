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

- `+3` ключевой навык найден в описании.
- `+2` опыт совпал (junior/middle/senior).
- `+2` зарплата ≥ ожиданий.
- `-3` зарплата ниже ожиданий.
- Если указанная зарплата выше максимума в вакансии — вакансия скрывается.
- `+1` 2+ совпадений навыков.
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
- `Рынок роли` — базовые метрики по роли.
- `Конкуренты` — топ работодателей по роли.
- `Шаблон вакансии` — требования и вилка по рынку.

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
- `HH_AREA_DEFAULT` (default: `113`)
- `HH_CACHE_TTL_MS` (default: `21600000`, 6 часов)
- `DB_PATH` (default: `data/db.sqlite`)
- `APP_PORT`
- `APP_URL`
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX` (default: `10`)
- `ADMIN_TG_IDS` (comma‑separated Telegram user ids)

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
