import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface CartItem {
  lensId: string;
  lensName: string;
  dayPrice: number;
  startDate: string;
  endDate: string;
}

export const useCartStore = defineStore('cart', () => {
  const item = ref<CartItem | null>(null);

  const totalDays = computed(() => {
    if (!item.value) return 0;
    const start = new Date(item.value.startDate);
    const end = new Date(item.value.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  });

  const totalPrice = computed(() => {
    if (!item.value) return 0;
    return totalDays.value * item.value.dayPrice;
  });

  function setItem(newItem: CartItem) {
    item.value = newItem;
  }

  function clearCart() {
    item.value = null;
  }

  return { item, totalDays, totalPrice, setItem, clearCart };
});
