<template>
  <section class="py-5">
    <div class="container">
      <h1 class="h3 fw-semibold mb-3">UI‑kit</h1>
      <p class="text-secondary">Bootstrap‑компоненты, которые используем в проекте.</p>

      <div class="mb-4">
        <h2 class="h6">Кнопки</h2>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-primary">Primary</button>
          <button class="btn btn-outline-secondary">Secondary</button>
          <button class="btn btn-success">Success</button>
          <button class="btn btn-warning">Warning</button>
          <button class="btn btn-danger">Danger</button>
        </div>
      </div>

      <div class="mb-4">
        <h2 class="h6">Карточки</h2>
        <div class="row g-3">
          <div class="col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="h6">Рынок роли</h3>
                <p class="text-secondary mb-0">Спрос, вилки, навыки.</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100 border border-primary">
              <div class="card-body">
                <span class="badge text-bg-primary">Популярно</span>
                <h3 class="h6 mt-2">Шаблон вакансии</h3>
                <p class="text-secondary mb-0">Готовый текст с вилкой.</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="card h-100">
              <div class="card-body">
                <h3 class="h6">Конкуренты</h3>
                <p class="text-secondary mb-0">ТОП работодателей.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-4">
        <h2 class="h6">Таблица</h2>
        <div class="card">
          <div class="card-body">
            <div class="table-responsive">
              <table class="table align-middle">
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
                    <td><span class="badge text-bg-warning">В работе</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
