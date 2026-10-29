import { describe, expect, it } from 'vitest';
import { banyraDestination } from './useWorkspaceNavigate';

describe('Banyra workspace navigation', () => {
  it('keeps estimate editing and model selection inside the same project', () => {
    expect(banyraDestination('/boq/bill-1', 'site-1')).toBe('/pilot/estimates/site-1/edit/bill-1');
    expect(banyraDestination('/projects/site-2/bim/model-1', 'site-1')).toBe('/pilot/model/site-2/model-1');
    expect(banyraDestination('/projects/site-1/boq/new', 'site-1')).toBe('/pilot/estimates/site-1/new');
  });
  it('preserves deep-link parameters and leaves advanced destinations intact', () => {
    expect(banyraDestination('/schedule?activity=a#details', 'site-1')).toBe('/pilot/planning/site-1?activity=a#details');
    expect(banyraDestination('/bim/rules?tab=requirements', 'site-1')).toBe('/bim/rules?tab=requirements');
    expect(banyraDestination('https://example.org/file', 'site-1')).toBe('https://example.org/file');
  });
  it('scopes documents and revision management to the selected project', () => {
    expect(banyraDestination('/files', 'site-1')).toBe('/pilot/plans/site-1/files');
    expect(banyraDestination('/boq', '')).toBe('/boq');
  });
});
