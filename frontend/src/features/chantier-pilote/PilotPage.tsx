import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Building2, Check, CheckCircle2, ChevronDown, CircleDashed, ClipboardCheck,
  ClipboardList, HardHat, LayoutDashboard, Loader2, LogOut, Menu, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Wallet, Truck, X, MapPin, CalendarDays } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import type { Task, TaskStatus } from '@/features/tasks/api';
import { updateTask } from '@/features/tasks/api';
import type { Project } from '@/features/projects/api';
import { Brand } from './Brand';
import { csvCell, fieldKind, loadDiaries, loadTasks, loadPortfolioTasks, projectsApi, type FieldKind } from './api';
import { FieldDialog, type DialogMode } from './FieldDialog';
import { Commercial } from './Commercial';
import { ModelFeatures } from './ModelFeatures';
import { usePilotCopy } from './copy';
import './pilot.css';

const navigation = [
  { id: 'overview', icon: LayoutDashboard }, { id: 'projects', icon: Building2 },
  { id: 'actions', icon: ClipboardList }, { id: 'quality', icon: ClipboardCheck },
  { id: 'safety', icon: ShieldCheck }, { id: 'diary', icon: CalendarDays },
  { id: 'costs', icon: Wallet }, { id: 'purchases', icon: Truck },
];
const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-MA', { day: 'numeric', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export default function PilotPage() {
  const { t, i18n } = usePilotCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  const view = navigation.some((n) => n.id === location.pathname.split('/')[2]) ? location.pathname.split('/')[2]! : 'overview';
  const [projectId, setProjectId] = useState(() => {
    try { return sessionStorage.getItem(`banyra.project.${auth.userId}`) || ''; } catch { return ''; }
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const key = ['cp', auth.userId];
  const projects = useQuery({ queryKey: [...key, 'projects'], queryFn: projectsApi.list });
  const portfolioIds = (projects.data ?? []).map((p) => p.id);
  const tasks = useQuery({ queryKey: [...key, 'tasks', projectId, portfolioIds.join(',')], enabled: projects.isSuccess,
    queryFn: () => projectId ? loadTasks(projectId) : loadPortfolioTasks(portfolioIds) });
  const diaries = useQuery({ queryKey: [...key, 'diaries', projectId], queryFn: () => loadDiaries(projectId), enabled: !!projectId });
  const rows = tasks.data ?? [];
  const projectRows = projects.data ?? [];
  const needle = search.trim().toLocaleLowerCase('fr');
  const filteredProjects = projectRows.filter((p) => (!projectId || p.id === projectId) && `${p.name} ${p.address?.city ?? ''}`.toLocaleLowerCase('fr').includes(needle));
  const name = auth.userFullName || auth.userEmail?.split('@')[0] || t('workspace');
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  useEffect(() => {
    if (projects.isSuccess && projectId && !projects.data.some((p) => p.id === projectId)) setProjectId('');
    try { sessionStorage.setItem(`banyra.project.${auth.userId}`, projectId); } catch { /* Session storage is optional. */ }
  }, [auth.userId, projectId, projects.data, projects.isSuccess]);
  useEffect(() => {
    const project = projectRows.find((p) => p.id === projectId);
    if (project) useProjectContextStore.getState().setActiveProject(project.id, project.name);
  }, [projectId, projects.data]);
  useEffect(() => { document.title = `${t(view)} · Banyra`; if (i18n.language !== 'fr') void i18n.changeLanguage('fr'); }, [i18n, t, view]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { setSearch(''); setStatus('all'); setMenu(false); }, [view]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  const changeStatus = useMutation({
    mutationFn: ({ task, next }: { task: Task; next: TaskStatus }) => {
      if (!navigator.onLine) throw new Error('Offline');
      if (next === 'completed' && task.checklist.some((c) => !c.completed)) throw new Error('Checklist incomplete');
      return updateTask(task.id, { status: next });
    },
    onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: key }); setNotice(t(result?.id ? 'saved' : 'queued')); },
    onError: () => setNotice(t('saveError')),
  });
  const newRecord = () => setDialog(view === 'projects' || view === 'overview' ? 'project' : view === 'diary' ? 'diary' : view === 'quality' || view === 'safety' ? view : 'actions');
  function exportRows(items: Task[]) {
    const csv = '\ufeff' + [[t('title'), t('project'), t('status'), t('priority'), t('due'), t('responsible')], ...items.map((task) => [task.title, projectRows.find((p) => p.id === task.project_id)?.name, t(task.status), t(task.priority), task.due_date, task.assigned_to_name || task.metadata.assignee_name])].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `banyra-${view}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const matches = (task: Task) => `${task.title} ${task.description ?? ''} ${task.assigned_to_name ?? ''} ${task.metadata.assignee_name ?? ''}`.toLocaleLowerCase('fr').includes(needle);
  const filteredTasks = rows.filter((task) => fieldKind(task) === view && (status === 'all' || task.status === status) && matches(task));
  const open = rows.filter((task) => task.status !== 'completed');
  const checks = rows.filter((task) => fieldKind(task) !== 'actions');
  const overdue = open.filter((task) => task.is_overdue);
  const nextTasks = [...open].filter(matches).sort((a, b) => Number(b.is_overdue) - Number(a.is_overdue) || (a.due_date || '9999').localeCompare(b.due_date || '9999')).slice(0, 4);

  function projectCard(project: Project, index: number) {
    const count = open.filter((r) => r.project_id === project.id).length;
    return <button key={project.id} className="cp-project-card" onClick={() => { setProjectId(project.id); navigate('/pilot/actions'); }}>
      <div className={`cp-project-art cp-art-${index % 3}`} aria-hidden="true"><Building2 size={62} strokeWidth={.85} /><span>{project.name.slice(0, 2).toUpperCase()}</span><i /><i /><i /></div>
      <div className="cp-project-card-body"><span className="cp-pill cp-green">{t(['active', 'waiting', 'finished', 'archived'].includes(project.status) ? project.status : 'active')}</span>
        <h3>{project.name}</h3><p><MapPin size={13} />{project.address?.city || project.region || '—'}</p>
        <div className="cp-project-bottom"><span>{t('taskCount', { count })}</span><ArrowUpRight size={18} /></div>
      </div>
    </button>;
  }
  function taskRow(task: Task) {
    const complete = task.status === 'completed';
    const unchecked = task.checklist.some((c) => !c.completed);
    return <article className="cp-task-row" key={task.id}>
      <button className={`cp-task-check ${complete ? 'cp-done' : ''}`} aria-label={t(complete ? 'reopen' : 'finish')} disabled={changeStatus.isPending || !online || (!complete && unchecked)} title={!complete && unchecked ? t('checkBeforeClose') : undefined} onClick={() => changeStatus.mutate({ task, next: complete ? 'open' : 'completed' })}>{complete ? <Check size={15} /> : null}</button>
      <div className="cp-task-info"><button onClick={() => setDialog(task)}><h3>{task.title}</h3></button><p>{projectRows.find((p) => p.id === task.project_id)?.name}<span>·</span>{task.assigned_to_name || String(task.metadata.assignee_name || '') || t('unnamed')}</p>
        {task.checklist.length > 0 && <button className="cp-check-link" onClick={() => setDialog(task)}><ClipboardCheck size={13} />{t('progress', { done: task.checklist.filter((c) => c.completed).length, total: task.checklist.length })}</button>}
      </div>
      <span className={`cp-pill cp-priority-${task.priority}`}>{t(task.priority)}</span>
      <span className={`cp-task-date ${task.is_overdue ? 'cp-late' : ''}`}>{task.due_date ? dateLabel(task.due_date) : t('noDate')}</span>
      <select className="cp-status-select" aria-label={`${t('status')} : ${task.title}`} value={task.status} disabled={changeStatus.isPending || !online} onChange={(event) => changeStatus.mutate({ task, next: event.target.value as TaskStatus })}>
        {['draft', 'open', 'in_progress', 'completed'].map((s) => <option key={s} value={s} disabled={s === 'completed' && unchecked}>{t(s)}</option>)}
      </select>
    </article>;
  }
  function empty(title: string, sub: string, action?: () => void, label?: string) {
    return <div className="cp-empty"><span><CircleDashed size={30} /></span><h3>{t(title)}</h3><p>{t(sub)}</p>{action && <button className="cp-button cp-primary" onClick={action}><Plus size={16} />{t(label || 'newAction')}</button>}</div>;
  }
  function diaryList() {
    if (!projectId) return empty('chooseProject', 'diaryChoose');
    if (diaries.isPending) return <div className="cp-loading"><Loader2 className="cp-spin" />{t('loading')}</div>;
    if (diaries.isError) return <div className="cp-error" role="alert">{t('error')}<button onClick={() => void diaries.refetch()}>{t('retry')}</button></div>;
    if (!diaries.data?.length) return empty('noDiary', 'noDiarySub', () => setDialog('diary'), 'newDiary');
    return <div className="cp-diary-list">{diaries.data.map((diary) => <article key={diary.id}><div className="cp-diary-date"><CalendarDays size={20} /><strong>{dateLabel(diary.diary_date)}</strong></div><div><span className="cp-eyebrow">{t('report')}</span><p className="cp-diary-notes">{diary.notes || t('emptyNotes')}</p><div className="cp-diary-meta"><span>{t('people', { count: diary.labour_count })}</span><span>{t('machines', { count: diary.equipment_count })}</span></div></div></article>)}</div>;
  }
  return <div className="cp-app cp-shell">
    {menu && <button className="cp-menu-backdrop" aria-label={t('close')} onClick={() => setMenu(false)} />}
    <aside className={`cp-sidebar ${menu ? 'cp-menu-open' : ''}`}><Brand /><span className="cp-nav-label">{t('workspace')}</span>
      <nav aria-label={t('workspace')}>{navigation.map(({ id, icon: Icon }) => <NavLink key={id} to={id === 'overview' ? '/pilot' : `/pilot/${id}`} end={id === 'overview'} className={({ isActive }) => isActive ? 'cp-nav-active' : ''}><Icon size={19} /><span>{t(id)}</span>{id === 'actions' && open.length > 0 && <b>{open.length}</b>}</NavLink>)}</nav>
      <div className="cp-sidebar-bottom"><div className="cp-tip"><Sparkles size={21} /><h4>{t('helpTitle')}</h4><p>{t('helpText')}</p></div>
        <Link className="cp-erp-link" to="/projects">{t('erp')}<ArrowUpRight size={15} /></Link>
        <button className="cp-user" onClick={() => { auth.logout(); queryClient.removeQueries({ queryKey: ['cp'] }); navigate('/login'); }} title={t('logout')}><span className="cp-avatar">{initials}</span><span><strong>{name}</strong><small>{t('logout')}</small></span><LogOut size={17} /></button>
      </div>
    </aside>
    <div className="cp-main"><header className="cp-topbar"><div className="cp-breadcrumb"><button className="cp-icon-button cp-menu-toggle" aria-label={t('menu')} onClick={() => setMenu(true)}><Menu /></button><span>{t('workspace')}</span><span>/</span><strong>{t(view)}</strong></div>
      <div className="cp-topbar-right"><span className={`cp-online ${online ? '' : 'cp-offline'}`}><i />{t(online ? 'connected' : 'offline')}</span><span className="cp-avatar cp-avatar-small">{initials}</span></div>
    </header>
    <main className="cp-content"><div className="cp-page-heading"><div><span className="cp-eyebrow">BANYRA / {new Intl.DateTimeFormat('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' }).format(new Date())}</span><h1>{t(view)}</h1><p>{view === 'overview' ? t('onTime') : t(view === 'costs' ? 'commercialSub' : view === 'purchases' ? 'purchaseSub' : `pageSub.${view}`)}</p></div>
      {!['costs', 'purchases'].includes(view) && <button className="cp-button cp-primary" onClick={newRecord} disabled={!online}><Plus size={18} />{t(view === 'projects' || view === 'overview' ? 'newProject' : view === 'quality' ? 'newQuality' : view === 'safety' ? 'newSafety' : view === 'diary' ? 'newDiary' : 'newAction')}</button>}
    </div>
    <div className="cp-toolbar"><div className="cp-search"><Search size={17} /><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button aria-label={t('close')} onClick={() => setSearch('')}><X size={16} /></button>}</div>
      <div className="cp-project-picker"><Building2 size={16} /><select aria-label={t('project')} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">{t('allProjects')}</option>{projectRows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={14} /></div>
      <button className="cp-icon-button" aria-label={t('refresh')} onClick={() => void queryClient.invalidateQueries({ queryKey: key })}><RefreshCw size={17} /></button>
    </div>
    {notice && <div className="cp-notice" role="status"><CheckCircle2 size={18} />{notice}<button aria-label={t('close')} onClick={() => setNotice('')}><X size={16} /></button></div>}
    {!online && <p className="cp-error" role="status">{t('offline')}</p>}
    {projects.isError || tasks.isError ? <div className="cp-error" role="alert">{t('error')}<button onClick={() => void queryClient.invalidateQueries({ queryKey: key })}>{t('retry')}</button></div>
      : projects.isPending || tasks.isPending ? <div className="cp-loading"><Loader2 className="cp-spin" />{t('loading')}</div> : <>
      {view === 'overview' && <>
        <section className="cp-hero"><div><span className="cp-eyebrow"><span className="cp-tiny-dot" />{t('daily')}</span><h2>{t('hero')}</h2><p>{t('heroText')}</p><button className="cp-button cp-dark" onClick={() => setDialog('diary')}><ClipboardList size={17} />{t('newDiary')}<ArrowUpRight size={17} /></button></div><div className="cp-hero-photo"><img src="/chantier-pilote/terrain.jpg" alt={t('photoAlt')} /><div><HardHat size={24} /><span><strong>{t('fieldFirst')}</strong><small>{t('fieldCaption')}</small></span></div></div></section>
        <section className="cp-metrics">{[
          { label: 'activeProjects', value: projectRows.filter((p) => p.status === 'active').length, sub: 'portfolio', icon: Building2, path: 'projects' },
          { label: 'openActions', value: open.length, sub: 'selectedScope', icon: ClipboardList, path: 'actions' },
          { label: 'closedChecks', value: `${checks.filter((r) => r.status === 'completed').length}/${checks.length}`, sub: 'checkedScope', icon: ClipboardCheck, path: 'quality' },
          { label: 'overdue', value: overdue.length, sub: 'toWatch', icon: CalendarDays, path: 'actions' },
        ].map(({ label, value, sub, icon: Icon, path }) => <button className="cp-metric" key={label} onClick={() => navigate(`/pilot/${path}`)}><span>{t(label)}<Icon size={18} /></span><strong>{value}</strong><small>{t(sub)}</small></button>)}</section>
        <div className="cp-overview-grid"><section className="cp-panel cp-projects-panel"><div className="cp-section-heading"><div><h2>{t('myProjects')}</h2><p>{t('projectSub')}</p></div><Link to="/pilot/projects">{t('seeAll')}<ArrowRight size={15} /></Link></div>
          {filteredProjects.length ? <div className="cp-project-grid">{filteredProjects.slice(0, 3).map(projectCard)}</div> : empty(needle ? 'noResults' : 'noProjects', 'noProjectsSub', () => setDialog('project'), 'newProject')}
        </section><section className="cp-panel cp-priorities"><div className="cp-section-heading"><h2>{t('priorities')}</h2><span className="cp-pill">{open.length}</span></div>{nextTasks.length ? <div>{nextTasks.map((task) => <button key={task.id} className="cp-priority-item" onClick={() => setDialog(task)}><span className={`cp-priority-dot cp-priority-${task.priority}`} /><span><strong>{task.title}</strong><small>{task.due_date ? dateLabel(task.due_date) : t('noDate')} · {task.assigned_to_name || t('unnamed')}</small></span><ArrowUpRight size={16} /></button>)}</div> : empty('noActions', 'noActionsSub')}
          <button className="cp-text-button" onClick={() => setDialog('actions')}><Plus size={16} />{t('newAction')}</button>
        </section></div>
        <ModelFeatures />
        <section className="cp-panel"><div className="cp-section-heading"><div><h2>{t('focus')}</h2><p>{t('focusSub')}</p></div><Link to="/pilot/diary">{t('seeAll')}<ArrowRight size={15} /></Link></div>{diaryList()}</section>
      </>}
      {view === 'projects' && <section className="cp-project-grid cp-project-grid-full">{filteredProjects.length ? filteredProjects.map(projectCard) : empty(needle ? 'noResults' : 'noProjects', 'noProjectsSub', () => setDialog('project'), 'newProject')}</section>}
      {['actions', 'quality', 'safety'].includes(view) && <section className="cp-panel"><div className="cp-list-toolbar"><div className="cp-tabs">{['all', 'open', 'in_progress', 'completed'].map((s) => <button key={s} className={status === s ? 'cp-tab-active' : ''} onClick={() => setStatus(s)}>{t(s)}</button>)}</div><button className="cp-button cp-secondary" onClick={() => exportRows(filteredTasks)}><ArrowDownToLine size={16} />{t('export')}</button></div>
        {filteredTasks.length ? <div>{filteredTasks.map(taskRow)}</div> : empty(needle ? 'noResults' : view === 'quality' ? 'noQuality' : view === 'safety' ? 'noSafety' : 'noActions', view === 'quality' ? 'noQualitySub' : view === 'safety' ? 'noSafetySub' : 'noActionsSub', () => setDialog(view as FieldKind), view === 'quality' ? 'newQuality' : view === 'safety' ? 'newSafety' : 'newAction')}
      </section>}
      {view === 'diary' && <section className="cp-panel">{diaryList()}</section>}
      {(view === 'costs' || view === 'purchases') && <Commercial mode={view} project={projectRows.find((p) => p.id === projectId)} search={needle} onSaved={() => setNotice(t('saved'))} />}
    </>}
    <footer className="cp-page-footer"><span>banyra<span className="cp-brand-dot">.</span> {t('tagline')}</span><a href="https://github.com/datadrivenconstruction/openconstructionerp" target="_blank" rel="noreferrer">{t('foundation')}</a></footer>
    </main></div>
    {dialog && <FieldDialog key={typeof dialog === 'object' ? dialog.id : dialog} mode={dialog} projects={projectRows} selectedId={projectId} onClose={() => setDialog(null)} onSaved={() => setNotice(t('saved'))} />}
  </div>;
}
