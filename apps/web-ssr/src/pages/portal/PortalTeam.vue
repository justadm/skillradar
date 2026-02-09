<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Команда</h1>
        <p class="text-secondary mb-0">Участники и роли.</p>
      </div>
      <button class="btn btn-primary btn-sm" :disabled="!isAuthed || !canManageTeam" @click="toggleForm">Пригласить</button>
    </div>

    <div v-if="!isAuthed" class="alert alert-secondary">
      Демо‑режим: приглашения доступны после входа.
    </div>
    <div v-else-if="!canManageTeam" class="alert alert-warning">
      У вашей роли нет прав на управление командой.
    </div>

    <form v-if="showForm" class="card mb-3" @submit.prevent="submit">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Email</label>
            <input v-model="form.email" class="form-control" placeholder="user@company.com" required />
          </div>
          <div class="col-md-6">
            <label class="form-label">Роль</label>
            <select v-model="form.role" class="form-select">
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary btn-sm" type="submit">Отправить</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleForm">Отмена</button>
        </div>
        <div v-if="formMessage" class="alert alert-info mt-3">{{ formMessage }}</div>
      </div>
    </form>

    <div v-if="state.loading" class="alert alert-info">Загружаем команду…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить команду.</div>

    <div class="card mb-3" v-if="state.data">
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Поиск</label>
            <input v-model="filters.query" class="form-control" placeholder="Имя или email" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Роль</label>
            <select v-model="filters.role" class="form-select">
              <option value="">Все</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Статус</label>
            <select v-model="filters.status" class="form-select">
              <option value="">Все</option>
              <option value="active">Active</option>
              <option value="invited">Invitation pending</option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-secondary w-100" type="button" @click="resetFilters">Сбросить</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-if="state.data">
      <div class="card-body">
        <div v-if="!state.total && !state.loading" class="alert alert-secondary">
          Никого не нашли по текущим фильтрам. Попробуйте изменить запрос или сбросить фильтры.
        </div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div class="text-secondary small">Найдено: {{ state.total }}</div>
          <div class="d-flex align-items-center gap-2">
            <label class="text-secondary small">На странице</label>
            <select v-model.number="pageSize" class="form-select form-select-sm" style="width: auto;">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
            </select>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table align-middle" v-if="state.total">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th class="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in state.data.members" :key="member.id || member.email">
                <td>{{ member.name }}</td>
                <td>{{ member.email || '—' }}</td>
                <td>
                  <select v-model="member.role" class="form-select form-select-sm" :disabled="!canManageTeam">
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td>{{ member.access }}</td>
                <td class="text-end">
                  <button class="btn btn-outline-secondary btn-sm me-2" :disabled="!canManageTeam" @click="saveRole(member)">
                    Сохранить
                  </button>
                  <button class="btn btn-outline-danger btn-sm" :disabled="!canManageTeam" @click="confirmDelete(member)">
                    Удалить
                  </button>
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

    <div v-if="showDelete" class="modal fade show" style="display: block;" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Удалить участника?</h5>
            <button type="button" class="btn-close" @click="cancelDelete"></button>
          </div>
          <div class="modal-body">
            <p>{{ pendingDelete?.email || pendingDelete?.name }} будет удалён.</p>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useApi } from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { isAuthed } = useAuth();
const { canManageTeam } = useAccess();
const state = reactive<{ loading: boolean; error: boolean; data: any | null; total: number }>({
  loading: true,
  error: false,
  data: null,
  total: 0
});
const showForm = ref(false);
const formMessage = ref('');
const form = reactive({ email: '', role: 'analyst' });
const showDelete = ref(false);
const pendingDelete = ref<any | null>(null);
const filters = reactive({ query: '', role: '', status: '' });
const page = ref(1);
const pageSize = ref(10);
const router = useRouter();
const route = useRoute();

const loadTeam = async () => {
  try {
    state.loading = true;
    const res = await api.getTeam({
      q: filters.query || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    });
    state.data = res;
    state.total = res?.total ?? res?.members?.length ?? 0;
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
};

onMounted(() => {
  const q = route.query;
  if (typeof q.q === 'string') filters.query = q.q;
  if (typeof q.role === 'string') filters.role = q.role;
  if (typeof q.status === 'string') filters.status = q.status;
  if (typeof q.page === 'string') page.value = Number(q.page) || 1;
  if (typeof q.size === 'string') pageSize.value = Number(q.size) || 10;
  loadTeam();
});

const totalPages = computed(() => Math.max(1, Math.ceil(state.total / pageSize.value)));

const resetFilters = () => {
  filters.query = '';
  filters.role = '';
  filters.status = '';
  page.value = 1;
};

watch([() => filters.query, () => filters.role, () => filters.status], () => {
  page.value = 1;
});

watch([() => filters.query, () => filters.role, () => filters.status, page, pageSize], () => {
  router.replace({
    query: {
      ...route.query,
      q: filters.query || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
      size: pageSize.value !== 10 ? String(pageSize.value) : undefined
    }
  });
  loadTeam();
});

const toggleForm = () => {
  showForm.value = !showForm.value;
  formMessage.value = '';
};

const submit = async () => {
  if (!isAuthed.value) {
    formMessage.value = 'Нужна авторизация.';
    pushToast('Войдите, чтобы приглашать участников.', 'info');
    return;
  }
  if (!canManageTeam.value) {
    formMessage.value = 'Недостаточно прав.';
    pushToast('Недостаточно прав для управления командой.', 'warning');
    return;
  }
  try {
    await api.inviteTeam(form);
    formMessage.value = 'Приглашение отправлено.';
    showForm.value = false;
    pushToast('Приглашение отправлено.', 'success');
    await loadTeam();
  } catch {
    formMessage.value = 'Не удалось отправить приглашение.';
    pushToast('Не удалось отправить приглашение.', 'danger');
  }
};

const saveRole = async (member: any) => {
  if (!canManageTeam.value) return;
  if (!member?.id) {
    pushToast('Не удалось определить пользователя.', 'danger');
    return;
  }
  try {
    await api.updateTeamRole(member.id, { role: member.role });
    pushToast('Роль обновлена.', 'success');
  } catch {
    pushToast('Не удалось обновить роль.', 'danger');
  }
};

const confirmDelete = (member: any) => {
  pendingDelete.value = member;
  showDelete.value = true;
};

const cancelDelete = () => {
  showDelete.value = false;
  pendingDelete.value = null;
};

const performDelete = async () => {
  if (!pendingDelete.value?.id) {
    pushToast('Не удалось определить пользователя.', 'danger');
    cancelDelete();
    return;
  }
  try {
    await api.deleteTeamMember(pendingDelete.value.id);
    pushToast('Участник удалён.', 'success');
    await loadTeam();
  } catch {
    pushToast('Не удалось удалить участника.', 'danger');
  } finally {
    cancelDelete();
  }
};

useHead(`
  <title>SkillRadar — Команда</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
