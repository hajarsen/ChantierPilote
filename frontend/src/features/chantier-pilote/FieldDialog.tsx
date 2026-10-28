import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import type { Project } from '@/features/projects/api';
import type { Task, TaskPriority } from '@/features/tasks/api';
import { updateTask } from '@/features/tasks/api';
import { createDiary, listDiaries, updateDiary } from '@/features/daily-diary/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { addFieldTask, localDay, projectsApi, type FieldKind } from './api';
import { usePilotCopy } from './copy';

export type DialogMode = 'project' | 'diary' | FieldKind | Task;

export function FieldDialog({ mode, projects, selectedId, onClose, onSaved }: {
  mode: DialogMode; projects: Project[]; selectedId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t } = usePilotCopy();
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const [projectId, setProjectId] = useState(typeof mode === 'object' ? mode.project_id : selectedId || projects[0]?.id || '');
  const [day, setDay] = useState(localDay());
  const [notes, setNotes] = useState('');
  const [labour, setLabour] = useState(0);
  const [equipment, setEquipment] = useState(0);
  const [checks, setChecks] = useState(typeof mode === 'object' ? mode.checklist : []);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState(false);
  const diary = useQuery({
    queryKey: ['cp', userId, 'diary-entry', projectId, day], enabled: mode === 'diary' && !!projectId,
    queryFn: () => listDiaries({ project_id: projectId, date_from: day, date_to: day, limit: 100 }),
  });
  const existing = diary.data?.items[0];
  useEffect(() => {
    if (mode !== 'diary') return;
    setNotes(existing?.notes ?? ''); setLabour(existing?.labour_count ?? 0); setEquipment(existing?.equipment_count ?? 0);
  }, [existing, mode]);
  useEffect(() => { ref.current?.showModal(); }, []);
  const locked = mode === 'diary' && existing && existing.status !== 'open';
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (!navigator.onLine) throw new Error('Offline');
      if (mode === 'project') {
        const country = String(form.get('country') || '').trim().toUpperCase();
        return projectsApi.create({ name: String(form.get('title')).trim(), description: String(form.get('description') || ''),
          locale: 'fr', currency: String(form.get('currency') || 'MAD').toUpperCase(),
          ...(country ? { country_code: country } : {}), address: { city: String(form.get('city') || ''), country } });
      }
      if (mode === 'diary') {
        if (locked || diary.isPending || diary.isError) throw new Error('Diary not editable');
        const data = { notes, labour_count: labour, equipment_count: equipment };
        return existing ? updateDiary(existing.id, data, existing.version) : createDiary({ ...data, project_id: projectId, diary_date: day, client_op_id: crypto.randomUUID() });
      }
      if (typeof mode === 'object') return updateTask(mode.id, { checklist: checks });
      const template = mode === 'quality' || mode === 'safety' ? [1, 2, 3, 4].map((n) => t(`${mode}${n}`)) : [];
      return addFieldTask({ project_id: projectId, title: String(form.get('title')).trim(), description: String(form.get('description') || ''),
        priority: String(form.get('priority') || 'normal') as TaskPriority, kind: mode, assignee: String(form.get('assignee') || ''),
        ...(form.get('due') ? { due_date: String(form.get('due')) } : {}), checks: template });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['cp', userId] });
      // The shared ERP client queues failed-network writes. Do not claim a
      // server confirmation when that client returns no persisted record.
      if (!result?.id) { setQueued(true); return; }
      onSaved(); onClose();
    },
    onError: () => setError(t('saveError')),
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); save.mutate(new FormData(event.currentTarget)); }
  const heading = typeof mode === 'object' ? t('detail') : t(({ project: 'newProject', diary: 'newDiary', actions: 'newAction', quality: 'newQuality', safety: 'newSafety' })[mode]);
  function field(label: string, child: ReactNode) { return <label className="cp-field">{label}{child}</label>; }

  return <dialog className="cp-dialog cp-app" ref={ref} onCancel={(event) => { if (save.isPending) event.preventDefault(); else onClose(); }} aria-labelledby="cp-dialog-title">
    <header><div><span className="cp-eyebrow">BANYRA / TERRAIN</span><h2 id="cp-dialog-title">{heading}</h2></div><button className="cp-icon-button" disabled={save.isPending} onClick={onClose} aria-label={t('close')}><X size={21} /></button></header>
    <form onSubmit={submit}>
      {typeof mode === 'object' ? <>
        <h3>{mode.title}</h3><p className="cp-muted">{mode.description}</p>
        <div className="cp-checklist">{checks.map((check, i) => <label key={check.id || i}><input type="checkbox" checked={check.completed} onChange={(e) => setChecks((prev) => prev.map((item, index) => index === i ? { ...item, completed: e.target.checked } : item))} />{check.text}</label>)}</div>
        <p className="cp-muted">{t('progress', { done: checks.filter((c) => c.completed).length, total: checks.length })}</p>
      </> : <>
        {mode !== 'project' && field(t('project'), <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required><option value="" disabled>{t('chooseProject')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
        {mode === 'diary' ? <>
          <p className="cp-form-hint">{t('diaryHint')}</p>
          {field(t('date'), <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />)}
          {diary.isPending && <p role="status">{t('loading')}</p>}
          {diary.isError && <p className="cp-error" role="alert">{t('error')}</p>}
          {locked && <p className="cp-error" role="alert">{t('reportLocked')}</p>}
          {field(t('notes'), <textarea rows={5} maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} disabled={!!locked} />)}
          <div className="cp-form-grid">{field(t('labour'), <input type="number" min={0} max={100000} required value={labour} onChange={(e) => setLabour(Number(e.target.value))} disabled={!!locked} />)}
            {field(t('equipment'), <input type="number" min={0} max={100000} required value={equipment} onChange={(e) => setEquipment(Number(e.target.value))} disabled={!!locked} />)}</div>
        </> : <>
          {field(t(mode === 'project' ? 'projectName' : 'title'), <input name="title" required maxLength={500} placeholder={t(mode === 'project' ? 'projectPlaceholder' : 'titlePlaceholder')} />)}
          {mode === 'project' ? <div className="cp-form-grid">
            {field(t('city'), <input name="city" maxLength={150} placeholder={t('cityPlaceholder')} />)}
            {field(t('country'), <input name="country" pattern="[A-Za-z]{2}" maxLength={2} defaultValue="MA" />)}
            {field(t('currency'), <input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue="MAD" />)}
          </div> : <>
            <div className="cp-form-grid">{field(t('due'), <input type="date" name="due" />)}
              {field(t('priority'), <select name="priority" defaultValue={mode === 'safety' ? 'high' : 'normal'}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{t(p)}</option>)}</select>)}</div>
            {field(t('responsible'), <input name="assignee" maxLength={150} />)}
            {mode !== 'actions' && <p className="cp-form-hint"><Check size={17} />{t('templateHint')}</p>}
          </>}
          {field(t('description'), <textarea rows={3} name="description" maxLength={5000} />)}
        </>}
      </>}
      {error && <p className="cp-error" role="alert">{error}</p>}
      {queued && <p className="cp-form-hint" role="status">{t('queued')}</p>}
      <footer><button type="button" className="cp-button cp-secondary" disabled={save.isPending} onClick={onClose}>{t('cancel')}</button><button className="cp-button cp-primary" disabled={save.isPending || queued || !!locked || (mode === 'diary' && (diary.isPending || diary.isError))}>{save.isPending ? <Loader2 size={17} className="cp-spin" /> : <Check size={17} />}{t(save.isPending ? 'saving' : 'save')}</button></footer>
    </form>
  </dialog>;
}
