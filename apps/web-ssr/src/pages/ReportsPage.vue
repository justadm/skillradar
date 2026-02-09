<template>
  <section class="py-5">
    <div class="container">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <div>
          <h1 class="h3 fw-bold mb-1">Аналитика и отчёты</h1>
          <p class="text-secondary mb-0">Примеры готовых отчётов и формат выдачи.</p>
        </div>
        <RouterLink class="btn btn-primary" to="/pricing">Получить доступ</RouterLink>
      </div>

      <div class="row g-3">
        <div class="col-lg-4" v-for="card in cards" :key="card.title">
          <div class="card h-100">
            <div class="card-body">
              <h3 class="h6">{{ card.title }}</h3>
              <p class="text-secondary mb-3">{{ card.desc }}</p>
              <span class="badge text-bg-light">{{ card.tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useHead } from '../composables/useHead';

const cards = [
  { title: 'Рынок Backend (Москва)', desc: 'Объём, удалёнка, вилки и топ‑навыки.', tag: 'Market' },
  { title: 'Конкуренты по Data', desc: 'Топ работодателей и активность найма.', tag: 'Competitors' },
  { title: 'Шаблон вакансии QA', desc: 'Требования, задачи, вилки и формат.', tag: 'Template' }
];

useHead(`
  <title>SkillRadar — Аналитика и отчёты</title>
  <meta name="description" content="Примеры B2B‑отчётов по рынку и конкурентам." />
`);
</script>
