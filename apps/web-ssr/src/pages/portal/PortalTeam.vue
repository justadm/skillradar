<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Команда</h1>
        <p class="text-secondary mb-0">Участники и роли.</p>
      </div>
      <button class="btn btn-primary btn-sm">Пригласить</button>
    </div>

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
    state.data = await api.getTeam();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
