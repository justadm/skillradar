<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Тарифы</h1>
        <p class="text-secondary mb-0">Подписка и лимиты.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm">История платежей</button>
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем тарифы…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить тарифы.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-md-6 col-lg-4" v-for="plan in state.data.plans" :key="plan.name">
        <div class="card h-100" :class="{ 'border border-primary': plan.featured }">
          <div class="card-body">
            <span v-if="plan.featured" class="badge text-bg-primary">Популярный</span>
            <h3 class="h6" :class="{ 'mt-2': plan.featured }">{{ plan.name }}</h3>
            <p class="display-6 fw-semibold">{{ plan.price }}</p>
            <p class="text-secondary">{{ plan.desc }}</p>
            <button class="btn" :class="plan.featured ? 'btn-primary' : 'btn-outline-secondary'">{{ plan.cta }}</button>
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
    state.data = await api.getBilling();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
