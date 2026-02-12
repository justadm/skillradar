<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Настройки</h1>
        <p class="text-secondary mb-0">Лимиты, уведомления, интеграции.</p>
      </div>
    </div>

    <div v-if="!canManageSettings" class="alert alert-warning">
      Доступ к настройкам есть только у Owner и Admin.
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем настройки…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить настройки.</div>

    <div class="row g-3" v-if="state.data && canManageSettings">
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
      <div class="col-12">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Интеграция HH.ru</h3>
            <p class="text-secondary mb-1">Настроено: {{ state.data.hh?.configured ? 'Да' : 'Нет' }}</p>
            <p class="text-secondary mb-1">Подключено: {{ state.data.hh?.connected ? 'Да' : 'Нет' }}</p>
            <p class="text-secondary mb-1">Токен до: {{ state.data.hh?.expires_at || 'n/a' }}</p>
            <p class="text-secondary mb-1">Последний успешный запрос: {{ state.data.hh?.last_success_at || 'n/a' }}</p>
            <p class="text-secondary mb-3">Последняя ошибка: {{ state.data.hh?.last_error || 'n/a' }}</p>
            <div class="d-flex gap-2">
              <button class="btn btn-primary btn-sm" :disabled="oauthLoading || !state.data.hh?.configured" @click="connectHh">
                {{ oauthLoading ? 'Переход...' : 'Подключить HH OAuth' }}
              </button>
              <button class="btn btn-outline-secondary btn-sm" @click="reloadSettings">Обновить статус</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useApi } from '../../composables/useApi';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { canManageSettings } = useAccess();
const state = reactive<{ loading: boolean; error: boolean; data: any | null }>({
  loading: true,
  error: false,
  data: null
});
const oauthLoading = ref(false);

const reloadSettings = async () => {
  try {
    state.loading = true;
    state.error = false;
    state.data = await api.getSettings();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
};

const connectHh = async () => {
  try {
    oauthLoading.value = true;
    const res = await api.startHhOauth();
    window.location.href = res.url;
  } catch {
    pushToast('Не удалось запустить HH OAuth.', 'danger');
  } finally {
    oauthLoading.value = false;
  }
};

onMounted(reloadSettings);

useHead(`
  <title>SkillRadar — Настройки</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
