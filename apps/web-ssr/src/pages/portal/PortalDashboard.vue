<template>
  <div>
    <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
      <div>
        <h1 class="h3 mb-1">Дашборд</h1>
        <p class="text-secondary mb-0">Ключевые метрики и активность.</p>
      </div>
      <div class="btn-group">
        <button class="btn btn-outline-secondary btn-sm">Обновить</button>
        <button class="btn btn-primary btn-sm">Экспорт</button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">Вакансий в рынке</p>
            <h2 class="h4 mb-0">1 240</h2>
            <small class="text-secondary">+5% за 7 дней</small>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">Доля удалёнки</p>
            <h2 class="h4 mb-0">38%</h2>
            <small class="text-secondary">Стабильно</small>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-secondary mb-2">Средняя вилка</p>
            <h2 class="h4 mb-0">170–250k</h2>
            <small class="text-secondary">Москва · Backend</small>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="card">
          <div class="card-body">
            <h3 class="h6">Последние отчёты</h3>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Роль</th>
                    <th>Регион</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Backend Node.js</td>
                    <td>Москва</td>
                    <td>2026‑02‑08</td>
                    <td><span class="badge text-bg-success">Готов</span></td>
                  </tr>
                  <tr>
                    <td>QA Automation</td>
                    <td>СПб</td>
                    <td>2026‑02‑07</td>
                    <td><span class="badge text-bg-success">Готов</span></td>
                  </tr>
                  <tr>
                    <td>Product Manager</td>
                    <td>Казань</td>
                    <td>2026‑02‑06</td>
                    <td><span class="badge text-bg-warning">В работе</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card h-100">
          <div class="card-body">
            <h3 class="h6">Активность</h3>
            <ul class="list-unstyled text-secondary mt-3">
              <li>• Запрос «Backend, 3+ года» — 12 минут назад</li>
              <li>• Сохранён отчёт по конкурентам — 1 час назад</li>
              <li>• Изменены стоп‑слова — 3 часа назад</li>
              <li>• Добавлен участник команды — вчера</li>
            </ul>
            <button class="btn btn-outline-secondary btn-sm">Открыть журнал</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
