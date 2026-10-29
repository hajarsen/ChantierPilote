const features = [
  ['Visualiseur 3D', 'Tourner autour du bâtiment, sélectionner un élément, masquer des catégories et consulter ses propriétés.'],
  ['Plans 2D', 'Consulter les PDF/DXF, annoter et mesurer après calibration de l’échelle.'],
  ['Réserves sur la maquette', 'Cliquer sur un mur, ajouter une photo, décrire un défaut et affecter une action avec échéance.'],
  ['Métrés et coûts 5D', 'Relier les quantités des éléments aux lignes du devis et aux coûts en MAD.'],
  ['Gestion des versions', 'Retrouver le bon plan et identifier les changements entre deux révisions.'],
  ['Avancement 4D', 'Relier les éléments au planning et visualiser les travaux prévus, commencés ou terminés.'],
];

export function ModelFeatures() {
  return <section className="cp-panel" aria-labelledby="cp-model-features-title">
    <div className="cp-section-heading"><h2 id="cp-model-features-title">Maquette numérique et plans</h2></div>
    <div className="cp-table-scroll">
      <table className="cp-table cp-model-features">
        <thead><tr><th scope="col">Fonctionnalité</th><th scope="col">Utilité concrète</th></tr></thead>
        <tbody>{features.map(([name, description]) => <tr key={name}>
          <th scope="row">{name}</th><td>{description}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
