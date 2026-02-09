<template>
  <section class="py-5">
    <div class="container">
      <div class="row g-5">
        <div class="col-lg-6">
          <h1 class="h3 fw-bold">Контакты</h1>
          <p class="text-secondary">Свяжитесь с нами, чтобы подключить пилот или получить демо.</p>
          <ul class="list-unstyled">
            <li><strong>Email:</strong> hello@skillradar.ai</li>
            <li><strong>Telegram:</strong> @skillradar_hr_bot</li>
          </ul>
        </div>
        <div class="col-lg-6">
          <div class="card">
            <div class="card-body">
              <h2 class="h6">Форма запроса</h2>
              <form>
                <div class="mb-3">
                  <label class="form-label">Компания</label>
                  <input class="form-control" placeholder="Название компании" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Email</label>
                  <input class="form-control" type="email" placeholder="you@company.com" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Комментарий</label>
                  <textarea class="form-control" rows="3" placeholder="Роль, регион, задачи"></textarea>
                </div>
                <button class="btn btn-primary" type="button">Отправить</button>
              </form>
              <small class="text-secondary d-block mt-3">Форма не отправляет данные — только прототип.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';

useHead(`
  <title>SkillRadar — Контакты</title>
  <meta name="description" content="Контакты SkillRadar." />
`);
</script>
