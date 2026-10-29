import { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { banyraDestination, useWorkspaceNavigate } from '@/shared/hooks/useWorkspaceNavigate';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import type { Project } from '@/features/projects/api';
import type { WorkspaceId } from './workspaces';

const pages = {
  plans: lazy(() => import('@/features/plan-room/PlanRoomPage').then((m) => ({ default: m.PlanRoomPage }))),
  reserves: lazy(() => import('@/features/punchlist/PunchListPage').then((m) => ({ default: m.PunchListPage }))),
  planning: lazy(() => import('@/features/schedule/SchedulePage').then((m) => ({ default: m.SchedulePage }))),
  estimates: lazy(() => import('@/features/boq/BOQListPage').then((m) => ({ default: m.BOQListPage }))),
  model: lazy(() => import('@/features/bim/BIMPage').then((m) => ({ default: m.BIMPage }))),
  coordination: lazy(() => import('@/features/costmodel/CostModelPage').then((m) => ({ default: m.CostModelPage }))),
};
const BOQEditor = lazy(() => import('@/features/boq/BOQEditorPage').then((m) => ({ default: m.BOQEditorPage })));
const CreateBOQ = lazy(() => import('@/features/boq/CreateBOQPage').then((m) => ({ default: m.CreateBOQPage })));
const Files = lazy(() => import('@/features/file-manager/FileManagerPage').then((m) => ({ default: m.FileManagerPage })));
const CoordinationModel = lazy(() => import('@/features/bim/BIMPage').then((m) => ({ default: () => <m.BIMPage embedded /> })));

export function ErpWorkspace({ workspace, project }: { workspace: WorkspaceId; project: Project }) {
  const { boqId } = useParams<{ boqId?: string }>();
  const location = useLocation();
  const navigate = useWorkspaceNavigate();
  const [coordinationTab, setCoordinationTab] = useState<'model' | 'planning' | 'coordination'>('model');
  const activeProjectId = useProjectContextStore((s) => s.activeProjectId);
  useLayoutEffect(() => {
    useProjectContextStore.getState().setActiveProject(project.id, project.name);
  }, [project.id, project.name, activeProjectId]);
  const Page = workspace === 'estimates' && boqId ? BOQEditor : workspace === 'estimates' && location.pathname.endsWith('/new') ? CreateBOQ : workspace === 'plans' && location.pathname.endsWith('/files') ? Files : workspace === 'coordination' ? coordinationTab === 'model' ? CoordinationModel : pages[coordinationTab] : pages[workspace];
  // Mount only after context is synchronized: modules must never fetch a
  // previous project's data while a direct link is opening another project.
  if (activeProjectId !== project.id) return null;
  return <section className="cp-erp-workspace" aria-label="Espace métier du chantier" onClickCapture={(event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest('a[href]');
    const href = anchor?.getAttribute('href');
    if (!href || anchor?.getAttribute('target') === '_blank' || anchor?.hasAttribute('download')) return;
    const destination = banyraDestination(href, project.id);
    if (destination !== href) { event.preventDefault(); event.stopPropagation(); navigate(destination); }
  }}>
    {workspace === 'plans' && <div className="cp-workspace-tools" aria-label="Outils des plans">
      <button className="cp-button cp-secondary" onClick={() => navigate(`/pilot/plans/${project.id}`)}>Consulter les plans</button>
      <button className="cp-button cp-secondary" onClick={() => navigate(`/pilot/plans/${project.id}/files`)}>Documents et révisions</button>
    </div>}
    {workspace === 'coordination' && <>
      <p className="cp-workspace-hint">Sélectionnez des éléments de la maquette pour les associer aux activités du planning et aux postes du devis. Retrouvez ensuite leur suivi dans le planning 4D et l’analyse des coûts 5D.</p>
      <div className="cp-workspace-tools" aria-label="Outils de coordination">
        {([['model', 'Maquette et liens'], ['planning', 'Planning 4D'], ['coordination', 'Analyse des coûts 5D']] as const).map(([id, label]) => <button key={id} aria-pressed={coordinationTab === id} className={`cp-button ${coordinationTab === id ? 'cp-dark' : 'cp-secondary'}`} onClick={() => setCoordinationTab(id)}>{label}</button>)}
      </div>
    </>}
    <ErrorBoundary key={`${workspace}:${project.id}`}>
      <Suspense fallback={<div className="cp-loading"><Loader2 className="cp-spin" />Chargement de l’espace de travail…</div>}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  </section>;
}
