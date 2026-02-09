<template>
  <section class="py-5">
    <div class="container">
      <h1 class="h3 fw-bold mb-4">FAQ</h1>
      <div class="accordion" id="faqAccordion">
        <div class="accordion-item" v-for="(item, idx) in items" :key="item.q">
          <h2 class="accordion-header" :id="`heading-${idx}`">
            <button class="accordion-button" :class="idx ? 'collapsed' : ''" type="button" data-bs-toggle="collapse" :data-bs-target="`#collapse-${idx}`">
              {{ item.q }}
            </button>
          </h2>
          <div :id="`collapse-${idx}`" class="accordion-collapse collapse" :class="idx === 0 ? 'show' : ''" :data-bs-parent="'#faqAccordion'">
            <div class="accordion-body text-secondary">{{ item.a }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useHead } from '../composables/useHead';

const items = [
  { q: 'Откуда данные?', a: 'Используем публичные вакансии hh.ru и открытые справочники.' },
  { q: 'Можно ли подключить резюме?', a: 'Пока нет. Будет доступно только при разрешении HH.' },
  { q: 'Как получить доступ?', a: 'Оставьте заявку в Telegram — подключим пилот.' }
];

useHead(`
  <title>SkillRadar — FAQ</title>
  <meta name="description" content="Ответы на вопросы по SkillRadar." />
`);
</script>
