import { api } from "./client";
import type { Strategy } from "@/types/strategy";

export async function fetchStrategies(): Promise<Strategy[]> {
  const res = await api.get<{ strategies: Strategy[] }>("/strategies");
  return res.strategies;
}

export async function createStrategy(data: {
  name: string;
  description?: string;
  config: Record<string, unknown>;
  category?: string;
}): Promise<Strategy> {
  return api.post<Strategy>("/strategies", data);
}

export async function updateStrategy(
  id: number,
  data: { name?: string; description?: string; config?: Record<string, unknown> }
): Promise<Strategy> {
  return api.put<Strategy>(`/strategies/${id}`, data);
}

export async function deleteStrategy(id: number): Promise<void> {
  await api.delete(`/strategies/${id}`);
}
