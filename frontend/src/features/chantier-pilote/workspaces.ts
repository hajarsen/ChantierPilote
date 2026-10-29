import { Box, CalendarDays, ClipboardCheck, Files, Layers3, Ruler } from 'lucide-react';

export const workspaces = [
  { id: 'plans', icon: Files, label: 'Plans & documents', description: 'Consultez les plans, annotez les documents et retrouvez les révisions du chantier.' },
  { id: 'reserves', icon: ClipboardCheck, label: 'Réserves & photos', description: 'Signalez les défauts, joignez des photos et suivez les corrections avec un responsable et une échéance.' },
  { id: 'planning', icon: CalendarDays, label: 'Planning & avancement', description: 'Organisez les activités, les dépendances et les dates pour suivre l’avancement du chantier.' },
  { id: 'estimates', icon: Ruler, label: 'Devis & métrés', description: 'Créez les devis, renseignez les quantités et suivez les prix dans la devise du chantier.' },
  { id: 'model', icon: Box, label: 'Maquette 3D', description: 'Ouvrez les modèles, sélectionnez les éléments et consultez leurs propriétés et quantités.' },
  { id: 'coordination', icon: Layers3, label: 'Liaisons 4D / 5D', description: 'Reliez les éléments au planning et aux lignes du devis, puis analysez les coûts du chantier.' },
] as const;

export type WorkspaceId = typeof workspaces[number]['id'];
export const isWorkspace = (id: string): id is WorkspaceId => workspaces.some((item) => item.id === id);
export const workspacePath = (id: WorkspaceId, projectId: string) => `/pilot/${id}${projectId ? `/${encodeURIComponent(projectId)}` : ''}`;
