<template>
  <div>
    <header class="border-bottom bg-body-tertiary">
      <nav class="navbar navbar-expand-lg">
        <div class="container">
          <RouterLink class="navbar-brand sr-brand" to="/">
            <span class="sr-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="16" fill="url(#bg)" />
                <rect x="12" y="14" width="24" height="24" rx="7" fill="#0F2033" stroke="#284A66" stroke-width="1.5" />
                <rect x="15.5" y="17.5" width="5.5" height="5.5" rx="2" fill="#16324B" />
                <rect x="23" y="17.5" width="5.5" height="5.5" rx="2" fill="url(#accent)" />
                <rect x="30.5" y="17.5" width="2.5" height="5.5" rx="1.25" fill="#16324B" />
                <rect x="15.5" y="25" width="5.5" height="5.5" rx="2" fill="url(#accent)" />
                <rect x="23" y="25" width="5.5" height="5.5" rx="2" fill="#16324B" />
                <rect x="30.5" y="25" width="2.5" height="5.5" rx="1.25" fill="url(#signal)" />
                <rect x="15.5" y="32.5" width="5.5" height="2.5" rx="1.25" fill="#16324B" />
                <rect x="23" y="32.5" width="5.5" height="2.5" rx="1.25" fill="url(#signal)" />
                <rect x="30.5" y="32.5" width="2.5" height="2.5" rx="1.25" fill="#16324B" />
                <path d="M45 18C49.4183 18 53 21.5817 53 26V31H48.5V26.5C48.5 24.0147 46.4853 22 44 22H41.5V18H45Z" fill="#EAF8FF" />
                <path d="M44 31H53V35.5H41.5V26H46V30C46 30.5523 45.5523 31 45 31H44Z" fill="#EAF8FF" />
                <path d="M41.5 43H53" stroke="#2AE4C8" stroke-width="3.2" stroke-linecap="round" />
                <path d="M41.5 49H50" stroke="#FDD76B" stroke-width="3.2" stroke-linecap="round" />
                <defs>
                  <linearGradient id="bg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#0A1626" />
                    <stop offset="1" stop-color="#12304A" />
                  </linearGradient>
                  <linearGradient id="accent" x1="18" y1="18" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#2AE4C8" />
                    <stop offset="1" stop-color="#31AFFF" />
                  </linearGradient>
                  <linearGradient id="signal" x1="31" y1="21" x2="38" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#FDD76B" />
                    <stop offset="1" stop-color="#FF944D" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span class="sr-brand-title">GridAI</span>
          </RouterLink>
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
        <span>GridAI © 2026</span>
        <span>Telegram‑бот и HR‑аналитика</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<style scoped>
:global(body) {
  background:
    radial-gradient(circle at top right, rgba(49, 175, 255, 0.12), transparent 28%),
    radial-gradient(circle at top left, rgba(42, 228, 200, 0.1), transparent 24%),
    #08121f;
  color: #eaf8ff;
}

:global(.bg-body-tertiary) {
  background: rgba(20, 23, 33, 0.94) !important;
}

:global(.navbar) {
  min-height: 56px;
  backdrop-filter: blur(18px);
  box-shadow: inset 0 -1px 0 rgba(139, 188, 229, 0.08);
}

:global(.border-bottom),
:global(.border-top) {
  border-color: rgba(139, 188, 229, 0.12) !important;
}

:global(:root[data-bs-theme='light'] .bg-body-tertiary) {
  background: rgba(255, 255, 255, 0.9) !important;
}

:global(:root[data-bs-theme='light'] .navbar) {
  box-shadow: inset 0 -1px 0 rgba(18, 48, 74, 0.08);
}

:global(:root[data-bs-theme='light'] .border-bottom),
:global(:root[data-bs-theme='light'] .border-top) {
  border-color: rgba(18, 48, 74, 0.1) !important;
}

.sr-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #eaf8ff;
  text-decoration: none;
}

.sr-brand-mark {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 24px rgba(4, 12, 22, 0.32);
}

.sr-brand-mark svg {
  width: 100%;
  height: 100%;
  display: block;
}

:root[data-bs-theme='light'] .sr-brand-mark {
  background: #ffffff;
  border: 1px solid rgba(47, 67, 92, 0.1);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  padding: 3px;
}

:root[data-bs-theme='light'] .sr-brand-mark svg {
  border-radius: 10px;
  transform: scale(0.88);
  transform-origin: center;
  filter: saturate(0.78) contrast(0.94) brightness(1.03);
}

.sr-brand-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

:global(.navbar .nav-link) {
  color: var(--sr-muted);
}

:global(.navbar .nav-link:hover),
:global(.navbar .nav-link:focus),
:global(.navbar .nav-link.router-link-active) {
  color: var(--sr-text);
}

:global(.navbar .btn-outline-secondary) {
  color: var(--sr-text);
  border-color: var(--sr-border);
  background: rgba(15, 32, 51, 0.18);
}

:global(.navbar .btn-outline-secondary:hover),
:global(.navbar .btn-outline-secondary:focus) {
  color: #08121f;
  border-color: rgba(42, 228, 200, 0.35);
  background: linear-gradient(135deg, rgba(42, 228, 200, 0.95), rgba(49, 175, 255, 0.85));
}

:global(:root[data-bs-theme='light'] .navbar .btn-outline-secondary) {
  color: #102439;
  border-color: rgba(18, 48, 74, 0.18);
  background: rgba(255, 255, 255, 0.72);
}

:global(:root[data-bs-theme='light'] .navbar .btn-outline-secondary:hover),
:global(:root[data-bs-theme='light'] .navbar .btn-outline-secondary:focus) {
  color: #102439;
  border-color: rgba(49, 175, 255, 0.28);
  background: rgba(220, 233, 244, 0.96);
}
</style>
