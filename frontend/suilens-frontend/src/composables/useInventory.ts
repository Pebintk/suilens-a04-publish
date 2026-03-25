import { computed, unref, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

const API_BASE = import.meta.env.VITE_INVENTORY_API || "http://localhost:3004";

export interface Branch {
  code: string;
  name: string;
  city: string;
  address: string;
}

export interface BranchInventory extends Branch {
  lensId: string;
  branchCode: string;
  branchName: string;
  totalQuantity: number;
  availableQuantity: number;
}

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/branches`);
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLensInventory(lensId: MaybeRefOrGetter<string | null | undefined>) {
  const enabled = computed(() => Boolean(unref(lensId)));

  return useQuery<BranchInventory[]>({
    queryKey: computed(() => ["lens-inventory", unref(lensId)]),
    enabled,
    queryFn: async () => {
      const selectedLensId = unref(lensId);
      if (!selectedLensId) return [];

      const response = await fetch(
        `${API_BASE}/api/inventory/lenses/${selectedLensId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch lens inventory");
      return response.json();
    },
    staleTime: 1000 * 30,
  });
}
