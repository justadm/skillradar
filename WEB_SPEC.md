# ТЗ: Веб‑сайт + Личный кабинет (SkillRadar)

Документ описывает структуру сайта, экраны ЛК, роли/доступы и API‑контракты.

---

## 1) Разделы сайта (публичные)

1. **Главная**
   - УТП, CTA, краткие блоки возможностей
2. **B2B‑аналитика**
   - описание функций, примеры отчётов, CTA
3. **Аналитика/Отчёты**
   - каталог примеров отчётов (read‑only)
4. **Новости / Анонсы**
   - релизы, обновления, кейсы
5. **Тарифы**
   - планы, лимиты, CTA
6. **FAQ**
   - вопросы, политика данных
7. **Контакты**
   - email, TG, форма

---

## 2) Роли и доступы

### Роли
- **Owner** — полный доступ, биллинг
- **Admin** — управление командой, отчёты
- **Analyst** — просмотр и создание отчётов
- **Viewer** — только просмотр

### Политика доступа
| Раздел | Owner | Admin | Analyst | Viewer |
|---|---|---|---|---|
| Дашборд | ✓ | ✓ | ✓ | ✓ |
| Отчёты | ✓ | ✓ | ✓ | ✓ |
| Экспорт PDF/CSV | ✓ | ✓ | ✓ | ✕ |
| Команда | ✓ | ✓ | ✕ | ✕ |
| Тарифы/Оплата | ✓ | ✕ | ✕ | ✕ |
| Настройки | ✓ | ✓ | ✕ | ✕ |

---

## 3) Экраны ЛК (детально)

### 3.1 Дашборд
**Цель:** быстрый обзор рынка и активных ролей  
**Содержимое:**
- метрики: вакансий, удалёнка %, средняя вилка
- последние отчёты
- быстрые действия: «Новый отчёт», «Шаблон вакансии»

### 3.2 Отчёты
**Цель:** список и история  
**Содержимое:**
- таблица отчётов (роль, город, дата, статус)
- фильтры по роли/городу/дате
- экспорт PDF/CSV

### 3.3 Роль‑профили
**Цель:** сохранить шаблоны запросов  
**Содержимое:**
- имя профиля, ключевые навыки, город
- частота обновлений (если планируется)

### 3.4 Конкуренты
**Цель:** мониторинг работодателей  
**Содержимое:**
- топ компаний по роли
- изменение по периодам (если есть)

### 3.5 Шаблон вакансии
**Цель:** быстрый генератор требований  
**Содержимое:**
- роль, уровень, город
- рекомендуемая вилка
- топ‑навыки

### 3.6 Команда
**Цель:** управление участниками  
**Содержимое:**
- список пользователей
- инвайты
- роли (Owner/Admin/Analyst/Viewer)

### 3.7 Тарифы и оплата
**Цель:** управление подпиской  
**Содержимое:**
- текущий тариф
- лимиты по отчётам
- история платежей

### 3.8 Настройки
**Цель:** системные настройки  
**Содержимое:**
- профиль компании
- timezone
- методы уведомлений

---

## 4) API контракты (v1, черновик)

### 4.1 Общие правила
- **Base URL:** `/api/v1`
- **Auth:** `Authorization: Bearer <token>`
- **Пагинация:** `limit` (по умолчанию 20), `offset`
- **Ошибка (единый формат):**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid role",
      "details": {"field": "role"}
    }
  }
  ```

### 4.2 Схемы (упрощённо)
**Report**
```json
{
  "id": "rep_123",
  "org_id": "org_1",
  "type": "market|competitors|template",
  "role": "Backend Node.js",
  "level": "middle",
  "city": "Москва",
  "schedule": "remote|office|hybrid",
  "employment": "full|part|project",
  "salary_min": 180000,
  "salary_max": 260000,
  "currency": "RUR",
  "stats": {
    "vacancies": 1240,
    "remote_share": 0.38,
    "avg_from": 170000,
    "avg_to": 250000,
    "top_skills": ["node.js", "sql", "docker"]
  },
  "status": "ready|processing|failed",
  "created_at": "2026-02-08T12:00:00Z",
  "updated_at": "2026-02-08T12:10:00Z"
}
```

**RoleProfile**
```json
{
  "id": "role_1",
  "name": "Backend Moscow",
  "role": "Backend Node.js",
  "level": "middle",
  "city": "Москва",
  "skills": ["node.js", "sql", "docker"],
  "schedule": "hybrid",
  "employment": "full",
  "salary_min": 180000,
  "salary_max": 260000,
  "created_by": "user_1",
  "updated_at": "2026-02-08T10:00:00Z"
}
```

**TeamMember**
```json
{"id":"user_1","name":"Константин Т.","role":"owner","email":"admin@skillradar.ai","status":"active"}
```

### 4.3 Auth
- `POST /api/v1/auth/login`
  - body: `{ "email": "user@company.com" }`
  - response: `{ "status": "sent" }`
- `POST /api/v1/auth/verify`
  - body: `{ "token": "magic_token" }`
  - response: `{ "token": "jwt", "user": { ... } }`

### 4.4 Reports
- `GET /api/v1/reports?limit=20&offset=0`
  - response: `{ "items": [Report], "total": 124 }`
- `POST /api/v1/reports`
  - body:
    ```json
    {
      "type": "market",
      "role": "Backend Node.js",
      "level": "middle",
      "city": "Москва",
      "skills": ["node.js", "sql"],
      "salary_min": 180000,
      "salary_max": 260000,
      "schedule": "remote",
      "employment": "full"
    }
    ```
  - response: `{ "id": "rep_123", "status": "processing" }`
- `GET /api/v1/reports/:id`
  - response: `Report`
- `GET /api/v1/reports/:id/export?format=pdf|csv`
  - response: файл (стрим)

### 4.5 Role Profiles
- `GET /api/v1/roles`
  - response: `{ "items": [RoleProfile] }`
- `POST /api/v1/roles`
  - body: `RoleProfile (без id)`
  - response: `RoleProfile`
- `DELETE /api/v1/roles/:id`
  - response: `{ "status": "deleted" }`

### 4.6 Competitors
- `GET /api/v1/competitors?role=Backend&city=Москва`
  - response:
    ```json
    {
      "role": "Backend",
      "city": "Москва",
      "leaders": [{"company":"Acme","count":24}],
      "total_vacancies": 1240,
      "remote_share": 0.38
    }
    ```

### 4.7 Template
- `POST /api/v1/template`
  - body: `{ "role": "Backend", "level": "middle", "city": "Москва" }`
  - response:
    ```json
    {
      "role": "Backend",
      "level": "middle",
      "city": "Москва",
      "salary": "180–260k",
      "requirements": ["Node.js", "SQL"],
      "tasks": ["Поддержка API"]
    }
    ```

### 4.8 Team
- `GET /api/v1/team` → `{ "items": [TeamMember] }`
- `POST /api/v1/team/invite` → `{ "email": "...", "role": "analyst" }`
- `PATCH /api/v1/team/:id` → `{ "role": "viewer" }`
- `DELETE /api/v1/team/:id` → `{ "status": "deleted" }`

### 4.9 Billing
- `GET /api/v1/billing/plan` → текущий план и лимиты
- `POST /api/v1/billing/checkout` → старт оплаты
- `POST /api/v1/billing/webhook` → платежные события

---

## 5) Страницы сайта (контент)

### Новости / Анонсы
**Типы:**
- релизы
- еженедельные отчёты рынка
- кейсы B2B

### Аналитика
**Типы:**
- отчёты по ролям
- сравнение городов
- топ работодателей

### Тарифы
**Типы:**
- Free (ограничения)
- Pro (B2B отчёты + экспорт)
- Team (multi‑seat)

---

## 6) Ограничения и риски

- HH API может ограничить доступ для соискателей — раздел B2B основной.
- Нужен rate‑limit и кэширование для отчётов.
- Экспорт PDF требует генератора (например, Playwright).

---

## 7) Принятые архитектурные решения (черновик)

- **Единый сервер:** `NestJS + Vite SSR middleware`.
- **Доступ:** авторизация на весь сайт; неавторизованные пользователи видят демо‑данные.
- **UI:** Bootstrap как база (Tailwind возможен при явных преимуществах).
