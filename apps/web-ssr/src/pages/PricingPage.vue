<template>
  <section class="py-5">
    <div class="container">
      <div class="text-center mb-5">
        <h1 class="h3 fw-bold">Тарифы</h1>
        <p class="text-secondary">Выберите план для HR‑аналитики и мониторинга рынка.</p>
      </div>

      <div class="row g-4">
        <div class="col-lg-4" v-for="plan in plans" :key="plan.name">
          <div class="card h-100" :class="plan.featured ? 'border-primary' : ''">
            <div class="card-body">
              <h3 class="h5">{{ plan.name }}</h3>
              <p class="display-6 fw-bold">{{ plan.price }}</p>
              <ul class="text-secondary">
                <li v-for="item in plan.items" :key="item">{{ item }}</li>
              </ul>
              <a class="btn btn-primary w-100" href="https://t.me/skillradar_hr_bot" target="_blank" rel="noreferrer">Запросить доступ</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';

const plans = [
  { name: 'Starter', price: '$99 / мес', items: ['3 отчета/день', '1 пользователь', 'PDF/TXT экспорт'] },
  { name: 'Pro', price: '$199 / мес', items: ['10 отчетов/день', 'до 3 пользователей', 'Сегменты и тренды'], featured: true },
  { name: 'Team', price: 'Custom', items: ['30 отчетов/день', 'до 10 пользователей', 'SLA и кастомные отчеты'] }
];

useHead(`
  <title>SkillRadar — Тарифы</title>
  <meta name="description" content="Тарифы SkillRadar для HR‑аналитики." />
`);
</script>
