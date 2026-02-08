<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Настройки</h1>
        <p class="text-secondary mb-0">Лимиты, уведомления, интеграции.</p>
      </div>
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем настройки…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить настройки.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Уведомления</h3>
            <div class="form-check form-switch mt-3" v-for="item in state.data.notifications" :key="item.label">
              <input class="form-check-input" type="checkbox" role="switch" :checked="item.enabled" />
              <label class="form-check-label">{{ item.label }}</label>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Лимиты</h3>
            <p class="text-secondary" v-for="item in state.data.limits" :key="item.label">{{ item.label }}: {{ item.value }}</p>
            <button class="btn btn-outline-secondary btn-sm">Увеличить лимит</button>
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
    state.data = await api.getSettings();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
