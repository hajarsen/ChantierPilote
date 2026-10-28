import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/shared/lib/api';
import { csvCell, fieldKind, localDay, loadPortfolioTasks, loadTasks } from './api';

describe('Banyra exported records', () => {
  afterEach(() => vi.restoreAllMocks());
  it('never asks the project-scoped API for an unscoped task register', async () => {
    await expect(loadTasks('')).rejects.toThrow('A project is required');
    const requests: string[] = [];
    vi.spyOn(client, 'apiGet').mockImplementation(async (path) => {
      requests.push(path);
      const project = new URL(path, 'https://example.invalid').searchParams.get('project_id');
      return { items: [{ id: project, metadata: {} }], total: 1, offset: 0, limit: 100 };
    });
    const tasks = await loadPortfolioTasks(['site-a', 'site-b']);
    expect(tasks.map((task) => task.id)).toEqual(['site-a', 'site-b']);
    expect(requests.every((path) => path.includes('project_id='))).toBe(true);
  });
  it('includes records beyond the first API page in site totals', async () => {
    vi.spyOn(client, 'apiGet').mockImplementation(async (path) => {
      const offset = Number(new URL(path, 'https://example.invalid').searchParams.get('offset'));
      return { items: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) => ({ id: `${offset + i}` })), total: 101, offset, limit: 100 };
    });
    expect(await loadTasks('site-a')).toHaveLength(101);
  });
  it.each(['=HYPERLINK("https://example.org")', '+cmd', '-cmd', '@SUM(A1)', ' =1+1', '\t=1'])('neutralizes spreadsheet input %s', (input) => {
    expect(csvCell(input).startsWith('"\'')).toBe(true);
  });
  it('quotes separators, newlines and embedded quotation marks', () => {
    expect(csvCell('Béton; "contrôle"\nR+1')).toBe('"Béton; ""contrôle""\nR+1"');
  });
  it('keeps legacy ERP tasks in the coordination register', () => {
    expect(fieldKind({ metadata: {} })).toBe('actions');
    expect(fieldKind({ metadata: { cp_kind: 'safety' } })).toBe('safety');
    expect(fieldKind({ metadata: { cp_kind: 'quality' } })).toBe('quality');
  });
  it('uses the local calendar day for daily site reports', () => {
    expect(localDay(new Date(2026, 9, 28, 0, 1))).toBe('2026-10-28');
  });
});
