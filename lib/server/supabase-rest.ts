import "server-only";

type SupabaseRequestInit = RequestInit & {
  prefer?: string;
};

export class SupabaseConfigError extends Error {}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new SupabaseConfigError("Supabase environment variables are not configured.");
  }
  return { url, serviceRoleKey };
}

export async function supabaseRest<T>(path: string, init: SupabaseRequestInit = {}): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const { prefer, headers, ...requestInit } = init;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...requestInit,
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status = error instanceof SupabaseConfigError ? 503 : 400;
  return Response.json({ error: message }, { status });
}

export async function readRequestBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

export function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function numberOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function dateOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function timestampOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
