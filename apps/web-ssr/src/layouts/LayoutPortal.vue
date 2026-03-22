<template>
  <div class="sr-portal-shell">
    <header class="border-bottom bg-body-tertiary">
      <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
          <RouterLink class="navbar-brand sr-brand" to="/hiring">
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
            <span class="sr-brand-copy">
              <span class="sr-brand-title">GridAI</span>
              <span class="sr-brand-subtitle">Hiring Portal</span>
            </span>
          </RouterLink>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#portalNav"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="portalNav">
            <ul class="navbar-nav me-auto">
              <li class="nav-item"><RouterLink class="nav-link" to="/hiring">Дашборд</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/hiring/reports">Отчёты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/hiring/roles">Роли</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/hiring/competitors">Конкуренты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/hiring/template">Шаблон</RouterLink></li>
            </ul>
            <div class="d-flex align-items-center gap-2">
              <a class="btn btn-outline-secondary" href="https://gridai.ru" target="_blank" rel="noreferrer">На сайт</a>
              <RouterLink class="btn btn-outline-secondary" to="/ui-kit">UI‑kit</RouterLink>
              <template v-if="isAuthed">
                <span class="text-secondary small">{{ userLabel }}</span>
                <button class="btn btn-outline-secondary" @click="logout">Выйти</button>
              </template>
              <RouterLink v-else class="btn btn-outline-secondary" to="/login">Войти</RouterLink>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main class="py-4">
      <div class="container-fluid">
        <div v-if="!isAuthed" class="alert alert-warning">
          Демо‑режим: показываем пример данных. Для полной версии войдите.
        </div>
        <div class="row">
          <aside class="col-lg-2 mb-3">
            <div class="list-group">
              <RouterLink class="list-group-item list-group-item-action" to="/hiring">Дашборд</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/hiring/reports">Отчёты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/hiring/roles">Профили ролей</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/hiring/competitors">Конкуренты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/hiring/template">Шаблон вакансии</RouterLink>
              <RouterLink v-if="canManageTeam" class="list-group-item list-group-item-action" to="/hiring/team">Команда</RouterLink>
              <RouterLink v-if="canViewLeads" class="list-group-item list-group-item-action" to="/hiring/leads">Заявки</RouterLink>
              <RouterLink v-if="canViewAudit" class="list-group-item list-group-item-action" to="/hiring/audit">Аудит</RouterLink>
              <RouterLink v-if="canManageBilling" class="list-group-item list-group-item-action" to="/hiring/billing">Тарифы</RouterLink>
              <RouterLink v-if="canManageSettings" class="list-group-item list-group-item-action" to="/hiring/settings">Настройки</RouterLink>
            </div>
          </aside>
          <section class="col-lg-10">
            <RouterView />
          </section>
        </div>
      </div>
    </main>
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useUser } from '../composables/useUser';
import { useAccess } from '../composables/useAccess';
import { useApi } from '../composables/useApi';
import ToastHost from '../components/ToastHost.vue';

const { isAuthed, setAuthed } = useAuth();
const { profile, loadProfile, setProfile } = useUser();
const { canManageTeam, canManageBilling, canManageSettings, canViewLeads, canViewAudit } = useAccess();
const api = useApi();

onMounted(async () => {
  loadProfile();
  if (!isAuthed.value) return;
  try {
    const data = await api.getMe();
    if (data?.user) {
      setProfile({ email: data.user.email, role: data.user.role });
    }
  } catch {
    setAuthed(false);
    setProfile(null);
  }
});

const userLabel = computed(() => {
  if (!profile.value?.email) return 'Пользователь';
  const role = profile.value?.role ? ` · ${profile.value.role}` : '';
  return `${profile.value.email}${role}`;
});

const logout = async () => {
  try {
    await api.logout();
  } catch {
    // ignore transport errors on logout
  }
  setAuthed(false);
  setProfile(null);
};
</script>

<style scoped>
:global(body) {
  background:
    radial-gradient(circle at top right, rgba(49, 175, 255, 0.12), transparent 28%),
    radial-gradient(circle at top left, rgba(42, 228, 200, 0.1), transparent 24%),
    #08121f;
  color: #eaf8ff;
}

.sr-portal-shell {
  --sr-accent: #2ae4c8;
  --sr-accent-2: #31afff;
  --sr-highlight: #fdd76b;
  --sr-bg: #08121f;
  --sr-panel: rgba(12, 28, 43, 0.92);
  --sr-panel-2: rgba(15, 32, 51, 0.96);
  --sr-border: rgba(139, 188, 229, 0.18);
  --sr-text: #eaf8ff;
  --sr-muted: #8bbce5;
}

.sr-portal-shell :deep(.bg-body-tertiary) {
  background: var(--sr-panel) !important;
}

.sr-portal-shell :deep(.border-bottom),
.sr-portal-shell :deep(.border-top) {
  border-color: var(--sr-border) !important;
}

.sr-portal-shell :deep(.navbar) {
  backdrop-filter: blur(20px);
}

.sr-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--sr-text);
  text-decoration: none;
}

.sr-brand-mark {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 32px rgba(4, 12, 22, 0.4);
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
  padding: 4px;
}

:root[data-bs-theme='light'] .sr-brand-mark svg {
  border-radius: 12px;
  transform: scale(0.88);
  transform-origin: center;
  filter: saturate(0.78) contrast(0.94) brightness(1.03);
}

.sr-brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.sr-brand-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.sr-brand-subtitle {
  margin-top: 4px;
  font-size: 0.73rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sr-muted);
}

.sr-portal-shell :deep(.nav-link),
.sr-portal-shell :deep(.text-secondary),
.sr-portal-shell :deep(.list-group-item) {
  color: var(--sr-muted) !important;
}

.sr-portal-shell :deep(.nav-link:hover),
.sr-portal-shell :deep(.nav-link.router-link-active),
.sr-portal-shell :deep(.list-group-item:hover),
.sr-portal-shell :deep(.list-group-item.router-link-active) {
  color: var(--sr-text) !important;
}

.sr-portal-shell :deep(.list-group) {
  gap: 10px;
  background: transparent;
}

.sr-portal-shell :deep(.list-group-item) {
  border-radius: 16px !important;
  border: 1px solid var(--sr-border) !important;
  background: rgba(11, 25, 39, 0.8) !important;
}

.sr-portal-shell :deep(.list-group-item.router-link-active) {
  background:
    linear-gradient(135deg, rgba(42, 228, 200, 0.12), rgba(49, 175, 255, 0.16)),
    rgba(11, 25, 39, 0.95) !important;
  border-color: rgba(42, 228, 200, 0.26) !important;
  box-shadow: inset 0 0 0 1px rgba(42, 228, 200, 0.08);
}

.sr-portal-shell :deep(.btn-primary) {
  color: #08121f;
  border: none;
  background: linear-gradient(135deg, var(--sr-accent), var(--sr-highlight));
  box-shadow: 0 16px 32px rgba(10, 22, 38, 0.36);
}

.sr-portal-shell :deep(.btn-primary:hover) {
  color: #08121f;
  background: linear-gradient(135deg, #4ae7d0, #ffd87f);
}

.sr-portal-shell :deep(.btn-outline-secondary) {
  color: var(--sr-text);
  border-color: var(--sr-border);
  background: rgba(15, 32, 51, 0.65);
}

.sr-portal-shell :deep(.btn-outline-secondary:hover) {
  color: #08121f;
  border-color: rgba(42, 228, 200, 0.35);
  background: linear-gradient(135deg, rgba(42, 228, 200, 0.95), rgba(49, 175, 255, 0.85));
}

.sr-portal-shell :deep(.alert-warning) {
  color: var(--sr-text);
  border-color: rgba(253, 215, 107, 0.24);
  background: linear-gradient(135deg, rgba(253, 215, 107, 0.14), rgba(255, 148, 77, 0.08));
}

@media (max-width: 991px) {
  .sr-brand-subtitle {
    display: none;
  }
}
</style>
