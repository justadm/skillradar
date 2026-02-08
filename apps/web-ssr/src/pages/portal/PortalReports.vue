<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Отчёты</h1>
        <p class="text-secondary mb-0">Срезы рынка и B2B‑аналитика.</p>
      </div>
      <button class="btn btn-primary btn-sm">Новый отчёт</button>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Роль</th>
                <th>Локация</th>
                <th>Тип отчёта</th>
                <th>Дата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Backend Node.js</td>
                <td>Москва</td>
                <td>Рынок роли</td>
                <td>2026‑02‑08</td>
                <td><span class="badge text-bg-success">Готов</span></td>
              </tr>
              <tr>
                <td>Product Manager</td>
                <td>Казань</td>
                <td>Конкуренты</td>
                <td>2026‑02‑07</td>
                <td><span class="badge text-bg-warning">В работе</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
