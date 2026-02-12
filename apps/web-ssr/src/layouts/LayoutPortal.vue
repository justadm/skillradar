<template>
  <div>
    <header class="border-bottom bg-body-tertiary">
      <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
          <RouterLink class="navbar-brand fw-semibold" to="/portal">SkillRadar Portal</RouterLink>
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
              <li class="nav-item"><RouterLink class="nav-link" to="/portal">Дашборд</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/reports">Отчёты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/roles">Роли</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/competitors">Конкуренты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/template">Шаблон</RouterLink></li>
            </ul>
            <div class="d-flex align-items-center gap-2">
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
              <RouterLink class="list-group-item list-group-item-action" to="/portal">Дашборд</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/reports">Отчёты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/roles">Профили ролей</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/competitors">Конкуренты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/template">Шаблон вакансии</RouterLink>
              <RouterLink v-if="canManageTeam" class="list-group-item list-group-item-action" to="/portal/team">Команда</RouterLink>
              <RouterLink v-if="canViewLeads" class="list-group-item list-group-item-action" to="/portal/leads">Заявки</RouterLink>
              <RouterLink v-if="canViewAudit" class="list-group-item list-group-item-action" to="/portal/audit">Аудит</RouterLink>
              <RouterLink v-if="canManageBilling" class="list-group-item list-group-item-action" to="/portal/billing">Тарифы</RouterLink>
              <RouterLink v-if="canManageSettings" class="list-group-item list-group-item-action" to="/portal/settings">Настройки</RouterLink>
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

const { isAuthed, setToken } = useAuth();
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
    // ignore
  }
});

const userLabel = computed(() => {
  if (!profile.value?.email) return 'Пользователь';
  const role = profile.value?.role ? ` · ${profile.value.role}` : '';
  return `${profile.value.email}${role}`;
});

const logout = () => {
  setToken(null);
  setProfile(null);
};
</script>
