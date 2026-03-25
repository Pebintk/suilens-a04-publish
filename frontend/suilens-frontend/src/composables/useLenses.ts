import { useQuery } from '@tanstack/vue-query';

const API_BASE = import.meta.env.VITE_CATALOG_API || 'http://localhost:3001';

export interface Lens {
  id: string;
  modelName: string;
  manufacturerName: string;
  minFocalLength: number;
  maxFocalLength: number;
  maxAperture: string;
  mountType: string;
  dayPrice: string;
  weekendPrice: string;
  description: string;
}

export function useLenses() {
  return useQuery<Lens[]>({
    queryKey: ['lenses'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/lenses`);
      if (!response.ok) throw new Error('Failed to fetch lenses');
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}
