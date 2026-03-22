<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Заявки</h1>
        <p class="text-secondary mb-0">Лиды с публичных форм.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="!state.data?.items?.length" @click="exportCsv">Экспорт CSV</button>
    </div>

    <div v-if="!canViewLeads" class="alert alert-warning">
      Доступ к заявкам есть только у Admin и Owner.
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем заявки…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить заявки.</div>

    <div class="card mb-3" v-if="state.data && canViewLeads">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Поиск</label>
            <input v-model="filters.query" class="form-control" placeholder="Email или компания" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Статус</label>
            <select v-model="filters.status" class="form-select">
              <option value="">Все</option>
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="closed">Closed</option>
            </select>
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

    <div class="card" v-if="state.data && canViewLeads">
      <div class="card-body">
        <div v-if="!state.total && !state.loading" class="alert alert-secondary">
          Нет заявок по текущим фильтрам. Попробуйте изменить запрос или сбросить фильтры.
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
                <th>Компания</th>
                <th>Email</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Комментарий</th>
                <th class="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedItems" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.company || '—' }}</td>
                <td><a :href="`mailto:${item.email}`">{{ item.email }}</a></td>
                <td>{{ item.source }}</td>
                <td>
                  <select v-model="item.status" class="form-select form-select-sm">
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
                <td>{{ item.created_at?.slice(0, 10) }}</td>
                <td class="text-secondary">
                  <input v-model="item.note" class="form-control form-control-sm" placeholder="Заметка" />
                </td>
                <td class="text-end">
                  <button class="btn btn-outline-secondary btn-sm" @click="saveLead(item)">Сохранить</button>
                </td>
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
import { useApi } from '../../composables/useApi';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';
import { useRoute, useRouter } from 'vue-router';

const api = useApi();
const { canViewLeads } = useAccess();
const state = reactive<{ loading: boolean; error: boolean; data: any | null; total: number }>({
  loading: true,
  error: false,
  data: null,
  total: 0
});
const filters = reactive({ query: '', status: '', from: '' });
const page = ref(1);
const pageSize = ref(20);
const router = useRouter();
const route = useRoute();

const loadLeads = async () => {
  if (!canViewLeads.value) {
    state.loading = false;
    return;
  }
  try {
    state.loading = true;
    const res = await api.getLeads({
      q: filters.query || undefined,
      status: filters.status || undefined,
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
  if (typeof q.status === 'string') filters.status = q.status;
  if (typeof q.from === 'string') filters.from = q.from;
  if (typeof q.page === 'string') page.value = Number(q.page) || 1;
  if (typeof q.size === 'string') pageSize.value = Number(q.size) || 20;
  loadLeads();
});

const filteredItems = computed(() => state.data?.items || []);
const totalPages = computed(() => Math.max(1, Math.ceil(state.total / pageSize.value)));
const pagedItems = computed(() => filteredItems.value);

const resetFilters = () => {
  filters.query = '';
  filters.status = '';
  filters.from = '';
  page.value = 1;
};

watch([() => filters.query, () => filters.status, () => filters.from], () => {
  page.value = 1;
});

watch([() => filters.query, () => filters.status, () => filters.from, page, pageSize], () => {
  router.replace({
    query: {
      ...route.query,
      q: filters.query || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
      size: pageSize.value !== 20 ? String(pageSize.value) : undefined
    }
  });
  loadLeads();
});

const saveLead = async (item: any) => {
  try {
    await api.updateLead(item.id, { status: item.status, note: item.note });
    pushToast('Лид обновлён.', 'success');
  } catch {
    pushToast('Не удалось обновить лид.', 'danger');
  }
};

const exportCsv = () => {
  if (!filteredItems.value.length) return;
  const header = 'id,company,email,source,created_at,message';
  const rows = filteredItems.value.map((item: any) => {
    const msg = String(item.message || '').replace(/\n/g, ' ');
    return `${item.id},"${item.company || ''}","${item.email}","${item.source}","${item.created_at}","${msg}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gridai-leads.csv';
  link.click();
  URL.revokeObjectURL(url);
};

useHead(`
  <title>GridAI — Заявки</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
