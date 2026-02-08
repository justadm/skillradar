<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Отчёты</h1>
        <p class="text-secondary mb-0">Срезы рынка и B2B‑аналитика.</p>
      </div>
      <button class="btn btn-primary btn-sm">Новый отчёт</button>
    </div>

    <div v-if="state.loading" class="alert alert-info">Загрузка отчётов…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить отчёты.</div>

    <div class="card" v-if="state.data">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Роль</th>
                <th>Локация</th>
                <th>Тип отчёта</th>
                <th>Дата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in state.data.items" :key="item.role + item.date">
                <td>{{ item.role }}</td>
                <td>{{ item.region }}</td>
                <td>{{ item.type }}</td>
                <td>{{ item.date }}</td>
                <td><span class="badge" :class="badgeClass(item.status)">{{ item.status }}</span></td>
              </tr>
            </tbody>
          </table>
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

const badgeClass = (status: string) => {
  if (status?.toLowerCase().includes('работ')) return 'text-bg-warning';
  return 'text-bg-success';
};

onMounted(async () => {
  try {
    state.data = await api.getReports();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});
</script>
