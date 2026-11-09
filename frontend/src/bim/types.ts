export type ModelElement = { id: string; name: string; category: string };
export type BimModel = {
  id: string;
  name: string;
  filename: string;
  format: "ifc" | "glb";
  size: number;
  catalog: ModelElement[];
};
export type PlanningTask = {
  id: string;
  title: string;
  trade: string;
  responsible: string;
  start_date: string;
  end_date: string;
  progress: number;
  model_id: string | null;
  element_ids: string[];
  predecessors: string[];
  notes: string;
  version: number;
};
export type BimState = { models: BimModel[]; schedule: PlanningTask[] };
export const categoryLabel = (name: string) =>
  ({
    IFCWALL: "Murs",
    IFCWALLSTANDARDCASE: "Murs",
    IFCSLAB: "Dalles",
    IFCCOLUMN: "Poteaux",
    IFCBEAM: "Poutres",
    IFCDOOR: "Portes",
    IFCWINDOW: "Fenêtres",
    IFCSTAIR: "Escaliers",
    IFCSTAIRFLIGHT: "Volées d’escalier",
    IFCFOOTING: "Semelles de fondation",
    IFCRAILING: "Garde-corps",
    IFCFURNISHINGELEMENT: "Mobilier et équipements",
    IFCCOVERING: "Revêtements",
    IFCMEMBER: "Éléments structurels",
    IFCRAMP: "Rampes",
    IFCRAMPFLIGHT: "Volées de rampe",
    IFCPLATE: "Plaques",
    IFCPILE: "Pieux",
    IFCROOF: "Toitures",
    IFCBUILDINGELEMENTPROXY: "Autres éléments",
    MESH: "Objets 3D",
  })[name.toUpperCase()] || name.replace(/^IFC/i, "");
export const dateNumber = (value: string) =>
  Date.parse(`${value}T00:00:00Z`) / 86400000;
export const simulationState = (task: PlanningTask, date: string) =>
  date < task.start_date
    ? "planned"
    : date > task.end_date
      ? "finished"
      : "working";
