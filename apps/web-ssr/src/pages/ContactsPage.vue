<template>
  <section class="py-5">
    <div class="container">
      <div class="row g-5">
        <div class="col-lg-6">
          <h1 class="h3 fw-bold">Контакты</h1>
          <p class="text-secondary">Свяжитесь с нами, чтобы подключить пилот или получить демо.</p>
          <ul class="list-unstyled">
            <li><strong>Email:</strong> hello@gridai.ru</li>
            <li><strong>Telegram Jobs:</strong> @GridAI_Careers_bot</li>
            <li><strong>Telegram HR:</strong> @GridAI_Recruiter_bot</li>
          </ul>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-body">
              <h2 class="h6">Форма запроса</h2>
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
                  <textarea v-model="form.message" class="form-control" rows="3" placeholder="Роль, регион, задачи"></textarea>
                </div>
                <button class="btn btn-primary" type="submit" :disabled="state.loading">Отправить</button>
              </form>
              <div v-if="state.message" class="alert alert-info mt-3">{{ state.message }}</div>
              <small class="text-secondary d-block mt-3">Данные используются только для связи.</small>
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

const form = reactive({ company: '', email: '', message: '' });
const state = reactive({ loading: false, message: '' });

const submit = async () => {
  state.loading = true;
  state.message = '';
  try {
    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source: 'contacts' })
    });
    const data = await res.json();
    if (!res.ok) {
      state.message = data?.error?.message || 'Не удалось отправить.';
      return;
    }
    state.message = 'Заявка отправлена. Ответим в ближайшее время.';
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
  <title>GridAI — Контакты</title>
  <meta name="description" content="Контакты GridAI." />
`);
</script>
