<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Аудит</h1>
        <p class="text-secondary mb-0">История действий в ЛК.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="!state.data?.items?.length" @click="exportCsv">Экспорт CSV</button>
    </div>

    <div v-if="!canViewAudit" class="alert alert-warning">
      Доступ к аудиту есть только у Admin и Owner.
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем аудит…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить аудит.</div>

    <div class="card mb-3" v-if="state.data && canViewAudit">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Поиск</label>
            <input v-model="filters.query" class="form-control" placeholder="Action / Actor / Target" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Action</label>
            <input v-model="filters.action" class="form-control" placeholder="team.invite" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Дата (от)</label>
            <input v-model="filters.from" class="form-control" type="date" />
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-secondary w-100" type="button" @click="resetFilters">Сбросить</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-if="state.data && canViewAudit">
      <div class="card-body">
        <div v-if="!state.total && !state.loading" class="alert alert-secondary">
          Нет событий по текущим фильтрам. Попробуйте изменить запрос или сбросить фильтры.
        </div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div class="text-secondary small">Найдено: {{ state.total }}</div>
          <div class="d-flex align-items-center gap-2">
            <label class="text-secondary small">На странице</label>
            <select v-model.number="pageSize" class="form-select form-select-sm" style="width: auto;">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table align-middle" v-if="state.total">
            <thead>
              <tr>
                <th>ID</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Дата</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedItems" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.actor_id || '—' }}</td>
                <td>{{ item.action }}</td>
                <td>{{ item.target || '—' }}</td>
                <td>{{ item.created_at?.slice(0, 19).replace('T', ' ') }}</td>
                <td class="text-secondary">{{ formatPayload(item.payload) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3" v-if="totalPages > 1">
          <button class="btn btn-outline-secondary btn-sm" :disabled="page === 1" @click="page -= 1">Назад</button>
          <span class="text-secondary small">Стр. {{ page }} из {{ totalPages }}</span>
          <button class="btn btn-outline-secondary btn-sm" :disabled="page === totalPages" @click="page += 1">Вперед</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';

const api = useApi();
const { canViewAudit } = useAccess();
const state = reactive<{ loading: boolean; error: boolean; data: any | null; total: number }>({
  loading: true,
  error: false,
  data: null,
  total: 0
});
const filters = reactive({ query: '', action: '', from: '' });
const page = ref(1);
const pageSize = ref(20);
const router = useRouter();
const route = useRoute();

const loadAudit = async () => {
  if (!canViewAudit.value) {
    state.loading = false;
    return;
  }
  try {
    state.loading = true;
    const res = await api.getAudit({
      q: filters.query || undefined,
      action: filters.action || undefined,
      from: filters.from || undefined,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    });
    state.data = res;
    state.total = res?.total ?? res?.items?.length ?? 0;
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
};

onMounted(() => {
  const q = route.query;
  if (typeof q.q === 'string') filters.query = q.q;
  if (typeof q.action === 'string') filters.action = q.action;
  if (typeof q.from === 'string') filters.from = q.from;
  if (typeof q.page === 'string') page.value = Number(q.page) || 1;
  if (typeof q.size === 'string') pageSize.value = Number(q.size) || 20;
  loadAudit();
});

const filteredItems = computed(() => state.data?.items || []);
const totalPages = computed(() => Math.max(1, Math.ceil(state.total / pageSize.value)));
const pagedItems = computed(() => filteredItems.value);

const resetFilters = () => {
  filters.query = '';
  filters.action = '';
  filters.from = '';
  page.value = 1;
};

watch([() => filters.query, () => filters.action, () => filters.from], () => {
  page.value = 1;
});

watch([() => filters.query, () => filters.action, () => filters.from, page, pageSize], () => {
  router.replace({
    query: {
      ...route.query,
      q: filters.query || undefined,
      action: filters.action || undefined,
      from: filters.from || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
      size: pageSize.value !== 20 ? String(pageSize.value) : undefined
    }
  });
  loadAudit();
});

const formatPayload = (payload: any) => {
  if (!payload) return '—';
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const exportCsv = () => {
  if (!filteredItems.value.length) return;
  const header = 'id,actor,action,target,created_at,payload';
  const rows = filteredItems.value.map((item: any) => {
    const payload = item.payload ? JSON.stringify(item.payload).replace(/\n/g, ' ') : '';
    return `${item.id},"${item.actor_id || ''}","${item.action}","${item.target || ''}","${item.created_at}","${payload}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'skillradar-audit.csv';
  link.click();
  URL.revokeObjectURL(url);
};

useHead(`
  <title>SkillRadar — Аудит</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
