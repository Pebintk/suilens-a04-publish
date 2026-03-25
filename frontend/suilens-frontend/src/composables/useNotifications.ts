import { onBeforeUnmount, onMounted, ref, unref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";

const API_BASE = import.meta.env.VITE_NOTIFICATION_API || "http://localhost:3003";
const WS_URL =
  import.meta.env.VITE_NOTIFICATION_WS || "ws://localhost:3003/ws/notifications";

export interface NotificationPayload {
  orderId: string;
  customerName: string;
  customerEmail: string;
  lensName: string;
  branchCode?: string;
  quantity?: number;
}

export interface NotificationRecord {
  id: string;
  orderId: string;
  type: string;
  recipient: string;
  message: string;
  payload: NotificationPayload;
  sentAt: string;
}

export function useNotifications() {
  const socket = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const socketError = ref("");
  const liveNotifications = ref<NotificationRecord[]>([]);
  const reconnectTimer = ref<number | null>(null);
  const isUnmounted = ref(false);
  const historyQuery = useQuery<NotificationRecord[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/notifications`);
      if (!response.ok) throw new Error("Failed to load notifications");
      return response.json();
    },
    staleTime: 1000 * 10,
  });

  function syncFromHistory(notifications: NotificationRecord[]) {
    const existingIds = new Set(liveNotifications.value.map((item) => item.id));
    const merged = [...liveNotifications.value];

    for (const notification of notifications) {
      if (!existingIds.has(notification.id)) {
        merged.push(notification);
      }
    }

    liveNotifications.value = merged.sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    );
  }

  function clearReconnectTimer() {
    if (reconnectTimer.value !== null) {
      window.clearTimeout(reconnectTimer.value);
      reconnectTimer.value = null;
    }
  }

  function scheduleReconnect() {
    if (isUnmounted.value || reconnectTimer.value !== null) return;

    reconnectTimer.value = window.setTimeout(() => {
      reconnectTimer.value = null;
      connect();
    }, 2000);
  }

  function connect() {
    if (socket.value) return;

    const ws = new WebSocket(WS_URL);
    socket.value = ws;

    ws.addEventListener("open", () => {
      isConnected.value = true;
      socketError.value = "";
      clearReconnectTimer();
    });

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "notification.created") {
        const alreadyExists = liveNotifications.value.some(
          (item) => item.id === payload.notification.id,
        );

        if (!alreadyExists) {
          liveNotifications.value.unshift(payload.notification);
        }
      }
    });

    ws.addEventListener("close", () => {
      isConnected.value = false;
      socket.value = null;
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      isConnected.value = false;
      socketError.value = "WebSocket connection failed";
      socket.value?.close();
    });
  }

  function disconnect() {
    clearReconnectTimer();
    socket.value?.close();
    socket.value = null;
  }

  async function refreshNotifications() {
    const result = await historyQuery.refetch();

    if (result.data) {
      syncFromHistory(result.data);
    }
  }

  onMounted(async () => {
    isUnmounted.value = false;
    await refreshNotifications();
    connect();
  });

  onBeforeUnmount(() => {
    isUnmounted.value = true;
    disconnect();
  });

  watch(
    () => historyQuery.data.value,
    (value) => {
      if (value) {
        syncFromHistory(value);
      }
    },
    { immediate: true },
  );

  return {
    historyQuery,
    isConnected,
    socketError,
    liveNotifications,
    refreshNotifications,
    connect,
    disconnect,
  };
}
