import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Box,
  CalendarDays,
  ChevronRight,
  Eye,
  Focus,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { api, day, dateLabel, type Project } from "../api";
import { createViewer, type Viewer } from "./engine";
import {
  categoryLabel,
  dateNumber,
  type BimModel,
  type BimState,
  type ModelElement,
  type PlanningTask,
} from "./types";
import "./bim.css";

type Props = { project: Project; mode: "bim" | "planning" };
export default function BimPage({ project, mode }: Props) {
  const canWrite = project.role !== "viewer";
  const base = `/projects/${project.id}/bim`;
  const [data, setData] = useState<BimState>({ models: [], schedule: [] });
  const [modelId, setModelId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elements, setElements] = useState<ModelElement[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [isolate, setIsolate] = useState(false);
  const [simulation, setSimulation] = useState(false);
  const [date, setDate] = useState(day());
  const [filter, setFilter] = useState("");
  const [filename, setFilename] = useState("");
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<PlanningTask | "new" | null>(null);
  const [viewerStatus, setViewerStatus] = useState("");
  const [viewerReady, setViewerReady] = useState(false);
  const viewer = useRef<Viewer | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const onPick = useRef<(id: string, additive: boolean) => void>(() => {});
  const model = data.models.find((item) => item.id === modelId);
  const tasks = data.schedule.filter((task) => task.model_id === modelId);
  const rangeStart = data.schedule.length
    ? data.schedule.reduce(
        (min, task) => (task.start_date < min ? task.start_date : min),
        data.schedule[0].start_date,
      )
    : day();
  const rangeEnd = data.schedule.length
    ? data.schedule.reduce(
        (max, task) => (task.end_date > max ? task.end_date : max),
        data.schedule[0].end_date,
      )
    : day();
  const pick = (id: string, additive = false) =>
    setSelected((current) => {
      const next = additive ? new Set(current) : new Set<string>();
      if (additive && next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  onPick.current = pick;
  async function load(preferred?: string) {
    let next = await api<BimState>(base);
    if (!active.current) return;
    if (!next.models.length && project.is_demo && canWrite) {
      await api(`${base}/demo`, "POST");
      if (!active.current) return;
      next = await api<BimState>(base);
    }
    if (!active.current) return;
    setData(next);
    setModelId(
      (current) =>
        preferred ||
        (next.models.some((m) => m.id === current)
          ? current
          : next.models[0]?.id || ""),
    );
  }
  useEffect(() => {
    active.current = true;
    void load()
      .catch((e) => {
        if (active.current) setError(e.message);
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
    return () => {
      active.current = false;
    };
  }, [base]);
  async function mutate(
    operation: () => Promise<{ id?: string } | unknown>,
    preferred = false,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = (await operation()) as { id?: string };
      if (!active.current) return;
      await load(preferred ? result?.id : undefined);
      setEditor(null);
      setNotice("Enregistré dans le chantier.");
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    const container = viewport.current;
    if (!model || !container) return;
    const controller = new AbortController();
    let instance: Viewer | null = null;
    setViewerReady(false);
    setElements([]);
    setSelected(new Set());
    setProperties({});
    setIsolate(false);
    setViewerStatus("Lecture et préparation de la maquette…");
    void (async () => {
      const response = await fetch(`/api${base}/models/${model.id}/file`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "Impossible de charger la maquette. Vérifiez vos droits et votre connexion.",
        );
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      instance = await createViewer(
        container,
        bytes,
        model.format,
        (id, add) => onPick.current(id, add),
        controller.signal,
      );
      if (controller.signal.aborted) {
        instance.dispose();
        return;
      }
      viewer.current = instance;
      setElements(instance.elements);
      setCategories(new Set(instance.elements.map((e) => e.category)));
      setViewerStatus("");
      if (!model.catalog.length && canWrite) {
        await api(`${base}/models/${model.id}/catalog`, "POST", {
          elements: instance.elements,
        });
        if (!controller.signal.aborted) await load(model.id);
      }
      if (!controller.signal.aborted) setViewerReady(true);
    })().catch((e) => {
      if (!controller.signal.aborted)
        setViewerStatus(
          (e as Error).message || "La lecture de cette maquette a échoué.",
        );
    });
    return () => {
      controller.abort();
      instance?.dispose();
      viewer.current = null;
    };
  }, [modelId]);
  useEffect(() => {
    viewer.current?.display({
      selected,
      categories,
      isolate,
      simulation: mode === "planning" && simulation,
      date,
      tasks,
    });
  }, [
    selected,
    categories,
    isolate,
    simulation,
    date,
    data.schedule,
    viewerReady,
    mode,
  ]);
  useEffect(() => {
    let current = true;
    setProperties({});
    const id = [...selected][0];
    if (id)
      void viewer.current
        ?.properties(id)
        .then((values) => {
          if (current) setProperties(values);
        })
        .catch(() => {
          if (current)
            setProperties({
              Information: "Certaines propriétés IFC ne sont pas disponibles.",
            });
        });
    return () => {
      current = false;
    };
  }, [selected]);
  async function importModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File;
    if (file.size > 50 * 1024 * 1024) {
      setError("Maquette trop volumineuse (50 Mo maximum).");
      return;
    }
    await mutate(() => api(`${base}/models`, "POST", form), true);
  }
  const visible = elements.filter((element) =>
    `${element.name} ${categoryLabel(element.category)} ${element.id}`
      .toLocaleLowerCase("fr")
      .includes(filter.toLocaleLowerCase("fr")),
  );
  const grouped = [...new Set(elements.map((element) => element.category))];
  return (
    <div className="bim-workspace">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="loading">
          <LoaderCircle className="spin" />
          Chargement de l’espace BIM…
        </p>
      ) : (
        <>
          <section className="panel bim-intro">
            <div>
              <span className="eyebrow">
                {mode === "planning"
                  ? "BIM · COORDINATION · AVANCEMENT"
                  : "BIM · MAQUETTE · PROPRIÉTÉS"}
              </span>
              <h2>
                {mode === "planning"
                  ? "Le planning de votre chantier"
                  : "Votre bâtiment, sous tous les angles"}
              </h2>
              <p>
                {mode === "planning"
                  ? "Dates prévues, avancement réel et planning lié aux éléments de la maquette."
                  : "Maquettes privées du chantier · IFC / GLB · sélection et propriétés."}
              </p>
            </div>
            <div className="bim-intro-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void load().catch((e) => setError(e.message))}
              >
                <RefreshCw size={15} />
                {mode === "planning"
                  ? "Actualiser le planning"
                  : "Actualiser la maquette"}
              </button>
              {canWrite && (
                <div className="bim-intro-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(() => api(`${base}/demo`, "POST"), true)
                    }
                  >
                    <Box size={16} />
                    Maquette exemple R+2
                  </button>
                  {mode === "planning" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => setEditor("new")}
                    >
                      <Plus size={16} />
                      Ajouter une tâche au planning
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
          {mode === "planning" && (
            <section className="panel bim-planning">
              <div className="section-heading">
                <div>
                  <h2>Planning des travaux</h2>
                  <p>
                    Dates prévues, dépendances et avancement réel.{" "}
                    {data.schedule.length} tâche
                    {data.schedule.length > 1 ? "s" : ""} enregistrée
                    {data.schedule.length > 1 ? "s" : ""}.
                  </p>
                </div>
                {canWrite && (
                  <button
                    className="text-button"
                    onClick={() => setEditor("new")}
                  >
                    <Plus size={16} />
                    Nouvelle tâche
                  </button>
                )}
              </div>
              <Gantt tasks={data.schedule} edit={(task) => setEditor(task)} />
            </section>
          )}
          {canWrite && (
            <form className="bim-import" onSubmit={importModel}>
              <label className="field bim-file-picker">
                <span>Importer une maquette IFC ou GLB (50 Mo maximum)</span>
                <input
                  name="file"
                  type="file"
                  accept=".ifc,.glb"
                  required
                  disabled={busy}
                  aria-label="Fichier IFC ou GLB"
                  onChange={(event) =>
                    setFilename(event.target.files?.[0]?.name || "")
                  }
                />
                <span className="bim-file-label">
                  <b>Choisir un fichier</b>
                  <small>{filename || "Aucun fichier sélectionné"}</small>
                </span>
              </label>
              <label className="field">
                <span>Nom de la maquette</span>
                <input
                  name="name"
                  maxLength={160}
                  placeholder="Ex. Structure — révision B"
                  disabled={busy}
                />
              </label>
              <button className="button secondary" disabled={busy}>
                <Upload size={16} />
                {busy ? "Enregistrement…" : "Importer"}
              </button>
            </form>
          )}
          {!!data.models.length && (
            <div className="bim-model-toolbar">
              <label className="field">
                <span>Maquette du chantier</span>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  {data.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <small>
                {mode === "planning"
                  ? "Chaque import conserve son propre fichier et ses liaisons au planning."
                  : "Chaque import conserve sa propre maquette et ses propriétés."}
              </small>
            </div>
          )}
          {model ? (
            <section
              className={`bim-viewer-panel ${mode === "planning" ? "bim-secondary-view" : ""}`}
            >
              <div className="bim-viewer-toolbar">
                <div>
                  <Layers size={17} />
                  <strong>{elements.length} éléments</strong>
                  <span>
                    {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                  </span>
                </div>
                <div>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => viewer.current?.reset()}
                  >
                    <RotateCcw size={14} />
                    Recentrer
                  </button>
                  <button
                    className={`button ${isolate ? "" : "secondary"}`}
                    disabled={!selected.size}
                    onClick={() => setIsolate((v) => !v)}
                  >
                    <Eye size={14} />
                    {isolate ? "Tout afficher" : "Isoler"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={!selected.size}
                    onClick={() => {
                      setSelected(new Set());
                      setIsolate(false);
                    }}
                  >
                    Désélectionner
                  </button>
                </div>
              </div>
              <div className="bim-viewer-grid">
                <aside className="bim-tree">
                  <h3>Catégories</h3>
                  {grouped.map((category) => (
                    <label key={category}>
                      <input
                        type="checkbox"
                        checked={categories.has(category)}
                        onChange={(event) =>
                          setCategories((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(category);
                            else next.delete(category);
                            return next;
                          })
                        }
                      />
                      <span>{categoryLabel(category)}</span>
                      <small>
                        {elements.filter((e) => e.category === category).length}
                      </small>
                    </label>
                  ))}
                  <h3>Éléments de la maquette</h3>
                  <input
                    aria-label="Rechercher un élément BIM"
                    placeholder="Nom ou identifiant…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <div className="bim-element-list">
                    {visible.slice(0, 200).map((element) => (
                      <label
                        className={selected.has(element.id) ? "selected" : ""}
                        key={element.id}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${element.name}`}
                          checked={selected.has(element.id)}
                          onChange={() => pick(element.id, true)}
                        />
                        <span>
                          {element.name}
                          <small>
                            #{element.id} · {categoryLabel(element.category)}
                          </small>
                        </span>
                      </label>
                    ))}
                    {visible.length > 200 && (
                      <small>
                        Affichage des 200 premiers résultats. Précisez votre
                        recherche.
                      </small>
                    )}
                  </div>
                </aside>
                <div className="bim-stage">
                  <div className="bim-canvas" ref={viewport} />
                  {viewerStatus && (
                    <div className="bim-stage-message" role="status">
                      <Box size={25} />
                      <p>{viewerStatus}</p>
                    </div>
                  )}
                  <p className="bim-navigation">
                    Glisser : tourner · molette : zoomer · clic droit : déplacer
                    · clic : sélectionner
                  </p>
                </div>
                <aside className="bim-properties">
                  <h3>Propriétés</h3>
                  {selected.size ? (
                    <>
                      <button
                        className="text-button"
                        onClick={() => viewer.current?.focus([...selected][0])}
                      >
                        <Focus size={15} />
                        Cadrer l’élément
                      </button>
                      {Object.entries(properties).map(([key, value]) => (
                        <div key={key}>
                          <small>{key}</small>
                          <p>{value}</p>
                        </div>
                      ))}
                      {selected.size > 1 && (
                        <p className="form-note">
                          {selected.size} éléments sélectionnés. Propriétés du
                          premier élément.
                        </p>
                      )}
                      {canWrite && mode === "planning" && (
                        <button
                          className="button"
                          disabled={!viewerReady}
                          onClick={() => setEditor("new")}
                        >
                          <CalendarDays size={15} />
                          Lier au planning
                        </button>
                      )}
                    </>
                  ) : (
                    <p>
                      Cliquez sur la maquette ou cochez un élément pour
                      consulter ses propriétés.
                    </p>
                  )}
                </aside>
              </div>
              {mode === "planning" && (
                <div className="bim-simulation">
                  <label>
                    <input
                      type="checkbox"
                      checked={simulation}
                      onChange={(e) => setSimulation(e.target.checked)}
                    />
                    Simulation 4D du planning
                  </label>
                  <input
                    type="date"
                    aria-label="Date de simulation 4D"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                  />
                  <input
                    type="range"
                    aria-label="Parcourir le planning 4D"
                    min={dateNumber(rangeStart)}
                    max={Math.max(
                      dateNumber(rangeEnd),
                      dateNumber(rangeStart) + 1,
                    )}
                    value={Math.min(
                      Math.max(dateNumber(date), dateNumber(rangeStart)),
                      dateNumber(rangeEnd),
                    )}
                    onChange={(e) =>
                      setDate(
                        new Date(Number(e.target.value) * 86400000)
                          .toISOString()
                          .slice(0, 10),
                      )
                    }
                  />
                  <div className="bim-legend">
                    <span className="planned">À venir</span>
                    <span className="working">Prévu en cours</span>
                    <span className="finished">Prévu terminé</span>
                    <span className="unlinked">Non lié</span>
                  </div>
                  <small>
                    Simulation selon les dates prévues. L’avancement réel est
                    saisi dans le planning.
                  </small>
                </div>
              )}
            </section>
          ) : (
            <section className="panel bim-empty">
              <Box size={40} />
              <h3>Aucune maquette sur ce chantier</h3>
              <p>
                {canWrite
                  ? "Importez votre fichier IFC/GLB ou chargez le bâtiment exemple pour découvrir la maquette."
                  : "Un membre de l’équipe peut importer la maquette du chantier."}
              </p>
            </section>
          )}
        </>
      )}
      {mode === "planning" && editor && (
        <ScheduleEditor
          task={editor === "new" ? undefined : editor}
          data={data}
          model={model}
          selected={selected}
          canWrite={canWrite}
          busy={busy}
          error={error}
          close={() => setEditor(null)}
          save={(payload) =>
            mutate(() =>
              api(
                `${base}/schedule${editor === "new" ? "" : `/${editor.id}`}`,
                editor === "new" ? "POST" : "PUT",
                payload,
              ),
            )
          }
        />
      )}
    </div>
  );
}

function Gantt({
  tasks,
  edit,
}: {
  tasks: PlanningTask[];
  edit: (task: PlanningTask) => void;
}) {
  if (!tasks.length)
    return (
      <div className="bim-empty">
        <CalendarDays size={30} />
        <p>Ajoutez une tâche avec ses dates pour construire le planning.</p>
      </div>
    );
  const start = Math.min(...tasks.map((t) => dateNumber(t.start_date)));
  const end = Math.max(...tasks.map((t) => dateNumber(t.end_date))) + 1;
  const span = Math.max(end - start, 1);
  const ticks = Math.min(8, span);
  return (
    <div className="gantt-scroll">
      <div className="gantt">
        <div className="gantt-head">
          <strong>Lots et tâches</strong>
          <div>
            {Array.from({ length: ticks }, (_, index) => (
              <span key={index} style={{ left: `${(index / ticks) * 100}%` }}>
                {dateLabel(
                  new Date(
                    (start + Math.floor((index / ticks) * span)) * 86400000,
                  )
                    .toISOString()
                    .slice(0, 10),
                )}
              </span>
            ))}
          </div>
        </div>
        {tasks.map((task) => (
          <button
            className="gantt-row"
            key={task.id}
            onClick={() => edit(task)}
          >
            <div>
              <strong>{task.title}</strong>
              <small>
                {task.trade} · {task.responsible || "Responsable à préciser"}
              </small>
              <small>
                {dateLabel(task.start_date)} → {dateLabel(task.end_date)} ·{" "}
                {task.progress} % réel · {task.element_ids.length} élément
                {task.element_ids.length > 1 ? "s" : ""}
              </small>
              {!!task.predecessors.length && (
                <small>
                  Après :{" "}
                  {task.predecessors
                    .map(
                      (id) => tasks.find((t) => t.id === id)?.title || "Tâche",
                    )
                    .join(", ")}
                </small>
              )}
            </div>
            <div className="gantt-track">
              <span
                className="gantt-bar"
                style={{
                  left: `${((dateNumber(task.start_date) - start) / span) * 100}%`,
                  width: `${Math.max(((dateNumber(task.end_date) - dateNumber(task.start_date) + 1) / span) * 100, 0.5)}%`,
                }}
              >
                <i style={{ width: `${task.progress}%` }} />
                <b>{task.progress} %</b>
              </span>
            </div>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ScheduleEditor({
  task,
  data,
  model,
  selected,
  canWrite,
  busy,
  error,
  close,
  save,
}: {
  task?: PlanningTask;
  data: BimState;
  model?: BimModel;
  selected: Set<string>;
  canWrite: boolean;
  busy: boolean;
  error: string;
  close: () => void;
  save: (payload: unknown) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [linkedModel, setLinkedModel] = useState(
    task?.model_id || model?.id || "",
  );
  const [ids, setIds] = useState(new Set(task?.element_ids || [...selected]));
  const [predecessors, setPredecessors] = useState(
    new Set(task?.predecessors || []),
  );
  const currentModel = data.models.find((item) => item.id === linkedModel);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await save({
      ...values,
      progress: Number(values.progress),
      model_id: linkedModel || null,
      element_ids: [...ids],
      predecessors: [...predecessors],
      ...(task ? { version: task.version } : {}),
    });
  }
  return (
    <dialog
      ref={ref}
      className="schedule-dialog"
      aria-labelledby="schedule-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2 id="schedule-title">
          {task ? "Tâche du planning" : "Nouvelle tâche du planning"}
        </h2>
        <button
          className="icon-button"
          aria-label="Fermer la fenêtre planning"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <form onSubmit={submit}>
        <fieldset disabled={!canWrite || busy} className="schedule-fields">
          <div className="form-grid">
            <label className="field wide">
              <span>Intitulé de la tâche</span>
              <input
                name="title"
                required
                minLength={2}
                maxLength={200}
                defaultValue={task?.title || ""}
              />
            </label>
            <label className="field">
              <span>Corps d’état du planning</span>
              <input
                name="trade"
                maxLength={100}
                defaultValue={task?.trade || "Gros œuvre"}
              />
            </label>
            <label className="field">
              <span>Responsable du planning</span>
              <input
                name="responsible"
                maxLength={160}
                defaultValue={task?.responsible || ""}
              />
            </label>
            <label className="field">
              <span>Début prévu</span>
              <input
                type="date"
                name="start_date"
                required
                defaultValue={task?.start_date || day()}
              />
            </label>
            <label className="field">
              <span>Fin prévue</span>
              <input
                type="date"
                name="end_date"
                required
                defaultValue={task?.end_date || day()}
              />
            </label>
            <label className="field">
              <span>Avancement réel (%)</span>
              <input
                name="progress"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={task?.progress || 0}
              />
            </label>
            <label className="field">
              <span>Maquette liée</span>
              <select
                value={linkedModel}
                onChange={(event) => {
                  setLinkedModel(event.target.value);
                  setIds(new Set());
                }}
              >
                <option value="">Sans maquette</option>
                {data.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Notes du planning</span>
              <textarea
                name="notes"
                rows={2}
                maxLength={4000}
                defaultValue={task?.notes || ""}
              />
            </label>
          </div>
          <fieldset className="checklist">
            <legend>Éléments 3D liés ({ids.size})</legend>
            {currentModel?.catalog.length ? (
              <div className="schedule-element-choices">
                {currentModel.catalog.map((element) => (
                  <label key={element.id}>
                    <input
                      type="checkbox"
                      checked={ids.has(element.id)}
                      onChange={(event) =>
                        setIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(element.id);
                          else next.delete(element.id);
                          return next;
                        })
                      }
                    />
                    <span>
                      {element.name} · #{element.id}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="form-note">
                Ouvrez la maquette pour indexer ses éléments avant de les lier.
              </p>
            )}
          </fieldset>
          <fieldset className="checklist">
            <legend>Prédécesseurs — démarrage après leur fin</legend>
            {data.schedule
              .filter((item) => item.id !== task?.id)
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={predecessors.has(item.id)}
                    onChange={(event) =>
                      setPredecessors((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    {item.title} · fin {dateLabel(item.end_date)}
                  </span>
                </label>
              ))}
          </fieldset>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Fermer
          </button>
          {canWrite && (
            <button className="button" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer la tâche"}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
