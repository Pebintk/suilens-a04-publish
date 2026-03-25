<template>
  <v-container
    class="py-8"
    max-width="800"
  >
    <v-card>
      <v-card-title>Live Order Notifications</v-card-title>
      <v-divider />

      <v-card-text
        class="py-6"
        style="min-height: 500px"
      >
        <div class="mb-4">
          <v-chip
            :color="isConnected ? 'success' : 'warning'"
            size="small"
            variant="flat"
          >
            {{ isConnected ? "WebSocket connected" : "Connecting..." }}
          </v-chip>
          <p
            v-if="errorMessage"
            class="text-error text-body-2 mt-3 mb-0"
          >
            {{ errorMessage }}
          </p>
        </div>

        <div
          v-if="notifications.length === 0"
          class="text-center text-grey py-8"
        >
          <p class="text-sm">
            No notifications yet
          </p>
        </div>

        <div v-else>
          <div
            v-for="(notification, index) in notifications"
            :key="index"
            class="mb-4 pb-4"
            :style="
              index < notifications.length - 1
                ? 'border-bottom: 1px solid #eee;'
                : ''
            "
          >
            <p class="text-sm ma-0">
              Order placed for {{ notification.payload.lensName }} by
              {{ notification.payload.customerName }}
            </p>
            <p class="text-xs text-grey-darken-1 mt-1">
              {{ notification.message }}
            </p>
            <p class="text-xs text-grey-darken-1 mt-1">
              {{ formatTime(notification.sentAt) }}
            </p>
          </div>
        </div>
      </v-card-text>

      <v-divider v-if="notifications.length > 0" />
      <v-card-actions v-if="notifications.length > 0">
        <v-spacer />
        <v-btn
          size="small"
          variant="text"
          @click="clearNotifications"
        >
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const notifications = ref([]);
const isConnected = ref(false);
const errorMessage = ref("");
let socket;

const notificationApiBase =
  import.meta.env.VITE_NOTIFICATION_API || "http://localhost:3003";
const notificationWsUrl =
  import.meta.env.VITE_NOTIFICATION_WS || "ws://localhost:3003/ws/notifications";

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clearNotifications() {
  notifications.value = [];
}

async function loadNotifications() {
  try {
    errorMessage.value = "";
    const response = await fetch(`${notificationApiBase}/api/notifications`);

    if (!response.ok) {
      throw new Error("Failed to load notifications");
    }

    notifications.value = await response.json();
  } catch (error) {
    errorMessage.value = error.message;
  }
}

function connectWebSocket() {
  socket = new WebSocket(notificationWsUrl);

  socket.addEventListener("open", () => {
    isConnected.value = true;
    errorMessage.value = "";
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "notification.created") {
      notifications.value.unshift(payload.notification);
    }
  });

  socket.addEventListener("close", () => {
    isConnected.value = false;
  });

  socket.addEventListener("error", () => {
    isConnected.value = false;
    errorMessage.value = "WebSocket connection failed";
  });
}

onMounted(async () => {
  await loadNotifications();
  connectWebSocket();
});

onBeforeUnmount(() => {
  socket?.close();
});
</script>
