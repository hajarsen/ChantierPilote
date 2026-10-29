import { apiGet, apiPost, type Page } from '@/shared/lib/api';
import { fetchAllPages } from '@/shared/lib/apiHelpers';
import { projectsApi as upstreamProjectsApi } from '@/features/projects/api';
import { frenchDemoProject, frenchDemoTask } from './demoFrench';
import type { Task, TaskPriority } from '@/features/tasks/api';
import type { DailyDiary } from '@/features/daily-diary/api';

export type FieldKind = 'actions' | 'quality' | 'safety';
export const fieldKind = (task: Pick<Task, 'metadata'>): FieldKind =>
  task.metadata?.cp_kind === 'quality' || task.metadata?.cp_kind === 'safety'
    ? task.metadata.cp_kind : 'actions';

export async function loadTasks(projectId: string) {
  if (!projectId) throw new Error('A project is required by the task register');
  const result = await fetchAllPages<Task>((offset, limit) => apiGet<Page<Task>>(
    `/v1/tasks/?offset=${offset}&limit=${limit}${projectId ? `&project_id=${encodeURIComponent(projectId)}` : ''}`,
  ));
  if (result.truncated) throw new Error('Task register exceeded the safe read limit');
  return result.items.map(frenchDemoTask);
}

export async function loadPortfolioTasks(projectIds: string[]) {
  const tasks: Task[] = [];
  // The ERP task endpoint is project-scoped. Bound concurrency rather than
  // calling it without a project or substituting only the current user's tasks.
  for (let i = 0; i < projectIds.length; i += 4) {
    const pages = await Promise.all(projectIds.slice(i, i + 4).map(loadTasks));
    tasks.push(...pages.flat());
  }
  return tasks;
}

export async function loadDiaries(projectId: string) {
  const result = await fetchAllPages<DailyDiary>((offset, limit) => apiGet<Page<DailyDiary>>(
    `/v1/daily-diary/diaries/?project_id=${encodeURIComponent(projectId)}&offset=${offset}&limit=${limit}`,
  ));
  if (result.truncated) throw new Error('Diary register exceeded the safe read limit');
  return result.items.sort((a, b) => b.diary_date.localeCompare(a.diary_date));
}

export function addFieldTask(data: {
  project_id: string; title: string; description: string; priority: TaskPriority;
  due_date?: string; kind: FieldKind; assignee: string; checks: string[];
}) {
  const { kind, assignee, checks, ...payload } = data;
  return apiPost<Task>('/v1/tasks/', {
    ...payload, task_type: 'task', status: 'open',
    metadata: { cp_kind: kind, assignee_name: assignee, source: 'chantier-pilote' },
    checklist: checks.map((text) => ({ id: crypto.randomUUID(), text, completed: false })),
  });
}

export const projectsApi = {
  ...upstreamProjectsApi,
  list: async () => (await upstreamProjectsApi.list()).map(frenchDemoProject),
};

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Neutralize spreadsheet formulas in user-provided values before CSV export.
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
