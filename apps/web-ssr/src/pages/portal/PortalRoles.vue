<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Профили ролей</h1>
        <p class="text-secondary mb-0">Шаблоны ролей, навыки и вилки.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm">Создать профиль</button>
    </div>

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
    state.data = await api.getRoles();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
