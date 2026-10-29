import { useCallback } from 'react';
import { useLocation, useNavigate, useParams, type NavigateFunction, type NavigateOptions, type To } from 'react-router-dom';

/** Keep shared domain tools inside the product surface they were opened from. */
export function banyraDestination(to: string, projectId: string): string {
  if (!projectId || !to.startsWith('/')) return to;
  const boundary = to.search(/[?#]/);
  const path = boundary < 0 ? to : to.slice(0, boundary);
  const suffix = boundary < 0 ? '' : to.slice(boundary);
  const root = `/pilot`;
  const scoped = (module: string, id = projectId) => `${root}/${module}/${id}`;
  let target = path;
  const projectBoq = path?.match(/^\/projects\/([^/]+)\/boq(\/new)?$/);
  const projectBim = path?.match(/^\/projects\/([^/]+)\/bim(?:\/([^/]+))?$/);
  if (projectBoq) target = scoped('estimates', projectBoq[1]) + (projectBoq[2] ? '/new' : '');
  else if (projectBim) target = scoped('model', projectBim[1]) + (projectBim[2] ? `/${projectBim[2]}` : '');
  else if (path?.match(/^\/boq\/[^/]+$/)) target = `${scoped('estimates')}/edit/${path.split('/')[2]}`;
  else if (path?.match(/^\/bim\/[^/]+$/) && !['rules', 'federations', 'quantity-rules'].includes(path.split('/')[2]!)) target = `${scoped('model')}/${path.split('/')[2]}`;
  else if (path === '/boq') target = scoped('estimates');
  else if (path === '/bim') target = scoped('model');
  else if (path === '/schedule') target = scoped('planning');
  else if (path === '/5d') target = scoped('coordination');
  else if (path === '/punchlist' || path === '/punch-list') target = scoped('reserves');
  else if (path === '/plan-room') target = scoped('plans');
  else if (path === '/files' || path === '/documents' || path === `/projects/${projectId}/files`) target = `${scoped('plans')}/files`;
  else if (path === '/projects' || path === `/projects/${projectId}`) target = '/pilot/projects';
  return target + suffix;
}

export function useWorkspaceNavigate(): NavigateFunction {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { projectId = '' } = useParams<{ projectId?: string }>();
  return useCallback(((to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') return navigate(to);
    return navigate(typeof to === 'string' && pathname.startsWith('/pilot/') ? banyraDestination(to, projectId) : to, options);
  }) as NavigateFunction, [navigate, pathname, projectId]);
}
