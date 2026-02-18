import { queryClient } from "./queryClient";

const BASE = "/api";

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message);
  }
  return res.json();
}

export const api = {
  createUser: (data: any) => fetchJson<any>("/users", { method: "POST", body: JSON.stringify(data) }),
  getUser: (id: string) => fetchJson<any>(`/users/${id}`),
  updateUser: (id: string, data: any) => fetchJson<any>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMessages: (userId: string) => fetchJson<any[]>(`/users/${userId}/messages`),
  sendMessage: (userId: string, text: string) =>
    fetchJson<{ userMessage: any; jaeMessage: any }>(`/users/${userId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getEntries: (userId: string) => fetchJson<any[]>(`/users/${userId}/entries`),
};
