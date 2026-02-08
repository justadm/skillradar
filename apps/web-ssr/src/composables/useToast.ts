import { ref } from 'vue';

type ToastType = 'success' | 'danger' | 'info';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

export const toasts = ref<Toast[]>([]);

export function pushToast(message: string, type: ToastType = 'info') {
  const id = `${Date.now()}_${Math.random()}`;
  toasts.value.push({ id, message, type });
  setTimeout(() => remove(id), 4000);
}

export function remove(id: string) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}
