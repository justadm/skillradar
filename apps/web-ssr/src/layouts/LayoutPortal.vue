<template>
  <div>
    <header class="border-bottom bg-body-tertiary">
      <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
          <RouterLink class="navbar-brand fw-semibold" to="/portal">SkillRadar Portal</RouterLink>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#portalNav"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="portalNav">
            <ul class="navbar-nav me-auto">
              <li class="nav-item"><RouterLink class="nav-link" to="/portal">Дашборд</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/reports">Отчёты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/roles">Роли</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/competitors">Конкуренты</RouterLink></li>
              <li class="nav-item"><RouterLink class="nav-link" to="/portal/template">Шаблон</RouterLink></li>
            </ul>
            <div class="d-flex gap-2">
              <RouterLink class="btn btn-outline-secondary" to="/ui-kit">UI‑kit</RouterLink>
              <RouterLink class="btn btn-outline-secondary" to="/login">Войти</RouterLink>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main class="py-4">
      <div class="container-fluid">
        <div v-if="!isAuthed" class="alert alert-warning">
          Демо‑режим: показываем пример данных. Для полной версии войдите.
        </div>
        <div class="row">
          <aside class="col-lg-2 mb-3">
            <div class="list-group">
              <RouterLink class="list-group-item list-group-item-action" to="/portal">Дашборд</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/reports">Отчёты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/roles">Профили ролей</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/competitors">Конкуренты</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/template">Шаблон вакансии</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/team">Команда</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/billing">Тарифы</RouterLink>
              <RouterLink class="list-group-item list-group-item-action" to="/portal/settings">Настройки</RouterLink>
            </div>
          </aside>
          <section class="col-lg-10">
            <slot />
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const { isAuthed } = useAuth();
</script>
