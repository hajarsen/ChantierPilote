import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { workspaces, workspacePath } from './workspaces';

export function ModelFeatures({ projectId = '' }: { projectId?: string }) {
  return <section className="cp-panel" aria-labelledby="cp-model-features-title">
    <div className="cp-section-heading"><div><h2 id="cp-model-features-title">Maquette numérique et plans</h2><p>Les outils de votre chantier, du plan à l’avancement.</p></div></div>
    <div className="cp-table-scroll">
      <table className="cp-table cp-model-features">
        <thead><tr><th scope="col">Fonctionnalité</th><th scope="col">Utilité concrète</th></tr></thead>
        <tbody>{workspaces.map(({ id, label, description }) => <tr key={id}>
          <th scope="row"><Link to={workspacePath(id, projectId)}>{label}<ArrowUpRight size={14} aria-hidden="true" /></Link></th><td>{description}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
