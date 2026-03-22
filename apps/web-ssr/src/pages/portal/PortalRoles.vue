<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Профили ролей</h1>
        <p class="text-secondary mb-0">Шаблоны ролей, навыки и вилки.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="!isAuthed || !canCreateReports" @click="toggleForm">Создать профиль</button>
    </div>

    <div v-if="!isAuthed" class="alert alert-secondary">
      Демо‑режим: создание профилей доступно после входа.
    </div>
    <div v-else-if="!canCreateReports" class="alert alert-warning">
      У вашей роли нет прав на создание профилей.
    </div>

    <form v-if="showForm" class="card mb-3" @submit.prevent="submit">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Название</label>
            <input v-model="form.name" class="form-control" placeholder="Backend Moscow" />
          </div>
          <div class="col-md-4">
            <label class="form-label">Роль</label>
            <input v-model="form.role" class="form-control" placeholder="Backend Node.js" required />
          </div>
          <div class="col-md-4">
            <label class="form-label">Город</label>
            <input v-model="form.city" class="form-control" placeholder="Москва" />
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button class="btn btn-primary btn-sm" type="submit">Сохранить</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleForm">Отмена</button>
        </div>
        <div v-if="formMessage" class="alert alert-info mt-3">{{ formMessage }}</div>
      </div>
    </form>

    <div v-if="state.loading" class="alert alert-info">Загрузка ролей…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить роли.</div>

    <div class="row g-3" v-if="state.data">
      <div class="col-md-6 col-lg-4" v-for="item in state.data.items" :key="item.title">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">{{ item.title }}</h3>
            <p class="text-secondary">{{ item.region }} · {{ item.level }}</p>
            <p class="text-secondary">Навыки: {{ item.skills }}</p>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm">Открыть</button>
              <button class="btn btn-outline-danger btn-sm" :disabled="!isAuthed || !canDeleteRoles" @click="confirmDelete(item)">
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDelete" class="modal fade show" style="display: block;" tabindex="-1" role="dialog">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Удалить профиль?</h5>
            <button type="button" class="btn-close" @click="cancelDelete"></button>
          </div>
          <div class="modal-body">
            <p>Профиль «{{ pendingDelete?.title }}» будет удалён.</p>
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
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { isAuthed } = useAuth();
const { canCreateReports, canDeleteRoles } = useAccess();
const router = useRouter();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});
const showForm = ref(false);
const formMessage = ref('');
const form = reactive({ name: '', role: '', city: '' });
const showDelete = ref(false);
const pendingDelete = ref<any | null>(null);

const fetchRoles = async () => {
  try {
    state.loading = true;
    state.data = await api.getRoles();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
};

onMounted(fetchRoles);

const toggleForm = () => {
  showForm.value = !showForm.value;
  formMessage.value = '';
};

const submit = async () => {
  if (!isAuthed.value) {
    formMessage.value = 'Нужна авторизация.';
    pushToast('Войдите, чтобы создавать профили ролей.', 'info');
    router.push('/login');
    return;
  }
  if (!canCreateReports.value) {
    formMessage.value = 'Недостаточно прав.';
    pushToast('Недостаточно прав для создания профиля.', 'warning');
    return;
  }
  try {
    const res = await api.createRole(form);
    formMessage.value = `Профиль создан: ${res.id}`;
    showForm.value = false;
    pushToast('Профиль роли создан.', 'success');
    await fetchRoles();
  } catch {
    formMessage.value = 'Не удалось создать профиль.';
    pushToast('Не удалось создать профиль роли.', 'danger');
  }
};

const confirmDelete = (item: any) => {
  if (!isAuthed.value) {
    pushToast('Войдите, чтобы удалять профили.', 'info');
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
    pushToast('Не удалось определить профиль для удаления.', 'danger');
    cancelDelete();
    return;
  }
  if (!canDeleteRoles.value) {
    pushToast('Недостаточно прав для удаления.', 'warning');
    cancelDelete();
    return;
  }
  try {
    await api.deleteRole(pendingDelete.value.id);
    pushToast('Профиль удалён.', 'success');
    await fetchRoles();
  } catch {
    pushToast('Не удалось удалить профиль.', 'danger');
  } finally {
    cancelDelete();
  }
};

useHead(`
  <title>GridAI — Профили ролей</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
