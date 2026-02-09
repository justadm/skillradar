<template>
  <section class="py-5">
    <div class="container">
      <div class="row align-items-center g-5">
        <div class="col-lg-6">
          <p class="text-uppercase text-primary fw-semibold small">B2B аналитика</p>
          <h1 class="display-6 fw-bold">HR‑аналитика по роли за 2 минуты.</h1>
          <p class="lead text-secondary">
            Получайте срез рынка, конкурентов и шаблоны вакансий по роли.
            Отчеты формируются на базе публичных данных hh.ru.
          </p>
          <div class="d-flex flex-wrap gap-2">
            <RouterLink class="btn btn-primary btn-lg" to="/pricing">Смотреть тарифы</RouterLink>
            <a class="btn btn-outline-secondary btn-lg" href="https://t.me/skillradar_hr_bot" target="_blank" rel="noreferrer">
              Открыть Telegram
            </a>
          </div>
        </div>
        <div class="col-lg-5 offset-lg-1">
          <div class="card">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>Пример отчёта</strong>
                <span class="badge text-bg-success">B2B</span>
              </div>
              <ul class="mb-3">
                <li>Вакансий: 1240 · Удалёнка: 38%</li>
                <li>Вилка: 170–250k</li>
                <li>Топ навыков: Node.js, SQL, Docker</li>
                <li>Тренд 7д: +6%</li>
              </ul>
              <small class="text-secondary">Экспорт PDF/TXT доступен в TG‑боте.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5 bg-body-tertiary">
    <div class="container">
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Рынок роли</h3>
              <p class="text-secondary mb-0">Сегменты по городам и уровням, удалёнка, тренд.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Конкуренты</h3>
              <p class="text-secondary mb-0">Топ работодателей и плотность найма по роли.</p>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h5">Шаблон вакансии</h3>
              <p class="text-secondary mb-0">Рекомендуемые требования и зарплатная вилка.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5">
    <div class="container">
      <div class="row g-4">
        <div class="col-lg-6">
          <h2 class="h4 fw-semibold">Кому полезно</h2>
          <ul class="text-secondary">
            <li>HR‑командам — оценка рынка перед наймом</li>
            <li>Recruiter lead — конкурентный анализ</li>
            <li>Hiring managers — подготовка требований</li>
          </ul>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-body">
              <h3 class="h6">Ключевые KPI</h3>
              <ul class="mb-0">
                <li>Скорость подготовки отчёта: 2–5 мин</li>
                <li>Сегментация: город/уровень/формат</li>
                <li>Экспорт: PDF/TXT</li>
              </ul>
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
  <title>SkillRadar — B2B‑аналитика для HR</title>
  <meta name="description" content="B2B‑аналитика по ролям: рынок, конкуренты, шаблоны вакансий." />
`);
</script>
