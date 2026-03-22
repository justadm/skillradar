<template>
  <section class="py-5">
    <div class="container">
      <div class="row align-items-center g-5">
        <div class="col-lg-6">
          <p class="text-uppercase text-primary fw-semibold small">TG‑бот + рынок навыков</p>
          <h1 class="display-5 fw-bold">Находим вакансии и объясняем, почему они подходят.</h1>
          <p class="lead text-secondary">
            GridAI превращает запрос в фильтры рынка и выдаёт топ‑вакансии с пояснениями.
            Для HR — быстрые отчёты по роли, навыкам, зарплатам и конкурентам.
          </p>
          <div class="d-flex flex-wrap gap-2">
            <RouterLink class="btn btn-primary btn-lg" to="/pricing">Запустить пилот</RouterLink>
            <a class="btn btn-outline-secondary btn-lg" href="https://t.me/GridAI_Careers_bot" target="_blank" rel="noreferrer">
              Открыть в Telegram
            </a>
          </div>
        </div>
        <div class="col-lg-5 offset-lg-1">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>Демо‑запрос</strong>
                <span class="badge text-bg-success">Live</span>
              </div>
              <p class="text-secondary">«Backend, 3+ года, Node.js/SQL, от 200к, удалёнка»</p>
              <ul class="mb-3">
                <li>Backend Node.js — 200–260k, remote</li>
                <li>API Engineer — 210–280k, hybrid</li>
                <li>Platform Engineer — 230–300k, remote</li>
              </ul>
              <small class="text-secondary">Почему подходит: совпали навыки, опыт и вилка.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="product" class="py-5 bg-body-tertiary">
    <div class="container">
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Подбор вакансий</h3>
              <p class="text-secondary mb-0">Из запроса формируем фильтры, ранжируем и объясняем результаты.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Рынок навыков</h3>
              <p class="text-secondary mb-0">Топ‑навыки, средние вилки, доля удалёнки — одним сообщением.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Сохранённые запросы</h3>
              <p class="text-secondary mb-0">Повторяйте поиск в один клик, без ручного ввода.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5">
    <div class="container">
      <div class="row align-items-center g-4">
        <div class="col-lg-6">
          <h2 class="h3 fw-semibold">B2B‑аналитика для HR</h2>
          <p class="text-secondary">
            Рынок роли, конкуренты, шаблон вакансии и экспорт отчётов — всё в Telegram.
          </p>
          <div class="d-flex gap-2">
            <RouterLink class="btn btn-primary" to="/b2b">Подробнее</RouterLink>
            <RouterLink class="btn btn-outline-secondary" to="/reports">Примеры отчётов</RouterLink>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-body">
              <h3 class="h6">Что внутри</h3>
              <ul class="mb-0">
                <li>Сегменты по городам и уровням</li>
                <li>Тренд 7 дней по выборке</li>
                <li>Экспорт PDF/TXT</li>
                <li>Лимиты и тарификация</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5 bg-body-tertiary">
    <div class="container">
      <h2 class="h3 fw-semibold mb-4">Как это работает</h2>
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">1. Запрос</h3>
              <p class="text-secondary mb-0">Вы пишете роль, навыки, уровень и зарплату.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">2. Обработка</h3>
              <p class="text-secondary mb-0">LLM превращает запрос в фильтры hh.ru.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">3. Результат</h3>
              <p class="text-secondary mb-0">Получаете отчёт с пояснениями и экспортом.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5">
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h3 fw-semibold">Частые вопросы</h2>
        <RouterLink class="btn btn-outline-secondary btn-sm" to="/faq">Все ответы</RouterLink>
      </div>
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">Какие источники данных?</h3>
              <p class="text-secondary mb-0">Публичные вакансии и справочники hh.ru.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">Можно ли подключить резюме?</h3>
              <p class="text-secondary mb-0">Только при разрешении HH — пока не используем.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">Как подключиться?</h3>
              <p class="text-secondary mb-0">Оставьте заявку в TG — подключим пилот.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';
import { RouterLink } from 'vue-router';

useHead(`
  <title>GridAI — AI‑подбор вакансий и HR‑аналитика</title>
  <meta name="description" content="GridAI — AI‑платформа для подбора вакансий, рынка навыков и HR‑аналитики." />
  <meta property="og:title" content="GridAI — AI‑подбор вакансий и HR‑аналитика" />
  <meta property="og:description" content="Подбор вакансий, рынок навыков и B2B‑аналитика для HR." />
  <meta property="og:type" content="website" />
`);
</script>
