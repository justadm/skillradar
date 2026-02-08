<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Тарифы</h1>
        <p class="text-secondary mb-0">Подписка и лимиты.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm">История платежей</button>
    </div>

    <div class="row g-3">
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Starter</h3>
            <p class="display-6 fw-semibold">$99</p>
            <p class="text-secondary">До 3 отчётов в месяц.</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border border-primary">
          <div class="card-body">
            <span class="badge text-bg-primary">Популярный</span>
            <h3 class="h6 mt-2">Pro</h3>
            <p class="display-6 fw-semibold">$199</p>
            <p class="text-secondary">До 10 отчётов, экспорт CSV/PDF.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
