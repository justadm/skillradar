<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Конкуренты</h1>
        <p class="text-secondary mb-0">ТОП работодателей по роли.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm">Скачать CSV</button>
    </div>

    <div v-if="state.loading" class="alert alert-info">Загрузка конкурентов…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить конкурентов.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-lg-7">
        <div class="card">
          <div class="card-body">
            <h3 class="h6">Топ‑10 работодателей</h3>
            <ol class="text-secondary mt-3 mb-0">
              <li v-for="item in state.data.leaders" :key="item.company">{{ item.company }} — {{ item.count }}</li>
            </ol>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Индекс конкуренции</h3>
            <p class="display-6 fw-semibold">{{ state.data.index }}</p>
            <p class="text-secondary">{{ state.data.summary }}</p>
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
    state.data = await api.getCompetitors();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
