<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Отчёты</h1>
        <p class="text-secondary mb-0">Срезы рынка и B2B‑аналитика.</p>
      </div>
      <button class="btn btn-primary btn-sm" :disabled="!isAuthed" @click="toggleForm">
        Новый отчёт
      </button>
    </div>

    <div v-if="!isAuthed" class="alert alert-secondary">
      Демо‑режим: чтобы создавать отчёты, войдите в аккаунт.
    </div>

    <form v-if="showForm" class="card mb-3" @submit.prevent="submit">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Роль</label>
            <input v-model="form.role" class="form-control" placeholder="Backend Node.js" required />
          </div>
          <div class="col-md-4">
            <label class="form-label">Город</label>
            <input v-model="form.city" class="form-control" placeholder="Москва" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Тип</label>
            <select v-model="form.type" class="form-select">
              <option value="market">Рынок роли</option>
              <option value="competitors">Конкуренты</option>
              <option value="template">Шаблон вакансии</option>
            </select>
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary btn-sm" type="submit">Создать</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleForm">Отмена</button>
        </div>
        <div v-if="formMessage" class="alert alert-info mt-3">{{ formMessage }}</div>
      </div>
    </form>

    <div v-if="state.loading" class="alert alert-info">Загрузка отчётов…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить отчёты.</div>

    <div class="card mb-3" v-if="state.data">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Роль</label>
            <input v-model="filters.role" class="form-control" placeholder="Backend, QA" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Город</label>
            <input v-model="filters.city" class="form-control" placeholder="Москва" />
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

    <div class="card" v-if="state.data">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div class="text-secondary small">Отчётов: {{ filteredItems.length }}</div>
          <button class="btn btn-outline-secondary btn-sm" :disabled="!filteredItems.length" @click="exportCsv">
            Экспорт CSV
          </button>
        </div>
        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Роль</th>
                <th>Локация</th>
                <th>Тип отчёта</th>
                <th>Дата</th>
                <th>Статус</th>
                <th class="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredItems" :key="item.id || (item.role + item.date)">
                <td>{{ item.role }}</td>
                <td>{{ item.region }}</td>
                <td>{{ item.type }}</td>
                <td>{{ item.date }}</td>
                <td><span class="badge" :class="badgeClass(item.status)">{{ item.status }}</span></td>
                <td class="text-end">
                  <button class="btn btn-outline-primary btn-sm me-2" :disabled="!isAuthed" @click="downloadPdf(item)">
                    PDF
                  </button>
                  <button class="btn btn-outline-danger btn-sm" :disabled="!isAuthed" @click="confirmDelete(item)">
                    Удалить
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="showDelete" class="modal fade show" style="display: block;" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Удалить отчёт?</h5>
            <button type="button" class="btn-close" @click="cancelDelete"></button>
          </div>
          <div class="modal-body">
            <p>Отчёт «{{ pendingDelete?.role }}» будет удалён.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" @click="cancelDelete">Отмена</button>
            <button class="btn btn-danger" @click="performDelete">Удалить</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showDelete" class="modal-backdrop fade show"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { isAuthed } = useAuth();
const router = useRouter();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});
const showForm = ref(false);
const formMessage = ref('');
const form = reactive({ role: '', city: '', type: 'market' });
const showDelete = ref(false);
const pendingDelete = ref<any | null>(null);
const filters = reactive({ role: '', city: '', from: '' });

const badgeClass = (status: string) => {
  if (status?.toLowerCase().includes('работ')) return 'text-bg-warning';
  return 'text-bg-success';
};

const fetchReports = async () => {
  try {
    state.loading = true;
    state.data = await api.getReports();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
};

onMounted(fetchReports);

const filteredItems = computed(() => {
  if (!state.data?.items) return [];
  return state.data.items.filter((item: any) => {
    const roleOk = !filters.role || String(item.role || '').toLowerCase().includes(filters.role.toLowerCase());
    const cityOk = !filters.city || String(item.region || '').toLowerCase().includes(filters.city.toLowerCase());
    const dateOk = !filters.from || String(item.date || '') >= filters.from;
    return roleOk && cityOk && dateOk;
  });
});

const toggleForm = () => {
  showForm.value = !showForm.value;
  formMessage.value = '';
};

const submit = async () => {
  if (!isAuthed.value) {
    formMessage.value = 'Нужна авторизация.';
    pushToast('Войдите, чтобы создавать отчёты.', 'info');
    router.push('/login');
    return;
  }
  try {
    const res = await api.createReport(form);
    formMessage.value = `Отчёт создан: ${res.id}`;
    showForm.value = false;
    pushToast('Отчёт создан.', 'success');
    await fetchReports();
  } catch {
    formMessage.value = 'Не удалось создать отчёт.';
    pushToast('Не удалось создать отчёт.', 'danger');
  }
};

const resetFilters = () => {
  filters.role = '';
  filters.city = '';
  filters.from = '';
};

const exportCsv = () => {
  const header = 'role,city,type,date,status';
  const rows = filteredItems.value.map((item: any) => {
    return `"${item.role}","${item.region}","${item.type}","${item.date}","${item.status}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'skillradar-reports.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const downloadPdf = async (item: any) => {
  if (!item?.id) {
    pushToast('Для PDF нужен ID отчёта.', 'danger');
    return;
  }
  try {
    const blob = await api.exportReport(item.id, 'pdf');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${item.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    pushToast('Не удалось скачать PDF.', 'danger');
  }
};

const confirmDelete = (item: any) => {
  if (!isAuthed.value) {
    pushToast('Войдите, чтобы удалять отчёты.', 'info');
    router.push('/login');
    return;
  }
  pendingDelete.value = item;
  showDelete.value = true;
};

const cancelDelete = () => {
  showDelete.value = false;
  pendingDelete.value = null;
};

const performDelete = async () => {
  if (!pendingDelete.value?.id) {
    pushToast('Не удалось определить отчёт для удаления.', 'danger');
    cancelDelete();
    return;
  }
  try {
    await api.deleteReport(pendingDelete.value.id);
    pushToast('Отчёт удалён.', 'success');
    await fetchReports();
  } catch {
    pushToast('Не удалось удалить отчёт.', 'danger');
  } finally {
    cancelDelete();
  }
};

useHead(`
  <title>SkillRadar — Отчёты</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
