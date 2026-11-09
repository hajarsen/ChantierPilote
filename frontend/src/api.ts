export type Account = { id: string; name: string; email: string };
export type Project = {
  id: string;
  name: string;
  reference: string;
  city: string;
  client: string;
  budget: string;
  vat: string;
  start_date: string;
  role: "owner" | "member" | "viewer";
};
export type Check = { label: string; done: boolean };
export type Task = {
  id: string;
  title: string;
  description: string;
  kind: "action" | "reserve" | "quality" | "safety";
  trade: string;
  assignee_id: string | null;
  due_date: string;
  priority: string;
  status: string;
  checks: Check[];
  version: number;
};
export type Entry = {
  id: string;
  kind: string;
  data: Record<string, string | number>;
  version: number;
  created_at: string;
};
export type Document = {
  id: string;
  task_id: string | null;
  name: string;
  label: string;
  revision: string;
  mime: string;
  size: number;
  created_at: string;
};
export type Member = Account & { role: string };
export type Workspace = {
  project: Project;
  tasks: Task[];
  entries: Entry[];
  members: Member[];
  files: Document[];
  events: { description: string; name: string; created_at: string }[];
  spent: string;
  remaining: string;
};

let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const multipart = data instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data && !multipart ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    body: data ? (multipart ? data : JSON.stringify(data)) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof body.detail === "string"
        ? body.detail
        : "La requête a échoué. Réessayez.",
    );
  return body as T;
}
export const money = (value: string | number) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value),
  );
export const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium" }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : "Sans échéance";
