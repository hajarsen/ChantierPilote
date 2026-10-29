import type { Project } from '@/features/projects/api';
import type { Task } from '@/features/tasks/api';

// Presentation only: never rewrite stored project data or user-authored tasks.
const titles: Record<string, string> = {
  'Baugrundgutachten beauftragen': 'Commander l’étude géotechnique des fondations',
  'Spundwandverbau Statik prüfen': 'Vérifier le calcul du soutènement en palplanches',
  'WDVS Systemauswahl': 'Choisir le système d’isolation thermique extérieure',
  'KfW 55 Fördermittel Antrag': 'Préparer la demande de subvention énergétique KfW 55',
  'Tiefgarage Entrauchung abstimmen': 'Coordonner le désenfumage du parking souterrain',
  'Aufzugsangebot vergleichen': 'Comparer les offres pour les ascenseurs',
  'Mieterbeirat Farbkonzept': 'Présenter les couleurs de façade au conseil des locataires',
  'Appoint curtain wall specialist': 'Désigner l’entreprise spécialisée en façades-rideaux',
  'Core strategy - steel vs concrete': 'Choisir la structure du noyau : acier ou béton',
  'BREEAM credit review meeting': 'Examiner les crédits de certification BREEAM',
  'Section 106 obligations': 'Examiner les obligations d’urbanisme de la section 106',
  'Commission site investigation': 'Commander les reconnaissances géotechniques du sous-sol',
  'Coordinate server room cooling': 'Coordonner le refroidissement de la salle des serveurs',
  'Medical equipment list freeze': 'Valider la liste définitive des équipements médicaux',
  'MRI suite location': 'Définir l’emplacement de la salle IRM',
  'ICRA plan approval': 'Faire approuver le plan de prévention des risques infectieux',
  'Emergency department flow analysis': 'Analyser les flux du service des urgences',
  'Backup power load calculations': 'Vérifier le dimensionnement de l’alimentation de secours',
  'Radiation shielding review': 'Vérifier les protections contre les rayonnements',
  'Nurse call system vendor': 'Choisir le fournisseur du système d’appel infirmier',
  'Diagnostic amiante avant demolition': 'Commander le diagnostic amiante avant démolition',
  'Structure bois CLT vs beton': 'Choisir la structure : bois CLT ou béton armé',
  'Reunion mairie - planning site': 'Organiser la réunion de planification avec la mairie',
  'Appel offres cuisine collective': 'Préparer l’appel d’offres de la cuisine collective',
  'Etude acoustique gymnase': 'Réaliser l’étude acoustique du gymnase',
  'Photovoltaique dimensionnement': 'Dimensionner l’installation photovoltaïque',
  'JAFZA NOC application': 'Déposer la demande de certificat de non-objection JAFZA',
  'Cold storage insulation system': 'Choisir l’isolation de la zone de stockage frigorifique',
  'Summer work schedule': 'Adapter les horaires de travail pendant l’été',
  'Fire protection system design': 'Coordonner les études de protection incendie',
  'Steel structure shop drawings': 'Valider les plans de fabrication de la charpente métallique',
  'Dock leveller procurement': 'Commander les niveleurs et abris de quai',
  'Mobilise site and establish welfare facilities': 'Installer le chantier et la base vie',
  'Confirm building permit / authority approvals': 'Confirmer le permis de construire et les autorisations',
  'Issue procurement schedule for long-lead items': 'Planifier les achats à long délai de livraison',
  'Set up document control and CDE structure': 'Organiser la gestion documentaire et l’espace de partage',
  'Baseline programme review with main contractor': 'Valider le planning de référence avec l’entreprise générale',
  'Health & safety induction plan': 'Préparer l’accueil sécurité des équipes',
  'Quality control plan and inspection hold-points': 'Définir les contrôles qualité et les points d’arrêt',
  'Coordinate temporary works design': 'Coordonner les études des ouvrages provisoires',
  'Submit insurance and bonds to client': 'Transmettre les assurances et garanties au maître d’ouvrage',
  'Agree progress claim / valuation cycle': 'Fixer le calendrier des situations de travaux',
};

const originalDescriptions: Record<string, string> = {
  "Baugrundgutachten beauftragen": "Commission geotechnical survey for foundation design",
  "Spundwandverbau Statik prüfen": "Review sheet pile wall structural calculations with engineer",
  "WDVS Systemauswahl": "Choose between Sanverth ThermFix Classic vs Odenau Granulat",
  "KfW 55 Fördermittel Antrag": "Prepare KfW subsidy application for energy-efficient building",
  "Tiefgarage Entrauchung abstimmen": "Coordinate underground parking smoke extraction with fire authority",
  "Aufzugsangebot vergleichen": "Compare lift offers from Ascentia, Verticore, and Hebwerk Nord",
  "Mieterbeirat Farbkonzept": "Present facade color concept to tenant advisory board",
  "Appoint curtain wall specialist": "Final interview and appointment of unitised curtain wall contractor",
  "Core strategy - steel vs concrete": "Finalise core construction methodology",
  "BREEAM credit review meeting": "Review achievable BREEAM credits with sustainability consultant",
  "Section 106 obligations": "Review planning obligations and public realm contributions",
  "Commission site investigation": "Arrange ground investigation for basement design",
  "Coordinate server room cooling": "Liaise with tenant IT team on server room cooling requirements",
  "Medical equipment list freeze": "Obtain frozen equipment list from radiology, surgery, and ED departments",
  "MRI suite location": "Decide between ground floor vs basement for 3T MRI suite",
  "ICRA plan approval": "Submit Infection Control Risk Assessment to hospital board for approval",
  "Emergency department flow analysis": "Review patient and ambulance flow simulation with clinical staff",
  "Backup power load calculations": "Verify emergency generator sizing for all critical systems",
  "Radiation shielding review": "Coordinate radiation physicist review of CT and fluoroscopy room shielding",
  "Nurse call system vendor": "Select nurse call system between Hill-Rom, Rauland, and TekTone",
  "Diagnostic amiante avant demolition": "Commission pre-demolition asbestos survey for existing structures",
  "Structure bois CLT vs beton": "Final decision on CLT timber vs reinforced concrete for superstructure",
  "Reunion mairie - planning site": "Meeting with Mairie to discuss construction phase site logistics",
  "Appel offres cuisine collective": "Prepare tender documents for commercial kitchen equipment",
  "Etude acoustique gymnase": "Acoustic study for gymnasium - ensure NRA compliance",
  "Photovoltaique dimensionnement": "Size rooftop PV array for 120 kWc target",
  "JAFZA NOC application": "Submit No Objection Certificate application to JAFZA authority",
  "Cold storage insulation system": "Select insulated panel system for -25C cold storage zone",
  "Summer work schedule": "Plan reduced outdoor hours June-August per UAE labor law",
  "Fire protection system design": "Coordinate ESFR sprinkler design with Dubai Civil Defence requirements",
  "Steel structure shop drawings": "Review and approve portal frame shop drawings from fabricator",
  "Dock leveller procurement": "Procure 10 dock levellers and 2 cold storage dock shelters"
};

const descriptions: Record<string, string> = {
  'Baugrundgutachten beauftragen': 'Commander une étude géotechnique pour le dimensionnement des fondations.',
  'Spundwandverbau Statik prüfen': 'Examiner les calculs du soutènement en palplanches avec l’ingénieur.',
  'WDVS Systemauswahl': 'Choisir entre Sanverth ThermFix Classic et Odenau Granulat.',
  'KfW 55 Fördermittel Antrag': 'Préparer la demande de subvention KfW pour un bâtiment économe en énergie.',
  'Tiefgarage Entrauchung abstimmen': 'Coordonner le désenfumage du parking souterrain avec les services incendie.',
  'Aufzugsangebot vergleichen': 'Comparer les offres d’Ascentia, Verticore et Hebwerk Nord.',
  'Mieterbeirat Farbkonzept': 'Présenter les couleurs de façade au conseil des locataires.',
  'Appoint curtain wall specialist': 'Finaliser l’entretien et désigner l’entreprise de façades-rideaux préfabriquées.',
  'Core strategy - steel vs concrete': 'Arrêter la méthode de construction du noyau.',
  'BREEAM credit review meeting': 'Examiner les crédits BREEAM accessibles avec le consultant en développement durable.',
  'Section 106 obligations': 'Examiner les obligations d’urbanisme et les contributions aux espaces publics.',
  'Commission site investigation': 'Organiser les reconnaissances de sol pour la conception du sous-sol.',
  'Coordinate server room cooling': 'Confirmer les besoins de refroidissement avec l’équipe informatique du locataire.',
  'Medical equipment list freeze': 'Obtenir la liste définitive des équipements de radiologie, chirurgie et urgences.',
  'MRI suite location': 'Choisir entre le rez-de-chaussée et le sous-sol pour la salle IRM 3 T.',
  'ICRA plan approval': 'Soumettre l’évaluation des risques infectieux à l’approbation de la direction de l’hôpital.',
  'Emergency department flow analysis': 'Examiner la simulation des flux de patients et d’ambulances avec les équipes cliniques.',
  'Backup power load calculations': 'Vérifier le dimensionnement du groupe électrogène pour tous les systèmes critiques.',
  'Radiation shielding review': 'Faire vérifier les protections des salles de scanner et de fluoroscopie par un physicien médical.',
  'Nurse call system vendor': 'Choisir le système d’appel infirmier entre Hill-Rom, Rauland et TekTone.',
  'Diagnostic amiante avant demolition': 'Commander le diagnostic amiante avant démolition des structures existantes.',
  'Structure bois CLT vs beton': 'Arrêter le choix entre bois CLT et béton armé pour la superstructure.',
  'Reunion mairie - planning site': 'Rencontrer la mairie pour discuter de la logistique pendant les travaux.',
  'Appel offres cuisine collective': 'Préparer le dossier de consultation des équipements de cuisine professionnelle.',
  'Etude acoustique gymnase': 'Réaliser l’étude acoustique du gymnase et vérifier la conformité à la NRA.',
  'Photovoltaique dimensionnement': 'Dimensionner les panneaux en toiture pour un objectif de 120 kWc.',
  'JAFZA NOC application': 'Soumettre la demande de certificat de non-objection à l’autorité JAFZA.',
  'Cold storage insulation system': 'Choisir les panneaux isolants de la zone frigorifique à −25 °C.',
  'Summer work schedule': 'Prévoir des horaires extérieurs réduits de juin à août conformément au droit du travail des Émirats arabes unis.',
  'Fire protection system design': 'Coordonner les sprinkleurs ESFR avec les exigences de la protection civile de Dubaï.',
  'Steel structure shop drawings': 'Examiner et approuver les plans de fabrication des portiques métalliques.',
  'Dock leveller procurement': 'Commander 10 niveleurs de quai et 2 abris de quai pour le stockage frigorifique.',
};

export function frenchDemoProject(project: Project): Project {
  if (!project.metadata?.demo_id) return project;
  const name = project.name
    .replace('Residential House - Reference Build', 'Maison individuelle — projet de référence')
    .replace('Lebensmittelmarkt', 'Supermarché')
    .replace('Bürogebäude Frankfurt Europaviertel', 'Immeuble de bureaux — Francfort Europaviertel')
    .replace('Condominium Tower - Toronto, King West', 'Tour résidentielle — Toronto, King West')
    .replace('Government Office Complex - New Delhi (CPWD)', 'Bureaux administratifs — New Delhi (CPWD)')
    .replace('Edifício Residencial Jardins - São Paulo', 'Résidence Jardins — São Paulo')
    .replace('商务办公楼 - 上海陆家嘴 (Office Tower, Shanghai Lujiazui)', 'Tour de bureaux — Shanghai Lujiazui')
    .replace('Wohnanlage Berlin-Mitte', 'Résidence Berlin-Mitte')
    .replace('Downtown Medical Center', 'Centre médical du centre-ville')
    .replace('Logistics Hub Jebel Ali', 'Plateforme logistique de Jebel Ali');
  return { ...project, name };
}

export function frenchDemoTask(task: Task): Task {
  if (!task.metadata?.demo_id || task.metadata?.source === 'chantier-pilote') return task;
  // Generated demo tasks append an international trade name in parentheses.
  // The action label stands alone in Banyra; the original trade remains in ERP.
  const base = task.title.replace(/ \(.*\)$/, '');
  const title = titles[base];
  if (!title) return task;
  const description = originalDescriptions[base] === task.description
    ? descriptions[base]
    : task.description?.startsWith(`${task.title} for `) ? `${title}.` : task.description;
  return { ...task, title, description: description ?? task.description };
}
