<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Тарифы</h1>
        <p class="text-secondary mb-0">Подписка и лимиты.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="!canManageBilling">История платежей</button>
    </div>

    <div v-if="!canManageBilling" class="alert alert-warning">
      Доступ к биллингу есть только у Owner.
    </div>

    <div v-if="state.loading" class="alert alert-info">Загружаем тарифы…</div>
    <div v-if="state.error" class="alert alert-danger">Не удалось загрузить тарифы.</div>

    <div class="row g-3" v-if="state.data && canManageBilling">
      <div class="col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Текущий план</h3>
            <p class="display-6 fw-semibold">{{ state.data.current_plan?.name || '—' }}</p>
            <p class="text-secondary">Цена: {{ state.data.current_plan?.price || '—' }}</p>
            <p class="text-secondary">Лимит отчетов: {{ state.data.current_plan?.limits?.reports_per_day || '—' }} / день</p>
            <p class="text-secondary">Команда: {{ state.data.current_plan?.limits?.team_size || '—' }} пользователей</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4" v-for="plan in state.data.plans" :key="plan.name">
        <div class="card h-100" :class="{ 'border border-primary': plan.featured }">
          <div class="card-body">
            <span v-if="plan.featured" class="badge text-bg-primary">Популярный</span>
            <h3 class="h6" :class="{ 'mt-2': plan.featured }">{{ plan.name }}</h3>
            <p class="display-6 fw-semibold">{{ plan.price }}</p>
            <p class="text-secondary">{{ plan.desc }}</p>
            <button class="btn" :class="plan.featured ? 'btn-primary' : 'btn-outline-secondary'" @click="startCheckout(plan)">
              {{ plan.cta }}
            </button>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">История платежей</h3>
            <ul class="text-secondary mb-0">
              <li v-for="item in state.data.history || []" :key="item.date">{{ item.date }} · {{ item.amount }} · {{ item.status }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useApi } from '../../composables/useApi';
import { useAccess } from '../../composables/useAccess';
import { useHead } from '../../composables/useHead';
import { pushToast } from '../../composables/useToast';

const api = useApi();
const { canManageBilling } = useAccess();
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

const startCheckout = async (plan: any) => {
  if (!canManageBilling.value) return;
  try {
    const res = await api.startCheckout(plan.name);
    if (res?.url) {
      window.location.href = res.url;
    } else {
      pushToast('Не удалось открыть оплату.', 'danger');
    }
  } catch {
    pushToast('Не удалось открыть оплату.', 'danger');
  }
};

useHead(`
  <title>SkillRadar — Тарифы</title>
  <meta name="robots" content="noindex,nofollow" />
`);
</script>
