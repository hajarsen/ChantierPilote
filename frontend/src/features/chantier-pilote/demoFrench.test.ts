import { describe, expect, it } from 'vitest';
import type { Project } from '@/features/projects/api';
import type { Task } from '@/features/tasks/api';
import { frenchDemoProject, frenchDemoTask } from './demoFrench';

const projectFixture = (values: Partial<Project>): Project => ({
  id: 'project', name: '', description: '', region: '', classification_standard: '',
  currency: 'MAD', locale: 'fr', validation_rule_sets: [], status: 'active', owner_id: 'owner',
  metadata: {}, created_at: '', updated_at: '', ...values,
});
const taskFixture = (values: Partial<Task>): Task => ({
  id: 'task', project_id: 'project', title: '', description: null, task_type: 'task',
  status: 'open', priority: 'normal', responsible_id: null, assigned_to: null,
  assigned_to_name: null, due_date: null, checklist: [], checklist_progress: 0,
  created_by: null, meeting_id: null, metadata: {}, created_at: '', updated_at: '',
  completed_at: null, is_overdue: false, ...values,
});

describe('French demo presentation', () => {
  it('localizes seeded actions without changing their stored record', () => {
    const task = taskFixture({ title: 'Mobilise site and establish welfare facilities (Baugrube / Erdbau)', description: 'Original', metadata: { demo_id: 'retail' } });
    expect(frenchDemoTask(task).title).toBe('Installer le chantier et la base vie');
    expect(frenchDemoTask(task).description).toBe('Original');
    expect(task.description).toBe('Original');
    expect(task.title).toContain('Mobilise');
  });
  it('translates a seeded description while retaining technical requirements', () => {
    const task = taskFixture({ title: 'Cold storage insulation system',
      description: 'Select insulated panel system for -25C cold storage zone', metadata: { demo_id: 'warehouse-dubai' } });
    expect(frenchDemoTask(task).description).toContain('−25 °C');
  });
  it('preserves user-authored records even when they match a demo label', () => {
    const task = taskFixture({ title: 'Mobilise site and establish welfare facilities' });
    expect(frenchDemoTask(task)).toBe(task);
    const project = projectFixture({ name: 'Lebensmittelmarkt Karlsruhe' });
    expect(frenchDemoProject(project)).toBe(project);
  });
  it('localizes international demo project names and preserves location', () => {
    const project = projectFixture({ name: 'Lebensmittelmarkt Karlsruhe', metadata: { demo_id: 'retail' } });
    expect(frenchDemoProject(project).name).toBe('Supermarché Karlsruhe');
  });
});
