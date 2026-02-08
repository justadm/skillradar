<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1080">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast show align-items-center border-0 mb-2"
      :class="`text-bg-${toast.type}`"
      role="alert"
    >
      <div class="d-flex">
        <div class="toast-body">{{ toast.message }}</div>
        <button class="btn-close btn-close-white me-2 m-auto" @click="remove(toast.id)"></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toasts, remove } from '../composables/useToast';
</script>
