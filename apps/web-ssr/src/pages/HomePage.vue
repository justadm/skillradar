<template>
  <section class="py-5">
    <div class="container">
      <div class="row align-items-center g-5">
        <div class="col-lg-6">
          <p class="text-uppercase text-primary fw-semibold small">TG‑бот + рынок навыков</p>
          <h1 class="display-5 fw-bold">Находим вакансии и объясняем, почему они подходят.</h1>
          <p class="lead text-secondary">
            SkillRadar превращает запрос в фильтры рынка и выдаёт топ‑вакансии с пояснениями.
            Для HR — быстрые отчёты по роли, навыкам, зарплатам и конкурентам.
          </p>
          <div class="d-flex flex-wrap gap-2">
            <RouterLink class="btn btn-primary btn-lg" to="/pricing">Запустить пилот</RouterLink>
            <a class="btn btn-outline-secondary btn-lg" href="https://t.me/skillradar_hr_bot" target="_blank" rel="noreferrer">
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
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';
import { RouterLink } from 'vue-router';

useHead(`
  <title>SkillRadar — умный подбор вакансий и HR‑аналитика</title>
  <meta name="description" content="SkillRadar — телеграм‑бот для подбора вакансий, рынка навыков и HR‑аналитики." />
  <meta property="og:title" content="SkillRadar — умный подбор вакансий и HR‑аналитика" />
  <meta property="og:description" content="Подбор вакансий, рынок навыков и B2B‑аналитика для HR." />
  <meta property="og:type" content="website" />
`);
</script>
