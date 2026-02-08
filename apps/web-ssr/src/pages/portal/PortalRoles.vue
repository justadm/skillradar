<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Профили ролей</h1>
        <p class="text-secondary mb-0">Шаблоны ролей, навыки и вилки.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="!isAuthed" @click="toggleForm">Создать профиль</button>
    </div>

    <div v-if="!isAuthed" class="alert alert-secondary">
      Демо‑режим: создание профилей доступно после входа.
    </div>

    <form v-if="showForm" class="card mb-3" @submit.prevent="submit">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Название</label>
            <input v-model="form.name" class="form-control" placeholder="Backend Moscow" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Роль</label>
            <input v-model="form.role" class="form-control" placeholder="Backend Node.js" required />
          </div>
          <div class="col-md-4">
            <label class="form-label">Город</label>
            <input v-model="form.city" class="form-control" placeholder="Москва" />
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary btn-sm" type="submit">Сохранить</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleForm">Отмена</button>
        </div>
        <div v-if="formMessage" class="alert alert-info mt-3">{{ formMessage }}</div>
      </div>
    </form>

    <div v-if="state.loading" class="alert alert-info">Загрузка ролей…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить роли.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-md-6 col-lg-4" v-for="item in state.data.items" :key="item.title">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">{{ item.title }}</h3>
            <p class="text-secondary">{{ item.region }} · {{ item.level }}</p>
            <p class="text-secondary">Навыки: {{ item.skills }}</p>
            <button class="btn btn-outline-secondary btn-sm">Открыть</button>
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

const api = useApi();
const { isAuthed } = useAuth();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});
const showForm = ref(false);
const formMessage = ref('');
const form = reactive({ name: '', role: '', city: '' });

onMounted(async () => {
  try {
    state.data = await api.getRoles();
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
  try {
    const res = await api.createRole(form);
    formMessage.value = `Профиль создан: ${res.id}`;
    showForm.value = false;
  } catch {
    formMessage.value = 'Не удалось создать профиль.';
  }
};
</script>
