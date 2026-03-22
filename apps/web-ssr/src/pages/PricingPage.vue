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
              <a class="btn btn-primary w-100" href="https://t.me/GridAI_Recruiter_bot" target="_blank" rel="noreferrer">Запросить доступ</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="py-5 bg-body-tertiary">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-6">
          <div class="card">
            <div class="card-body">
              <h2 class="h5">Запросить доступ</h2>
              <p class="text-secondary">Оставьте контакты — подключим пилот.</p>
              <form @submit.prevent="submit">
                <div class="mb-3">
                  <label class="form-label">Компания</label>
                  <input v-model="form.company" class="form-control" placeholder="Название компании" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Email</label>
                  <input v-model="form.email" class="form-control" type="email" placeholder="you@company.com" required />
                </div>
                <div class="mb-3">
                  <label class="form-label">Комментарий</label>
                  <textarea v-model="form.message" class="form-control" rows="3" placeholder="Роль, регион, объем найма"></textarea>
                </div>
                <button class="btn btn-primary" type="submit" :disabled="state.loading">Отправить</button>
              </form>
              <div v-if="state.message" class="alert alert-info mt-3">{{ state.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useHead } from '../composables/useHead';

const plans = [
  { name: 'Starter', price: '$99 / мес', items: ['3 отчета/день', '1 пользователь', 'PDF/TXT экспорт'] },
  { name: 'Pro', price: '$199 / мес', items: ['10 отчетов/день', 'до 3 пользователей', 'Сегменты и тренды'], featured: true },
  { name: 'Team', price: 'Custom', items: ['30 отчетов/день', 'до 10 пользователей', 'SLA и кастомные отчеты'] }
];

const form = reactive({ company: '', email: '', message: '' });
const state = reactive({ loading: false, message: '' });

const submit = async () => {
  state.loading = true;
  state.message = '';
  try {
    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source: 'pricing' })
    });
    const data = await res.json();
    if (!res.ok) {
      state.message = data?.error?.message || 'Не удалось отправить.';
      return;
    }
    state.message = 'Заявка отправлена. Свяжемся в ближайшее время.';
    form.company = '';
    form.email = '';
    form.message = '';
  } catch {
    state.message = 'Не удалось отправить. Попробуйте позже.';
  } finally {
    state.loading = false;
  }
};

useHead(`
  <title>GridAI — Тарифы</title>
  <meta name="description" content="Тарифы GridAI для HR‑аналитики." />
`);
</script>
