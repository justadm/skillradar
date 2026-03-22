<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Дашборд</h1>
        <p class="text-secondary mb-0">Ключевые метрики и активность.</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary btn-sm">Обновить</button>
        <button class="btn btn-primary btn-sm">Экспорт</button>
      </div>
    </div>

    <div v-if="state.loading" class="alert alert-info">Загрузка данных…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить данные.</div>

    <div class="row g-3 mb-4" v-if="state.data">
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">{{ state.data.stats[0].label }}</p>
            <h2 class="h4 mb-0">{{ state.data.stats[0].value }}</h2>
            <small class="text-secondary">{{ state.data.stats[0].delta }}</small>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">{{ state.data.stats[1].label }}</p>
            <h2 class="h4 mb-0">{{ state.data.stats[1].value }}</h2>
            <small class="text-secondary">{{ state.data.stats[1].delta }}</small>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">{{ state.data.stats[2].label }}</p>
            <h2 class="h4 mb-0">{{ state.data.stats[2].value }}</h2>
            <small class="text-secondary">{{ state.data.stats[2].delta }}</small>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3" v-if="state.data">
      <div class="col-lg-7">
        <div class="card">
          <div class="card-body">
            <h3 class="h6">Последние отчёты</h3>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Роль</th>
                    <th>Регион</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in state.data.reports" :key="item.role + item.date">
                    <td>{{ item.role }}</td>
                    <td>{{ item.region }}</td>
                    <td>{{ item.date }}</td>
                    <td>
                      <span class="badge" :class="badgeClass(item.status)">{{ item.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Активность</h3>
            <ul class="list-unstyled text-secondary mt-3">
              <li v-for="item in state.data.activity" :key="item">• {{ item }}</li>
            </ul>
            <button class="btn btn-outline-secondary btn-sm">Открыть журнал</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useApi } from '../../composables/useApi';
import { useHead } from '../../composables/useHead';

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
    state.loading = true;
    state.data = await api.getDashboard();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
});

useHead(`
  <title>GridAI — Дашборд</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
