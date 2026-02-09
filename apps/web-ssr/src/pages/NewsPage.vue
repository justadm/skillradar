<template>
  <section class="py-5">
    <div class="container">
      <h1 class="h3 fw-bold mb-4">Новости и анонсы</h1>
      <div class="row g-3">
        <div class="col-lg-6" v-for="item in items" :key="item.title">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge text-bg-light">{{ item.tag }}</span>
                <small class="text-secondary">{{ item.date }}</small>
              </div>
              <h3 class="h6">{{ item.title }}</h3>
              <p class="text-secondary mb-0">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-4">
        <RouterLink class="btn btn-primary" to="/pricing">Подключить пилот</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';
import { RouterLink } from 'vue-router';

const items = [
  { title: 'B2B‑режим: сегменты и тренды', desc: 'Добавили сегментацию по городам и уровням.', date: '2026‑02‑09', tag: 'Release' },
  { title: 'Экспорт отчётов в PDF', desc: 'Теперь выгружаем отчет в PDF + TXT.', date: '2026‑02‑09', tag: 'Update' },
  { title: 'Пилот с HR‑командами', desc: 'Открыли новый поток на 10 команд.', date: '2026‑02‑08', tag: 'Pilot' }
];

useHead(`
  <title>SkillRadar — Новости и анонсы</title>
  <meta name="description" content="Релизы, обновления и кейсы SkillRadar." />
`);
</script>
