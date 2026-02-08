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
              <li class="nav-item"><a class="nav-link" href="#product">Продукт</a></li>
              <li class="nav-item"><a class="nav-link" href="#b2b">B2B</a></li>
              <li class="nav-item"><a class="nav-link" href="#how">Как работает</a></li>
              <li class="nav-item"><a class="nav-link" href="#faq">FAQ</a></li>
            </ul>
            <div class="d-flex gap-2">
              <RouterLink class="btn btn-outline-secondary" to="/login">Войти</RouterLink>
              <a class="btn btn-primary" href="#launch">Запросить доступ</a>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main>
      <slot />
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
import { RouterLink } from 'vue-router';
</script>
