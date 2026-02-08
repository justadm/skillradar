import { ref, computed, onMounted } from 'vue';

const token = ref<string | null>(typeof window !== 'undefined' ? localStorage.getItem('sr-token') : null);

export function useAuth() {
  const isAuthed = computed(() => Boolean(token.value));

  const loadToken = () => {
    if (typeof window === 'undefined') return;
    token.value = localStorage.getItem('sr-token');
  };

  const setToken = (value: string | null) => {
    token.value = value;
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem('sr-token', value);
      } else {
        localStorage.removeItem('sr-token');
      }
    }
  };

  onMounted(loadToken);

  return { token, isAuthed, loadToken, setToken };
}
