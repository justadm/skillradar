<template>
  <div>
    <header class="border-bottom bg-body-tertiary">
      <nav class="navbar navbar-expand-lg">
        <div class="container">
          <RouterLink class="navbar-brand fw-semibold" to="/">SkillRadar</RouterLink>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto">
              <li class="nav-item"><RouterLink class="nav-link" to="/">Продукт</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/b2b">B2B</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/reports">Отчёты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/pricing">Тарифы</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/news">Новости</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/faq">FAQ</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/contacts">Контакты</RouterLink></li>
            </ul>
            <div class="d-flex gap-2">
              <RouterLink class="btn btn-outline-secondary" to="/login">Войти</RouterLink>
              <RouterLink class="btn btn-primary" to="/pricing">Запросить доступ</RouterLink>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>

    <footer class="border-top py-4">
      <div class="container d-flex justify-content-between flex-wrap gap-2">
        <span>SkillRadar © 2026</span>
        <span>Telegram‑бот и HR‑аналитика</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>
