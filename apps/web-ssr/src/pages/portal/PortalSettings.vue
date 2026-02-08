<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Настройки</h1>
        <p class="text-secondary mb-0">Лимиты, уведомления, интеграции.</p>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Уведомления</h3>
            <div class="form-check form-switch mt-3">
              <input class="form-check-input" type="checkbox" role="switch" checked />
              <label class="form-check-label">Еженедельный отчёт</label>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" role="switch" />
              <label class="form-check-label">Алёрты по зарплатам</label>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Лимиты</h3>
            <p class="text-secondary">Запросов: 120 / месяц</p>
            <p class="text-secondary">Экспортов: 30 / месяц</p>
            <button class="btn btn-outline-secondary btn-sm">Увеличить лимит</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
