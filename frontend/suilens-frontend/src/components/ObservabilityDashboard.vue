<template>
  <v-app>
    <v-main>
      <v-container class="py-6">
        <v-row class="mb-4">
          <v-col cols="12">
            <h1 class="text-h4 mb-2">
              SuiLens Dashboard
            </h1>
            <p class="text-body-1 text-medium-emphasis">
              Browse lenses, check branch inventory, create orders, and monitor live notifications.
            </p>
          </v-col>
        </v-row>

        <v-row class="mb-4">
          <v-col
            cols="12"
            md="4"
          >
            <v-card>
              <v-card-text>
                <div class="text-h5">
                  {{ lenses.length }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Lenses
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col
            cols="12"
            md="4"
          >
            <v-card>
              <v-card-text>
                <div class="text-h5">
                  {{ selectedInventory.length }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Branches for selected lens
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col
            cols="12"
            md="4"
          >
            <v-card>
              <v-card-text>
                <div class="text-h5">
                  {{ liveNotifications.length }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Notifications
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mb-4">
          <v-col cols="12">
            <v-card>
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Live Notifications</span>
                <v-chip
                  size="small"
                  :color="isConnected ? 'success' : 'warning'"
                >
                  {{ isConnected ? "Connected" : "Connecting" }}
                </v-chip>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <v-alert
                  v-if="socketError"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ socketError }}
                </v-alert>
                <div
                  v-if="liveNotifications.length === 0"
                  class="text-medium-emphasis"
                >
                  No notifications yet.
                </div>
                <v-list
                  v-else
                  lines="three"
                >
                  <v-list-item
                    v-for="notification in liveNotifications"
                    :key="notification.id"
                  >
                    <v-list-item-title>
                      {{ notification.payload.lensName }} booked by
                      {{ notification.payload.customerName }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ notification.message }}
                    </v-list-item-subtitle>
                    <template #append>
                      <span class="text-caption text-medium-emphasis">
                        {{ formatTime(notification.sentAt) }}
                      </span>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col
            cols="12"
            lg="8"
          >
            <v-card class="mb-4">
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Lens Catalog</span>
                <v-chip size="small">
                  {{ lenses.length }} items
                </v-chip>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <v-alert
                  v-if="lensesError"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ lensesError }}
                </v-alert>
                <v-skeleton-loader
                  v-if="lensesLoading"
                  type="table-row@4"
                />
                <v-table
                  v-else
                  density="comfortable"
                >
                  <thead>
                    <tr>
                      <th>Lens</th>
                      <th>Mount</th>
                      <th>Price/day</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="lens in lenses"
                      :key="lens.id"
                      :class="{ 'bg-grey-lighten-4': lens.id === selectedLensId }"
                    >
                      <td>
                        <div>{{ lens.modelName }}</div>
                        <div class="text-caption text-medium-emphasis">
                          {{ lens.manufacturerName }}
                        </div>
                      </td>
                      <td>{{ lens.mountType }}</td>
                      <td>{{ formatCurrency(lens.dayPrice) }}</td>
                      <td class="text-right">
                        <v-btn
                          size="small"
                          variant="text"
                          @click="selectLens(lens.id)"
                        >
                          Select
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <v-card>
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Branch Inventory</span>
                <v-chip size="small">
                  {{ selectedLensLabel }}
                </v-chip>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <v-alert
                  v-if="inventoryError"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ inventoryError }}
                </v-alert>
                <v-skeleton-loader
                  v-if="inventoryLoading"
                  type="table-row@3"
                />
                <div v-else>
                  <v-table density="comfortable">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>Stock</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in selectedInventory"
                        :key="row.branchCode"
                        :class="{ 'bg-grey-lighten-4': row.branchCode === selectedBranchCode }"
                      >
                        <td>
                          <div>{{ row.branchName }}</div>
                          <div class="text-caption text-medium-emphasis">
                            {{ row.city }}
                          </div>
                        </td>
                        <td>{{ row.availableQuantity }} / {{ row.totalQuantity }}</td>
                        <td>
                          <v-chip
                            size="small"
                            :color="row.availableQuantity > 0 ? 'success' : 'error'"
                          >
                            {{ row.availableQuantity > 0 ? "Available" : "Out of stock" }}
                          </v-chip>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col
            cols="12"
            lg="4"
          >
            <v-card class="mb-4 fill-height">
              <v-card-title>Create Order</v-card-title>
              <v-divider />
              <v-card-text>
                <v-alert
                  v-if="orderError"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ orderError }}
                </v-alert>
                <v-alert
                  v-if="orderSuccessMessage"
                  type="success"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ orderSuccessMessage }}
                </v-alert>

                <v-form @submit.prevent="submitOrder">
                  <v-text-field
                    v-model="form.customerName"
                    label="Customer name"
                    variant="outlined"
                    class="mb-3"
                    required
                  />
                  <v-text-field
                    v-model="form.customerEmail"
                    label="Customer email"
                    type="email"
                    variant="outlined"
                    class="mb-3"
                    required
                  />
                  <v-select
                    v-model="selectedLensId"
                    :items="lensOptions"
                    item-title="title"
                    item-value="value"
                    label="Lens"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                  <v-select
                    v-model="selectedBranchCode"
                    :items="branchOptions"
                    item-title="title"
                    item-value="value"
                    label="Branch"
                    variant="outlined"
                    class="mb-3"
                    hide-details
                  />
                  <v-row>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="form.startDate"
                        label="Start date"
                        type="date"
                        variant="outlined"
                        required
                      />
                    </v-col>
                    <v-col
                      cols="12"
                      sm="6"
                    >
                      <v-text-field
                        v-model="form.endDate"
                        label="End date"
                        type="date"
                        variant="outlined"
                        required
                      />
                    </v-col>
                  </v-row>

                  <v-list
                    density="compact"
                    class="mb-4"
                  >
                    <v-list-item>
                      <v-list-item-title>Selected lens</v-list-item-title>
                      <template #append>
                        <span>{{ selectedLens?.modelName || "Choose a lens" }}</span>
                      </template>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Selected branch</v-list-item-title>
                      <template #append>
                        <span>{{ selectedBranchLabel }}</span>
                      </template>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Estimated total</v-list-item-title>
                      <template #append>
                        <strong>{{ estimatedTotalLabel }}</strong>
                      </template>
                    </v-list-item>
                  </v-list>

                  <v-btn
                    type="submit"
                    color="primary"
                    block
                    :loading="createOrderPending"
                    :disabled="createOrderDisabled"
                  >
                    Create order
                  </v-btn>
                </v-form>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useCreateOrder } from "@/composables/useOrders";
import { useLenses } from "@/composables/useLenses";
import { useLensInventory } from "@/composables/useInventory";
import { useNotifications } from "@/composables/useNotifications";

const { data: lensData, isLoading: lensesLoading, error: lensesErrorValue } = useLenses();
const selectedLensId = ref("");
const { data: inventoryData, isLoading: inventoryLoading, error: inventoryErrorValue } =
  useLensInventory(selectedLensId);
const { mutateAsync, isPending: createOrderPending } = useCreateOrder();
const { liveNotifications, isConnected, socketError, refreshNotifications } =
  useNotifications();

const form = reactive({
  customerName: "Observability Tester",
  customerEmail: "observer@example.com",
  startDate: "",
  endDate: "",
});

const selectedBranchCode = ref("");
const orderError = ref("");
const orderSuccessMessage = ref("");

const lenses = computed(() => lensData.value ?? []);
const selectedLens = computed(() => lenses.value.find((lens) => lens.id === selectedLensId.value));
const selectedInventory = computed(() => inventoryData.value ?? []);

const lensOptions = computed(() =>
  lenses.value.map((lens) => ({
    title: `${lens.modelName} - ${lens.manufacturerName}`,
    value: lens.id,
  })),
);

const branchOptions = computed(() =>
  selectedInventory.value.map((row) => ({
    title: `${row.branchName} (${row.availableQuantity}/${row.totalQuantity})`,
    value: row.branchCode,
    disabled: row.availableQuantity <= 0,
  })),
);

const selectedLensLabel = computed(() =>
  selectedLens.value ? selectedLens.value.modelName : "No lens selected",
);

const selectedBranchLabel = computed(() => {
  const branch = selectedInventory.value.find(
    (item) => item.branchCode === selectedBranchCode.value,
  );
  if (!branch) return "Choose a branch";
  return `${branch.branchName} - ${branch.availableQuantity} available`;
});

const estimatedDays = computed(() => {
  if (!form.startDate || !form.endDate) return 0;
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
});

const estimatedTotalLabel = computed(() => {
  if (!selectedLens.value || estimatedDays.value <= 0) return "Pending";
  const total = estimatedDays.value * Number(selectedLens.value.dayPrice);
  return formatCurrency(String(total));
});

const createOrderDisabled = computed(() => {
  return (
    createOrderPending.value ||
    !selectedLensId.value ||
    !selectedBranchCode.value ||
    !selectedBranchHasStock.value ||
    !form.customerName ||
    !form.customerEmail ||
    !form.startDate ||
    !form.endDate
  );
});

const selectedBranchHasStock = computed(() => {
  if (!selectedBranchCode.value) return false;
  return (
    selectedInventory.value.find((item) => item.branchCode === selectedBranchCode.value)
      ?.availableQuantity ?? 0
  ) > 0;
});

const lensesError = computed(() => lensesErrorValue.value?.message || "");
const inventoryError = computed(() => inventoryErrorValue.value?.message || "");

watch(
  () => lenses.value,
  (items) => {
    if (!selectedLensId.value && items.length > 0) {
      selectedLensId.value = items[0].id;
    }
  },
  { immediate: true },
);

watch(
  () => selectedInventory.value,
  (rows) => {
    if (!rows.length) return;
    const current = rows.find((row) => row.branchCode === selectedBranchCode.value);
    if (!current || current.availableQuantity <= 0) {
      const fallback = rows.find((row) => row.availableQuantity > 0);
      selectedBranchCode.value = fallback?.branchCode || rows[0].branchCode;
    }
  },
  { immediate: true },
);

function selectLens(lensId: string) {
  selectedLensId.value = lensId;
}

async function submitOrder() {
  orderError.value = "";
  orderSuccessMessage.value = "";

  if (estimatedDays.value <= 0) {
    orderError.value = "End date must be after start date.";
    return;
  }

  try {
    const created = await mutateAsync({
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      lensId: selectedLensId.value,
      branchCode: selectedBranchCode.value,
      startDate: form.startDate,
      endDate: form.endDate,
    });

    await refreshNotifications();
    orderSuccessMessage.value = `Order ${created.id} created successfully.`;
  } catch (error) {
    orderError.value = error instanceof Error ? error.message : "Failed to create order";
  }
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCurrency(value: string) {
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
}
</script>
