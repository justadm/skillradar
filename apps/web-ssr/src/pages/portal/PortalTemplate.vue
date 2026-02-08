<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Шаблон вакансии</h1>
        <p class="text-secondary mb-0">Генератор требований и вилки.</p>
      </div>
      <button class="btn btn-primary btn-sm">Сформировать</button>
    </div>

    <div v-if="state.loading" class="alert alert-info">Генерируем шаблон…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось получить шаблон.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-lg-7">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">{{ state.data.role }}</h3>
            <p class="text-secondary">Уровень: {{ state.data.level }} · Формат: {{ state.data.format }}</p>
            <h4 class="h6 mt-4">Ключевые требования</h4>
            <ul class="text-secondary">
              <li v-for="item in state.data.requirements" :key="item">{{ item }}</li>
            </ul>
            <h4 class="h6 mt-4">Задачи</h4>
            <ul class="text-secondary">
              <li v-for="item in state.data.tasks" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card">
          <div class="card-body">
            <h3 class="h6">Рекомендуемая вилка</h3>
            <p class="display-6 fw-semibold">{{ state.data.salary }}</p>
            <p class="text-secondary">{{ state.data.salaryNote }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useApi } from '../../composables/useApi';

const api = useApi();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});

onMounted(async () => {
  try {
    state.data = await api.getTemplate();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
