<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Команда</h1>
        <p class="text-secondary mb-0">Участники и роли.</p>
      </div>
      <button class="btn btn-primary btn-sm" :disabled="!isAuthed" @click="toggleForm">Пригласить</button>
    </div>

    <div v-if="!isAuthed" class="alert alert-secondary">
      Демо‑режим: приглашения доступны после входа.
    </div>

    <form v-if="showForm" class="card mb-3" @submit.prevent="submit">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Email</label>
            <input v-model="form.email" class="form-control" placeholder="user@company.com" required />
          </div>
          <div class="col-md-6">
            <label class="form-label">Роль</label>
            <select v-model="form.role" class="form-select">
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary btn-sm" type="submit">Отправить</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleForm">Отмена</button>
        </div>
        <div v-if="formMessage" class="alert alert-info mt-3">{{ formMessage }}</div>
      </div>
    </form>

    <div v-if="state.loading" class="alert alert-info">Загружаем команду…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить команду.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-md-6 col-lg-4" v-for="member in state.data.members" :key="member.name">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">{{ member.name }}</h3>
            <p class="text-secondary">{{ member.role }} · {{ member.access }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useApi } from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { isAuthed } = useAuth();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});
const showForm = ref(false);
const formMessage = ref('');
const form = reactive({ email: '', role: 'analyst' });

onMounted(async () => {
  try {
    state.data = await api.getTeam();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});

const toggleForm = () => {
  showForm.value = !showForm.value;
  formMessage.value = '';
};

const submit = async () => {
  if (!isAuthed.value) {
    formMessage.value = 'Нужна авторизация.';
    pushToast('Войдите, чтобы приглашать участников.', 'info');
    return;
  }
  try {
    await api.inviteTeam(form);
    formMessage.value = 'Приглашение отправлено.';
    showForm.value = false;
    pushToast('Приглашение отправлено.', 'success');
  } catch {
    formMessage.value = 'Не удалось отправить приглашение.';
    pushToast('Не удалось отправить приглашение.', 'danger');
  }
};

useHead(`
  <title>SkillRadar — Команда</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
