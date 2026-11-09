import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  Handshake,
  HardHat,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  day,
  dateLabel,
  money,
  setCsrf,
  type Account,
  type Document,
  type Entry,
  type Project,
  type Task,
  type Workspace,
} from "./api";
import "./style.css";

const nav = [
  ["overview", "Vue d’ensemble", LayoutDashboard],
  ["tasks", "Actions & réserves", ClipboardList],
  ["quality", "Qualité & sécurité", ShieldCheck],
  ["diary", "Journal de chantier", CalendarDays],
  ["budget", "Budget & dépenses", Wallet],
  ["contracts", "Marchés & situations", Handshake],
  ["supplies", "Approvisionnements", Truck],
  ["meetings", "Réunions", MessageSquare],
  ["documents", "Plans & documents", FolderOpen],
  ["team", "Équipe du chantier", Users],
] as const;
const kindLabel: Record<string, string> = {
  action: "Action",
  reserve: "Réserve",
  quality: "Qualité",
  safety: "Sécurité",
  open: "À faire",
  doing: "En cours",
  done: "Terminé",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
  draft: "Brouillon",
  approved: "Validée",
  paid: "Réglée",
  ordered: "Commandé",
  received: "Réceptionné",
  cancelled: "Annulé",
  owner: "Responsable",
  member: "Collaborateur",
  viewer: "Consultation",
};
const entryNames: Record<string, string> = {
  diary: "Journal de chantier",
  expense: "Dépense",
  contract: "Marché",
  valuation: "Situation de travaux",
  supply: "Approvisionnement",
  meeting: "Compte rendu de réunion",
};
const trades = [
  "Général",
  "Gros œuvre",
  "Étanchéité",
  "Électricité",
  "Plomberie",
  "CVC",
  "Menuiserie",
  "Finitions",
  "VRD",
];
const moroccanCities = [
  "Agadir",
  "Béni Mellal",
  "Berrechid",
  "Casablanca",
  "Dakhla",
  "El Jadida",
  "Errachidia",
  "Essaouira",
  "Fès",
  "Kénitra",
  "Khouribga",
  "Laâyoune",
  "Marrakech",
  "Meknès",
  "Mohammédia",
  "Nador",
  "Oujda",
  "Rabat",
  "Safi",
  "Salé",
  "Settat",
  "Tanger",
  "Tétouan",
];
const defaultChecks = [
  "Plans et documents applicables vérifiés",
  "Matériaux et mise en œuvre contrôlés",
  "Dimensions et finitions conformes",
  "Écarts et actions correctives consignés",
];
const safetyChecks = [
  "Accès et circulations dégagés",
  "Protections collectives en place",
  "Équipements de protection vérifiés",
  "Risques partagés avec l’équipe",
];

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        banyra<span className="brand-dot">.</span>
        <small>Le terrain, en confiance.</small>
      </span>
    </span>
  );
}
function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <label className={wide ? "field wide" : "field"}>
      <span id={id}>{label}</span>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        typeof child.type === "string" &&
        ["input", "textarea", "select"].includes(child.type)
          ? React.cloneElement(
              child as React.ReactElement<{ "aria-labelledby"?: string }>,
              { "aria-labelledby": id },
            )
          : child,
      )}
    </label>
  );
}
function Empty({
  title,
  text,
  onClick,
  button = "Ajouter",
}: {
  title: string;
  text: string;
  onClick?: () => void;
  button?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Building2 size={28} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {onClick && (
        <button className="button" onClick={onClick}>
          <Plus size={16} />
          {button}
        </button>
      )}
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value}`}>{kindLabel[value] ?? value}</span>
  );
}

function Modal({
  title,
  children,
  close,
  busy = false,
  large = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
  large?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("input,select,textarea,button")
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && !busy) close();
    if (event.key !== "Tab") return;
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
      ) ?? [],
    );
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
      event.preventDefault();
      items[0]?.focus();
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${large ? "modal-large" : ""}`}
        onKeyDown={keyDown}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Fermer la fenêtre"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Auth({
  onSession,
  invitation,
}: {
  onSession: (user: Account, csrf: string) => void;
  invitation: boolean;
}) {
  const [register, setRegister] = useState(location.pathname === "/register");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ user: Account; csrf: string }>(
        `/auth/${register ? "register" : "login"}`,
        "POST",
        data,
      );
      onSession(result.user, result.csrf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">BÂTIR. COORDONNER. AVANCER.</span>
          <h1>
            Votre chantier.
            <br />
            Toute l’équipe.
            <br />
            <em>Un même cap.</em>
          </h1>
          <p>
            Du bureau au terrain, retrouvez vos actions, vos documents et vos
            décisions dans votre espace Banyra.
          </p>
          <div className="auth-points">
            <span>
              <CheckCircle2 size={17} />
              Des responsabilités claires
            </span>
            <span>
              <CheckCircle2 size={17} />
              Vos coûts suivis en dirhams
            </span>
            <span>
              <CheckCircle2 size={17} />
              Une équipe qui avance ensemble
            </span>
          </div>
        </div>
        <small>Conçu pour le quotidien des chantiers au Maroc.</small>
      </section>
      <section className="auth-main">
        <div className="auth-form">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">VOTRE ESPACE BANYRA</span>
          <h2>
            {register
              ? "Le début d’un bon chantier."
              : "Heureux de vous retrouver."}
          </h2>
          <p>
            {register
              ? "Créez votre compte et rassemblez votre équipe."
              : "Connectez-vous pour retrouver vos chantiers."}
          </p>
          {invitation && (
            <p className="notice">
              Une invitation vous attend. Utilisez l’adresse e-mail à laquelle
              elle est destinée.
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <Field label="Nom complet">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Ex. Hajar El Amrani"
                />
              </Field>
            )}
            <Field label="Adresse e-mail">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@entreprise.ma"
              />
            </Field>
            <Field label="Mot de passe">
              <input
                name="password"
                type="password"
                aria-label="Mot de passe"
                aria-describedby={register ? "password-hint" : undefined}
                required
                minLength={register ? 12 : 1}
                maxLength={256}
                autoComplete={register ? "new-password" : "current-password"}
              />
              {register && (
                <small id="password-hint">
                  Au moins 12 caractères, une lettre et un chiffre.
                </small>
              )}
            </Field>
            <ErrorBox message={error} />
            <button className="button auth-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
              {register ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>
          <div className="auth-switch">
            {register
              ? "Vous avez déjà un compte ?"
              : "Vous découvrez Banyra ?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
                history.replaceState(
                  null,
                  "",
                  register ? "/login" : "/register",
                );
              }}
            >
              {register ? "Se connecter" : "Créer un compte"}
            </button>
          </div>
          <p className="auth-note">
            Vos données sont enregistrées sur le serveur de votre organisation.
            Seuls les membres invités ont accès à vos chantiers.
          </p>
        </div>
      </section>
    </div>
  );
}

type Dialog = { type: string; task?: Task; entry?: Entry; file?: Document };
function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [online, setOnline] = useState(navigator.onLine);
  const [invitation, setInvitation] = useState(() => {
    const token = new URLSearchParams(location.search).get("invitation");
    if (token) {
      sessionStorage.setItem("banyra.invitation", token);
      history.replaceState(null, "", "/");
    }
    return token || sessionStorage.getItem("banyra.invitation") || "";
  });
  const requestId = useRef(0);
  const accountGeneration = useRef(0);
  const selectedProject = useRef(projectId);
  selectedProject.current = projectId;
  const canWrite = !!workspace && workspace.project.role !== "viewer";
  const isOwner = workspace?.project.role === "owner";
  const fail = (e: unknown) => {
    setError((e as Error).message || "Une erreur est survenue.");
    if (e instanceof ApiError && e.status === 401) {
      accountGeneration.current++;
      requestId.current++;
      selectedProject.current = "";
      setAccount(null);
      setWorkspace(null);
      setProjects([]);
      setProjectId("");
    }
  };
  async function loadProjects() {
    const generation = accountGeneration.current;
    try {
      const rows = await api<Project[]>("/projects");
      if (generation !== accountGeneration.current) return;
      setProjects(rows);
      setProjectId((current) =>
        rows.some((p) => p.id === current) ? current : (rows[0]?.id ?? ""),
      );
    } catch (error) {
      if (generation === accountGeneration.current) throw error;
    }
  }
  async function reload(id = selectedProject.current, quiet = false) {
    if (!id || id !== selectedProject.current) return;
    const generation = accountGeneration.current;
    const counter = ++requestId.current;
    if (!quiet) setLoading(true);
    try {
      const data = await api<Workspace>(`/projects/${id}/workspace`);
      if (
        counter === requestId.current &&
        generation === accountGeneration.current
      ) {
        setWorkspace(data);
        setError("");
      }
    } catch (e) {
      if (
        counter === requestId.current &&
        generation === accountGeneration.current
      ) {
        if (e instanceof ApiError && [403, 404].includes(e.status))
          setWorkspace(null);
        fail(e);
      }
    } finally {
      if (counter === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    void api<{ user: Account; csrf: string }>("/auth/session")
      .then((r) => {
        setAccount(r.user);
        setCsrf(r.csrf);
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401))
          setError(
            "Le serveur est indisponible. Vérifiez votre connexion puis rechargez la page.",
          );
      })
      .finally(() => setBooting(false));
  }, []);
  useEffect(() => {
    if (account) void loadProjects().catch(fail);
  }, [account?.id]);
  useEffect(() => {
    setWorkspace(null);
    setSearch("");
    setFilter("all");
    setDialog(null);
    if (projectId) void reload(projectId);
    else {
      requestId.current++;
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!projectId || dialog || !online) return;
    const timer = setInterval(() => {
      if (!document.hidden) void reload(projectId, true);
    }, 30000);
    return () => clearInterval(timer);
  }, [projectId, dialog, online]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    document.title = `${nav.find((n) => n[0] === view)?.[1] ?? "Banyra"} · Banyra`;
  }, [view]);
  async function mutate(operation: () => Promise<unknown>, close = true) {
    if (busy) return;
    if (!online) {
      setError(
        "Reconnectez-vous pour enregistrer. Aucune modification n’a été envoyée.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await operation();
      if (close) setDialog(null);
      await loadProjects();
      if (projectId) await reload();
      setNotice("Enregistré. Votre équipe peut retrouver cette information.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  const open = (type: string, entry?: Entry) => {
    setError("");
    setDialog({ type, entry });
  };
  const navigate = (value: string) => {
    setView(value);
    setSearch("");
    setFilter("all");
    setMenu(false);
  };
  const entries = (kind: string) =>
    (workspace?.entries ?? []).filter((e) => e.kind === kind);
  const matches = (text: string) =>
    text.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"));
  const members = workspace?.members ?? [];
  const tasks = workspace?.tasks ?? [];
  const incomplete = tasks.filter((t) => t.status !== "done");
  const overdue = incomplete.filter((t) => t.due_date && t.due_date < day());

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      accountGeneration.current++;
      requestId.current++;
      selectedProject.current = "";
      setAccount(null);
      setCsrf("");
      setWorkspace(null);
      setProjects([]);
      setProjectId("");
      setNotice("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function acceptInvitation() {
    await mutate(async () => {
      const result = await api<{ project_id: string }>(
        "/invitations/accept",
        "POST",
        { token: invitation },
      );
      setInvitation("");
      sessionStorage.removeItem("banyra.invitation");
      setProjectId(result.project_id);
    }, false);
  }
  async function createDemo() {
    await mutate(async () => {
      const result = await api<{ id: string }>("/demo", "POST");
      selectedProject.current = result.id;
      setProjectId(result.id);
    }, false);
  }
  if (booting)
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        Chargement de votre espace…
      </div>
    );
  if (!account)
    return (
      <>
        <ErrorBox message={error} />
        <Auth
          invitation={!!invitation}
          onSession={(user, csrf) => {
            accountGeneration.current++;
            requestId.current++;
            selectedProject.current = "";
            setProjects([]);
            setProjectId("");
            setWorkspace(null);
            setAccount(user);
            setCsrf(csrf);
            setError("");
            history.replaceState(null, "", "/");
          }}
        />
      </>
    );

  function entryPayload(entry: Entry, status?: string) {
    const keys: Record<string, string[]> = {
      diary: ["date", "notes", "workforce", "weather"],
      expense: ["title", "category", "supplier", "date", "amount"],
      contract: [
        "title",
        "partner",
        "reference",
        "amount",
        "retention",
        "payment_days",
      ],
      valuation: ["contract_id", "period", "amount", "status"],
      supply: [
        "title",
        "supplier",
        "quantity",
        "unit_price",
        "delivery",
        "status",
      ],
      meeting: ["title", "date", "participants", "notes"],
    };
    return {
      kind: entry.kind,
      version: entry.version,
      data: Object.fromEntries(
        keys[entry.kind].map((key) => [
          key,
          key === "status" && status ? status : entry.data[key],
        ]),
      ),
    };
  }
  const updateEntry = (entry: Entry, status: string) =>
    void mutate(
      () =>
        api(
          `/projects/${projectId}/entries/${entry.id}`,
          "PUT",
          entryPayload(entry, status),
        ),
      false,
    );
  const table = (headers: string[], rows: ReactNode[][]) =>
    rows.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Aucun élément pour le moment"
        text="Vos informations apparaîtront ici une fois enregistrées."
      />
    );

  function taskRows(items: Task[]) {
    return items.length ? (
      <div className="task-list">
        {items.map((task) => (
          <button
            key={task.id}
            className="task-row"
            onClick={() => {
              setError("");
              setDialog({ type: "task", task });
            }}
          >
            <span
              className={`task-state ${task.status === "done" ? "completed" : ""}`}
            >
              {task.status === "done" ? <Check size={16} /> : null}
            </span>
            <span className="task-info">
              <strong>{task.title}</strong>
              <small>
                {kindLabel[task.kind]} · {task.trade} ·{" "}
                {members.find((m) => m.id === task.assignee_id)?.name ??
                  "Non affecté"}
              </small>
            </span>
            <span
              className={
                task.due_date && task.due_date < day() && task.status !== "done"
                  ? "late task-date"
                  : "task-date"
              }
            >
              {dateLabel(task.due_date)}
            </span>
            <Badge value={task.status} />
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    ) : (
      <Empty
        title="Le terrain est à jour"
        text="Créez une action ou une réserve pour affecter un responsable et une échéance."
        onClick={
          canWrite
            ? () => open(view === "quality" ? "quality" : "task")
            : undefined
        }
        button="Créer un suivi"
      />
    );
  }

  function Overview() {
    return (
      <>
        <section className="hero">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> LE POINT CHANTIER
            </span>
            <h2>
              Chaque décision compte.
              <br />
              <em>Faites avancer le terrain.</em>
            </h2>
            <p>
              Des responsabilités claires, des informations partagées.
              <br />
              Votre équipe sait où elle va.
            </p>
            {canWrite && (
              <button className="button" onClick={() => open("task")}>
                <Plus size={16} />
                Créer une action
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit" />
            <Building2 size={138} strokeWidth={0.65} />
            <div className="art-note">
              <CheckCircle2 size={18} />
              <span>
                L’équipe est connectée
                <br />
                <strong>Le chantier avance.</strong>
              </span>
            </div>
            <span className="art-coordinate">BANYRA / TERRAIN</span>
          </div>
        </section>
        <div className="metrics">
          {[
            {
              name: "Actions ouvertes",
              value: incomplete.length,
              note: "à coordonner sur le terrain",
              icon: ClipboardList,
              next: "tasks",
            },
            {
              name: "Échéances dépassées",
              value: overdue.length,
              note: "points à traiter en priorité",
              icon: CalendarDays,
              next: "tasks",
            },
            {
              name: "Dépenses enregistrées HT",
              value: money(workspace!.spent),
              note: "sur ce chantier, en MAD",
              icon: Wallet,
              next: "budget",
            },
            {
              name: "Membres du chantier",
              value: members.length,
              note: "une équipe, un même cap",
              icon: Users,
              next: "team",
            },
          ].map(({ name, value, note, icon: Icon, next }) => (
            <button
              className="metric"
              key={name}
              onClick={() => navigate(next)}
            >
              <span>
                {name}
                <Icon size={18} />
              </span>
              <strong>{value}</strong>
              <small>{note}</small>
            </button>
          ))}
        </div>
        <div className="overview-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Les prochaines étapes</h2>
                <p>Ce qui appelle votre attention.</p>
              </div>
              <button className="text-button" onClick={() => navigate("tasks")}>
                Tout voir
                <ArrowRight size={14} />
              </button>
            </div>
            {taskRows(
              [...incomplete]
                .sort((a, b) =>
                  (a.due_date || "9999").localeCompare(b.due_date || "9999"),
                )
                .slice(0, 5),
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Le fil du chantier</h2>
                <p>Les dernières contributions de votre équipe.</p>
              </div>
              <Activity size={19} />
            </div>
            <div className="timeline">
              {workspace!.events.map((event, index) => (
                <div key={index}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{event.description}</strong>
                    <small>
                      {event.name} · {dateLabel(event.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="project-banner">
          <div>
            <span className="eyebrow">CHANTIER SÉLECTIONNÉ</span>
            <h2>{workspace!.project.name}</h2>
            <p>
              {workspace!.project.city || "Ville à renseigner"} ·{" "}
              {workspace!.project.client || "Client à renseigner"} ·{" "}
              {workspace!.project.reference || "Sans référence"}
            </p>
          </div>
          {isOwner && (
            <button
              className="button secondary"
              onClick={() => open("project-settings")}
            >
              Paramètres du chantier
              <ArrowUpRight size={16} />
            </button>
          )}
        </section>
      </>
    );
  }

  function Content() {
    if (view === "overview") return <Overview />;
    if (view === "tasks" || view === "quality") {
      const rows = tasks.filter(
        (task) =>
          (view === "quality"
            ? ["quality", "safety"].includes(task.kind)
            : ["action", "reserve"].includes(task.kind)) &&
          (filter === "all" || task.status === filter) &&
          matches(`${task.title} ${task.trade} ${task.description}`),
      );
      return (
        <section className="panel">
          <div className="section-heading">
            <div className="tabs">
              {["all", "open", "doing", "done"].map((s) => (
                <button
                  className={filter === s ? "selected" : ""}
                  onClick={() => setFilter(s)}
                  key={s}
                >
                  {s === "all" ? "Tous" : kindLabel[s]}
                </button>
              ))}
            </div>
            {canWrite && (
              <button
                className="button"
                onClick={() => open(view === "quality" ? "quality" : "task")}
              >
                <Plus size={16} />
                {view === "quality" ? "Nouveau contrôle" : "Nouvelle action"}
              </button>
            )}
          </div>
          {taskRows(rows)}
        </section>
      );
    }
    if (view === "diary")
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>La mémoire du chantier</h2>
              <p>Un journal par jour, partagé avec toute l’équipe.</p>
            </div>
            {canWrite && (
              <button className="button" onClick={() => open("diary")}>
                <Plus size={16} />
                Rédiger le journal
              </button>
            )}
          </div>
          {entries("diary").length ? (
            <div className="journal-list">
              {entries("diary")
                .filter((e) => matches(String(e.data.notes)))
                .sort((a, b) =>
                  String(b.data.date).localeCompare(String(a.data.date)),
                )
                .map((e) => (
                  <article key={e.id}>
                    <div className="journal-date">
                      <CalendarDays size={22} />
                      <strong>{dateLabel(String(e.data.date))}</strong>
                    </div>
                    <div>
                      <p className="preserve">{e.data.notes}</p>
                      <small>
                        {e.data.workforce} personnes ·{" "}
                        {e.data.weather || "Météo non renseignée"}
                      </small>
                      <div className="journal-details">
                        {[
                          ["Zones", e.data.work_zones],
                          ["Équipe", e.data.workforce_detail],
                          ["Matériel", e.data.equipment],
                          ["Livraisons", e.data.deliveries],
                          ["Qualité", e.data.quality],
                          ["Sécurité", e.data.safety],
                          ["Blocages", e.data.blockers],
                          ["Demain", e.data.next_day],
                        ]
                          .filter(([, content]) => content)
                          .map(([label, content]) => (
                            <p key={String(label)}>
                              <strong>{label}</strong>
                              {String(content)}
                            </p>
                          ))}
                      </div>
                      {Array.isArray(e.data.task_ids) &&
                        e.data.task_ids.length > 0 && (
                          <div className="journal-tasks">
                            <strong>Tâches liées</strong>
                            {e.data.task_ids.map((id) => {
                              const task = workspace!.tasks.find(
                                (item) => item.id === id,
                              );
                              return task ? (
                                <span key={id}>
                                  <CheckCircle2 size={13} />
                                  {task.title}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      {workspace!.files.some((f) => f.entry_id === e.id) && (
                        <div className="journal-photos">
                          {workspace!.files
                            .filter((f) => f.entry_id === e.id)
                            .map((f) => (
                              <button
                                key={f.id}
                                onClick={() =>
                                  setDialog({ type: "file", file: f })
                                }
                                aria-label={`Voir ${f.label}`}
                              >
                                {f.mime.startsWith("image/") ? (
                                  <img
                                    src={`/api/projects/${projectId}/files/${f.id}`}
                                    alt={f.label}
                                  />
                                ) : (
                                  <FileText size={20} />
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {canWrite && (
                      <button
                        className="text-button"
                        onClick={() => open("diary", e)}
                      >
                        Modifier
                      </button>
                    )}
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="Une journée à raconter"
              text="Consignez les travaux, les effectifs et les points de vigilance."
            />
          )}
        </section>
      );
    if (view === "budget")
      return (
        <>
          <div className="metrics three">
            {[
              ["Enveloppe HT", workspace!.project.budget],
              ["Dépenses HT", workspace!.spent],
              ["Disponible HT", workspace!.remaining],
            ].map(([name, amount]) => (
              <div className="metric" key={name}>
                <span>
                  {name}
                  <Wallet size={18} />
                </span>
                <strong>{money(amount)}</strong>
                <small>Dirhams marocains · MAD</small>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Le registre des dépenses</h2>
                <p>
                  Montants hors taxes. Les commandes et marchés sont suivis dans
                  leurs espaces.
                </p>
              </div>
              {canWrite && (
                <button className="button" onClick={() => open("expense")}>
                  <Plus size={16} />
                  Ajouter une dépense
                </button>
              )}
            </div>
            {table(
              ["Date", "Désignation", "Catégorie", "Fournisseur", "Montant HT"],
              entries("expense")
                .filter((e) => matches(String(e.data.title)))
                .map((e) => [
                  dateLabel(String(e.data.date)),
                  <strong>{e.data.title}</strong>,
                  e.data.category,
                  e.data.supplier || "—",
                  <strong>{money(e.data.amount)}</strong>,
                ]),
            )}
          </section>
        </>
      );
    if (view === "contracts")
      return (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Vos marchés</h2>
                <p>
                  Conditions saisies par votre entreprise, montants HT en MAD.
                </p>
              </div>
              {canWrite && (
                <button className="button" onClick={() => open("contract")}>
                  <Plus size={16} />
                  Nouveau marché
                </button>
              )}
            </div>
            {table(
              [
                "Référence",
                "Objet",
                "Entreprise",
                "Montant HT",
                "Retenue",
                "Délai",
              ],
              entries("contract")
                .filter((e) => matches(String(e.data.title)))
                .map((e) => [
                  e.data.reference || "—",
                  <strong>{e.data.title}</strong>,
                  e.data.partner,
                  money(e.data.amount),
                  `${e.data.retention} %`,
                  `${e.data.payment_days} jours`,
                ]),
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Situations de travaux</h2>
                <p>
                  Montant du mois, retenue contractuelle et net HT à régler.
                </p>
              </div>
              {canWrite && entries("contract").length > 0 && (
                <button
                  className="button secondary"
                  onClick={() => open("valuation")}
                >
                  <Plus size={16} />
                  Créer une situation
                </button>
              )}
            </div>
            {table(
              [
                "Marché",
                "Période",
                "Travaux HT",
                "Retenue",
                "Net HT",
                "Statut",
                "Suite",
              ],
              entries("valuation").map((e) => [
                entries("contract").find((c) => c.id === e.data.contract_id)
                  ?.data.title ?? "Marché",
                e.data.period,
                money(e.data.amount),
                money(e.data.retention_amount),
                <strong>{money(e.data.net_amount)}</strong>,
                <Badge value={String(e.data.status)} />,
                isOwner && e.data.status !== "paid" ? (
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() =>
                      updateEntry(
                        e,
                        e.data.status === "draft" ? "approved" : "paid",
                      )
                    }
                  >
                    {e.data.status === "draft" ? "Valider" : "Marquer réglée"}
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  "—"
                ),
              ]),
            )}
          </section>
        </>
      );
    if (view === "supplies")
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Du besoin à la livraison</h2>
              <p>
                Préparez vos commandes et confirmez la réception sur chantier.
              </p>
            </div>
            {canWrite && (
              <button className="button" onClick={() => open("supply")}>
                <Plus size={16} />
                Préparer une commande
              </button>
            )}
          </div>
          {table(
            [
              "Désignation",
              "Fournisseur",
              "Livraison prévue",
              "Montant HT",
              "Statut",
              "Suivi",
            ],
            entries("supply")
              .filter((e) => matches(String(e.data.title)))
              .map((e) => [
                <strong>{e.data.title}</strong>,
                e.data.supplier,
                dateLabel(String(e.data.delivery)),
                money(e.data.amount),
                <Badge value={String(e.data.status)} />,
                canWrite &&
                !["received", "cancelled"].includes(String(e.data.status)) ? (
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        updateEntry(
                          e,
                          e.data.status === "draft" ? "ordered" : "received",
                        )
                      }
                    >
                      {e.data.status === "draft"
                        ? "Confirmer la commande"
                        : "Réceptionner"}
                    </button>
                    <button
                      className="text-button muted"
                      disabled={busy}
                      onClick={() => updateEntry(e, "cancelled")}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  "—"
                ),
              ]),
          )}
        </section>
      );
    if (view === "meetings")
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Les décisions restent partagées</h2>
              <p>Retrouvez les comptes rendus et les engagements de réunion.</p>
            </div>
            {canWrite && (
              <button className="button" onClick={() => open("meeting")}>
                <Plus size={16} />
                Nouveau compte rendu
              </button>
            )}
          </div>
          {entries("meeting").length ? (
            <div className="meeting-grid">
              {entries("meeting")
                .filter((e) => matches(`${e.data.title} ${e.data.notes}`))
                .map((e) => (
                  <article className="meeting-card" key={e.id}>
                    <span className="eyebrow">
                      {dateLabel(String(e.data.date))}
                    </span>
                    <h3>{e.data.title}</h3>
                    <small>
                      {e.data.participants || "Participants non renseignés"}
                    </small>
                    <p className="preserve">{e.data.notes}</p>
                    {canWrite && (
                      <button
                        className="text-button"
                        onClick={() => open("meeting", e)}
                      >
                        Modifier le compte rendu
                        <ArrowUpRight size={14} />
                      </button>
                    )}
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="Votre prochaine réunion commence ici"
              text="Consignez les décisions pour que chacun puisse retrouver le même compte rendu."
            />
          )}
        </section>
      );
    if (view === "documents")
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>La bonne information, au bon endroit</h2>
              <p>
                Plans PDF et photos · 10 Mo par fichier · révision indiquée à
                chaque dépôt.
              </p>
            </div>
            {canWrite && (
              <button className="button" onClick={() => open("upload")}>
                <Plus size={16} />
                Déposer un document
              </button>
            )}
          </div>
          {table(
            ["Document", "Révision", "Ajouté le", "Taille", "Consulter"],
            workspace!.files
              .filter((file) => matches(`${file.label} ${file.name}`))
              .map((file) => [
                <span className="document-name">
                  <FileText size={20} />
                  <strong>{file.label}</strong>
                </span>,
                <span className="revision">{file.revision}</span>,
                dateLabel(file.created_at),
                `${Math.max(1, Math.round(file.size / 1024))} Ko`,
                <button
                  className="text-button"
                  onClick={() => setDialog({ type: "file", file })}
                >
                  Ouvrir
                  <ArrowUpRight size={14} />
                </button>,
              ]),
          )}
        </section>
      );
    if (view === "team")
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Votre équipe chantier</h2>
              <p>
                Le responsable invite les membres et choisit leurs droits
                d’accès.
              </p>
            </div>
            {isOwner && (
              <button className="button" onClick={() => open("invite")}>
                <Plus size={16} />
                Inviter une personne
              </button>
            )}
          </div>
          {table(
            ["Nom", "Adresse e-mail", "Rôle", "Accès"],
            members.map((m) => [
              <strong>{m.name}</strong>,
              m.email,
              <Badge value={m.role} />,
              isOwner && m.role !== "owner" ? (
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Retirer l’accès de ${m.name} à ce chantier ?`))
                      void mutate(() =>
                        api(`/projects/${projectId}/members/${m.id}`, "DELETE"),
                      );
                  }}
                >
                  Retirer l’accès
                </button>
              ) : (
                "—"
              ),
            ]),
          )}
        </section>
      );
  }

  return (
    <div className="app-shell">
      {menu && <div className="menu-shade" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand-button"
          onClick={() => navigate("overview")}
          aria-label="Accueil Banyra"
        >
          <Brand />
        </button>
        <span className="nav-caption">VOTRE ESPACE DE TRAVAIL</span>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <HardHat size={22} />
            <strong>Le chantier, ensemble.</strong>
            <p>Un point clair. Des actions concrètes. Toute l’équipe avance.</p>
          </div>
          <button
            className="account-button"
            onClick={() => void logout()}
            disabled={busy}
          >
            <span className="avatar">
              {account.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{account.name}</strong>
              <small>Se déconnecter</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <button
              className="icon-button menu-toggle"
              aria-label="Ouvrir le menu"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="muted topbar-path">
              Espace de travail <span>/</span>
            </span>
            <strong>{nav.find((item) => item[0] === view)?.[1]}</strong>
          </div>
          <span className={`connection ${online ? "" : "offline"}`}>
            <i />
            {online ? "En ligne" : "Hors connexion"}
          </span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                BANYRA /{" "}
                {new Intl.DateTimeFormat("fr-MA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date())}
              </span>
              <h1>{nav.find((item) => item[0] === view)?.[1]}</h1>
              <p>
                {view === "overview"
                  ? "Gardez le cap, du premier jour à la réception."
                  : "Les informations utiles, partagées avec les bonnes personnes."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                title="Actualiser"
                aria-label="Actualiser"
                onClick={() =>
                  void loadProjects()
                    .then(() => reload())
                    .catch(fail)
                }
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} />
              </button>
              <button
                className="button secondary"
                onClick={() => open("project")}
              >
                <Plus size={16} />
                Nouveau chantier
              </button>
            </div>
          </div>
          {invitation && (
            <div className="notice invitation">
              <div>
                <strong>
                  Vous avez une invitation à rejoindre un chantier.
                </strong>
                <small>Connecté en tant que {account.email}</small>
              </div>
              <button
                className="button"
                disabled={busy}
                onClick={() => void acceptInvitation()}
              >
                Rejoindre le chantier
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {!dialog && <ErrorBox message={error} />}
          {!online && (
            <p className="notice">
              Vous êtes hors connexion. Les informations déjà chargées restent
              consultables ; reconnectez-vous pour enregistrer.
            </p>
          )}
          <div className="workspace-toolbar">
            <div className="project-select">
              <Building2 size={17} />
              <select
                aria-label="Chantier"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Sélectionner un chantier</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Rechercher"
                placeholder="Rechercher dans cet espace…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {workspace && (
              <button className="text-button" onClick={() => open("report")}>
                <ArrowDownToLine size={16} />
                Rapport du chantier
              </button>
            )}
          </div>
          {loading && !workspace ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Chargement du chantier…
            </div>
          ) : workspace ? (
            <Content />
          ) : (
            <section className="panel">
              <Empty
                title={
                  projects.length
                    ? "Choisissez votre chantier"
                    : "Votre prochain chantier commence ici"
                }
                text={
                  projects.length
                    ? "Sélectionnez une opération dans le menu ci-dessus pour retrouver ses informations."
                    : "Créez une opération, invitez votre équipe et commencez le suivi du terrain."
                }
                onClick={() => open("project")}
                button="Créer un chantier"
              />
              {!projects.length && (
                <div className="demo-action">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void createDemo()}
                  >
                    <Building2 size={16} /> Charger un exemple marocain
                  </button>
                  <small>
                    Données fictives clairement identifiées, à supprimer ou
                    remplacer.
                  </small>
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>Banyra · Le terrain, en confiance.</span>
            <span>Vos chantiers · Vos équipes · Vos décisions</span>
          </footer>
        </main>
      </div>
      {dialog && (
        <DialogContent
          dialog={dialog}
          workspace={workspace}
          busy={busy}
          error={error}
          canWrite={canWrite}
          close={() => {
            setDialog(null);
            setError("");
          }}
          save={mutate}
        />
      )}
    </div>
  );
}

function DialogContent({
  dialog,
  workspace,
  busy,
  error,
  canWrite,
  close,
  save,
}: {
  dialog: Dialog;
  workspace: Workspace | null;
  busy: boolean;
  error: string;
  canWrite: boolean;
  close: () => void;
  save: (operation: () => Promise<unknown>, close?: boolean) => Promise<void>;
}) {
  const [kind, setKind] = useState(
    dialog.task?.kind ?? (dialog.type === "quality" ? "quality" : "action"),
  );
  const [checks, setChecks] = useState(
    dialog.task?.checks ??
      (dialog.type === "quality"
        ? defaultChecks.map((label) => ({ label, done: false }))
        : []),
  );
  const [invitePath, setInvitePath] = useState("");
  const [uploadError, setUploadError] = useState("");
  const entry = dialog.entry;
  const [diaryTaskIds, setDiaryTaskIds] = useState<string[]>(
    Array.isArray(entry?.data.task_ids) ? entry.data.task_ids : [],
  );
  const projectId = workspace?.project.id ?? "";
  const value = (key: string, fallback: string | number = "") => {
    const result = entry?.data[key];
    return Array.isArray(result) ? fallback : (result ?? fallback);
  };
  const title =
    dialog.type === "task" || dialog.type === "quality"
      ? dialog.task
        ? "Suivi du terrain"
        : dialog.type === "quality"
          ? "Nouveau contrôle"
          : "Nouvelle action ou réserve"
      : dialog.type === "project"
        ? "Nouveau chantier"
        : dialog.type === "project-settings"
          ? "Paramètres du chantier"
          : dialog.type === "upload"
            ? "Déposer un document"
            : dialog.type === "invite"
              ? "Inviter une personne"
              : dialog.type === "file"
                ? dialog.file!.label
                : dialog.type === "report"
                  ? "Rapport du chantier"
                  : entryNames[dialog.type];
  const text = (
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      defaultValue?: string | number;
      step?: string;
      min?: number;
      max?: number;
    } = {},
  ) => (
    <Field label={label}>
      <input
        name={name}
        type={options.type ?? "text"}
        required={options.required ?? true}
        defaultValue={options.defaultValue ?? value(name)}
        step={options.step}
        min={options.min}
        max={options.max}
        maxLength={200}
      />
    </Field>
  );
  const decimal = (
    name: string,
    label: string,
    initial?: string | number,
    min = 0.01,
    step = "0.01",
  ) =>
    text(name, label, {
      type: "number",
      step,
      min,
      defaultValue: initial ?? value(name),
    });
  const area = (name: string, label: string, placeholder: string, rows = 3) => (
    <Field label={label} wide>
      <textarea
        name={name}
        rows={rows}
        maxLength={4000}
        defaultValue={value(name)}
        placeholder={placeholder}
      />
    </Field>
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form) as Record<string, string>;
    await save(async () => {
      if (dialog.type === "project" || dialog.type === "project-settings") {
        const projectValues = {
          ...values,
          end_date: values.end_date || null,
          vat: workspace?.project.vat ?? "0",
        };
        const result = await api(
          "/projects" +
            (dialog.type === "project-settings" ? `/${projectId}` : ""),
          dialog.type === "project" ? "POST" : "PUT",
          projectValues,
        );
        return result;
      }
      if (dialog.type === "task" || dialog.type === "quality") {
        const body = {
          ...values,
          assignee_id: values.assignee_id || null,
          due_date: values.due_date || null,
          kind,
          checks,
          ...(dialog.task ? { version: dialog.task.version } : {}),
        };
        const result = await api<{ id: string }>(
          `/projects/${projectId}/tasks${dialog.task ? `/${dialog.task.id}` : ""}`,
          dialog.task ? "PUT" : "POST",
          body,
        );
        return result;
      }
      if (dialog.type === "upload")
        return api(`/projects/${projectId}/files`, "POST", form);
      if (dialog.type === "invite") {
        const result = await api<{ path: string }>(
          `/projects/${projectId}/invitations`,
          "POST",
          values,
        );
        setInvitePath(new URL(result.path, location.origin).href);
        return;
      }
      const data = {
        ...values,
        ...(dialog.type === "diary" ? { task_ids: diaryTaskIds } : {}),
        ...(["supply", "valuation"].includes(dialog.type) && !entry
          ? { status: "draft" }
          : {}),
      };
      return api(
        `/projects/${projectId}/entries${entry ? `/${entry.id}` : ""}`,
        entry ? "PUT" : "POST",
        {
          kind: dialog.type,
          data,
          ...(entry ? { version: entry.version } : {}),
        },
      );
    }, dialog.type !== "invite");
  }
  if (dialog.type === "file")
    return (
      <Modal title={title} close={close} large>
        <div className="file-tools">
          <a
            className="button secondary"
            href={`/api/projects/${projectId}/files/${dialog.file!.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans un nouvel onglet
            <ArrowUpRight size={16} />
          </a>
          <span>Révision {dialog.file!.revision}</span>
        </div>
        {dialog.file!.mime === "application/pdf" ? (
          <iframe
            className="document-preview"
            title={dialog.file!.label}
            src={`/api/projects/${projectId}/files/${dialog.file!.id}`}
          />
        ) : (
          <img
            className="image-preview"
            alt={dialog.file!.label}
            src={`/api/projects/${projectId}/files/${dialog.file!.id}`}
          />
        )}
      </Modal>
    );
  if (dialog.type === "report")
    return (
      <Modal title={title} close={close} large>
        <div className="report-tools">
          <p>Choisissez « Enregistrer en PDF » dans la fenêtre d’impression.</p>
          <button className="button" onClick={() => window.print()}>
            <ArrowDownToLine size={16} />
            Imprimer / enregistrer en PDF
          </button>
        </div>
        <article className="report">
          <Brand />
          <h1>{workspace!.project.name}</h1>
          <p>
            {workspace!.project.reference} · {workspace!.project.city} ·{" "}
            {dateLabel(day())}
          </p>
          <h2>Point financier · MAD HT</h2>
          <p>
            Enveloppe : {money(workspace!.project.budget)} · Dépenses :{" "}
            {money(workspace!.spent)} · Disponible :{" "}
            {money(workspace!.remaining)}
          </p>
          <h2>Actions et contrôles</h2>
          {workspace!.tasks.map((t) => (
            <p key={t.id}>
              <strong>{t.title}</strong> — {kindLabel[t.status]} · {t.trade} ·{" "}
              {dateLabel(t.due_date)}
            </p>
          ))}
          <h2>Journal et décisions</h2>
          {workspace!.entries
            .filter((e) => ["diary", "meeting"].includes(e.kind))
            .map((e) => (
              <div key={e.id}>
                <h3>{e.data.title ?? dateLabel(String(e.data.date))}</h3>
                <p className="preserve">{e.data.notes}</p>
              </div>
            ))}
        </article>
      </Modal>
    );

  return (
    <Modal
      title={title}
      close={close}
      busy={busy}
      large={["project", "project-settings", "diary"].includes(dialog.type)}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {(dialog.type === "project" ||
            dialog.type === "project-settings") && (
            <>
              {text("name", "Nom du chantier", {
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.name
                    : "",
              })}
              {text("reference", "Référence du marché", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.reference
                    : "",
              })}
              <Field label="Ville">
                <input
                  name="city"
                  list="moroccan-cities"
                  defaultValue={
                    dialog.type === "project-settings"
                      ? workspace!.project.city
                      : ""
                  }
                />
                <datalist id="moroccan-cities">
                  {moroccanCities.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </Field>
              {text("client", "Client / maître d’ouvrage", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.client
                    : "",
              })}
              {decimal(
                "budget",
                "Enveloppe budgétaire HT (MAD)",
                dialog.type === "project-settings"
                  ? workspace!.project.budget
                  : "0",
                0,
              )}
              {text("start_date", "Date de début", {
                type: "date",
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.start_date
                    : day(),
              })}
              {text("end_date", "Date prévisionnelle de fin", {
                type: "date",
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.end_date
                    : "",
              })}
              <Field label="Type de projet">
                <select
                  name="project_type"
                  defaultValue={
                    dialog.type === "project-settings"
                      ? workspace!.project.project_type
                      : "Logement"
                  }
                >
                  {[
                    "Logement",
                    "Bureaux",
                    "Équipement public",
                    "Industriel",
                    "Hôtelier",
                    "Infrastructure",
                    "Autre",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
              {decimal(
                "area",
                "Surface construite (m²)",
                dialog.type === "project-settings"
                  ? workspace!.project.area
                  : "0",
                0,
              )}
              {text("address", "Adresse du chantier", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.address
                    : "",
              })}
              {text("province", "Province / préfecture", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.province
                    : "",
              })}
              <p className="form-section-title wide">Intervenants du projet</p>
              {text("architect", "Architecte", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.architect
                    : "",
              })}
              {text("engineering_office", "Bureau d’études techniques", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.engineering_office
                    : "",
              })}
              {text("contractor", "Entreprise principale", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.contractor
                    : "",
              })}
              {text("site_manager", "Ingénieur / conducteur de travaux", {
                required: false,
                defaultValue:
                  dialog.type === "project-settings"
                    ? workspace!.project.site_manager
                    : "",
              })}
            </>
          )}
          {(dialog.type === "task" || dialog.type === "quality") && (
            <>
              <Field label="Type de suivi">
                <select
                  value={kind}
                  disabled={!!dialog.task}
                  onChange={(e) => {
                    const next = e.target.value as Task["kind"];
                    setKind(next);
                    setChecks(
                      (next === "quality"
                        ? defaultChecks
                        : next === "safety"
                          ? safetyChecks
                          : []
                      ).map((label) => ({ label, done: false })),
                    );
                  }}
                >
                  {(dialog.type === "quality"
                    ? ["quality", "safety"]
                    : dialog.task
                      ? [dialog.task.kind]
                      : ["action", "reserve"]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {kindLabel[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Corps d’état">
                <select
                  name="trade"
                  defaultValue={dialog.task?.trade ?? "Général"}
                >
                  {trades.map((trade) => (
                    <option key={trade}>{trade}</option>
                  ))}
                </select>
              </Field>
              <Field label="Intitulé" wide>
                <input
                  name="title"
                  minLength={2}
                  maxLength={200}
                  required
                  defaultValue={dialog.task?.title}
                />
              </Field>
              <Field label="Description" wide>
                <textarea
                  name="description"
                  rows={4}
                  maxLength={5000}
                  defaultValue={dialog.task?.description}
                />
              </Field>
              <Field label="Responsable">
                <select
                  name="assignee_id"
                  defaultValue={dialog.task?.assignee_id ?? ""}
                >
                  <option value="">Non affecté</option>
                  {workspace!.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              {text("due_date", "Échéance", {
                type: "date",
                required: false,
                defaultValue: dialog.task?.due_date ?? "",
              })}
              <Field label="Priorité">
                <select
                  name="priority"
                  defaultValue={dialog.task?.priority ?? "normal"}
                >
                  {["normal", "high", "urgent"].map((p) => (
                    <option key={p} value={p}>
                      {kindLabel[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Statut">
                <select
                  name="status"
                  defaultValue={dialog.task?.status ?? "open"}
                >
                  {["open", "doing", "done"].map((s) => (
                    <option
                      key={s}
                      value={s}
                      disabled={
                        s === "done" &&
                        ["quality", "safety"].includes(kind) &&
                        (!checks.length || checks.some((c) => !c.done))
                      }
                    >
                      {kindLabel[s]}
                    </option>
                  ))}
                </select>
              </Field>
              {checks.length > 0 && (
                <fieldset className="wide checklist">
                  <legend>Points de contrôle</legend>
                  {checks.map((check, index) => (
                    <label key={check.label}>
                      <input
                        type="checkbox"
                        checked={check.done}
                        disabled={!canWrite}
                        onChange={(e) =>
                          setChecks(
                            checks.map((c, i) =>
                              i === index
                                ? { ...c, done: e.target.checked }
                                : c,
                            ),
                          )
                        }
                      />
                      <span>{check.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {dialog.task && (
                <div className="wide">
                  <h3>Pièces jointes</h3>
                  <div className="attachment-list">
                    {workspace!.files
                      .filter((f) => f.task_id === dialog.task!.id)
                      .map((f) => (
                        <a
                          key={f.id}
                          href={`/api/projects/${projectId}/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={16} />
                          {f.name}
                        </a>
                      ))}
                  </div>
                  {canWrite && (
                    <label className="field">
                      <span>Ajouter une photo ou un PDF (10 Mo maximum)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) {
                            setUploadError("La pièce jointe dépasse 10 Mo.");
                            return;
                          }
                          const form = new FormData();
                          form.append("file", file);
                          form.append("task_id", dialog.task!.id);
                          void save(
                            () =>
                              api(`/projects/${projectId}/files`, "POST", form),
                            false,
                          );
                        }}
                      />
                    </label>
                  )}
                  <small>
                    Enregistrez d’abord une nouvelle réserve pour y joindre une
                    photo.
                  </small>
                </div>
              )}
            </>
          )}
          {dialog.type === "diary" && (
            <>
              {text("date", "Date du journal", {
                type: "date",
                defaultValue: value("date", day()),
              })}
              {text("workforce", "Effectif présent", {
                type: "number",
                min: 0,
                max: 100000,
                defaultValue: value("workforce", 0),
              })}
              {text("weather", "Conditions météo", { required: false })}
              {text("temperature", "Température / intempéries", {
                required: false,
              })}
              {text("work_zones", "Zones de travail", { required: false })}
              {area(
                "workforce_detail",
                "Répartition des effectifs par entreprise et corps d’état",
                "Ex. Atlas Bâtiment : 8 coffreurs, 5 ferrailleurs · Élec Maroc : 3 électriciens",
              )}
              <Field label="Travaux réalisés et points de vigilance" wide>
                <textarea
                  name="notes"
                  rows={7}
                  required
                  minLength={2}
                  maxLength={10000}
                  defaultValue={value("notes")}
                />
              </Field>
              {area(
                "equipment",
                "Matériel et engins présents",
                "Grue, pelle, nacelle, bétonnière, véhicules…",
              )}
              {area(
                "deliveries",
                "Livraisons et réceptions",
                "Matériau, fournisseur, quantité, bon de livraison et conformité",
              )}
              {area(
                "quality",
                "Contrôles qualité et essais",
                "Contrôles réalisés, résultats, visas et non-conformités",
              )}
              {area(
                "safety",
                "Sécurité et environnement",
                "Causerie, EPI, protections collectives, déchets et observations HSE",
              )}
              {area(
                "incidents",
                "Incidents, accidents ou dommages",
                "Indiquez « Néant » si aucun événement",
              )}
              {area(
                "visitors",
                "Visites et personnes présentes",
                "Maître d’ouvrage, architecte, BET, laboratoire, autorités…",
                2,
              )}
              {area(
                "decisions",
                "Décisions, instructions et visas",
                "Décisions prises, responsable et délai attendu",
              )}
              {area(
                "blockers",
                "Arrêts, retards et blocages",
                "Cause, impact sur le planning et action corrective",
              )}
              {area(
                "next_day",
                "Programme du lendemain",
                "Travaux prévus, besoins, livraisons et points à préparer",
              )}
              <fieldset className="checklist wide">
                <legend>Tâches et réserves traitées dans la journée</legend>
                {workspace!.tasks.length ? (
                  workspace!.tasks.map((task) => (
                    <label key={task.id}>
                      <input
                        type="checkbox"
                        checked={diaryTaskIds.includes(task.id)}
                        onChange={(event) =>
                          setDiaryTaskIds((current) =>
                            event.target.checked
                              ? [...current, task.id]
                              : current.filter((id) => id !== task.id),
                          )
                        }
                      />
                      <span>
                        {task.title} · {task.trade} · {kindLabel[task.status]}
                      </span>
                    </label>
                  ))
                ) : (
                  <small>
                    Créez d’abord une action ou une réserve pour la rattacher au
                    journal.
                  </small>
                )}
              </fieldset>
              {entry && (
                <div className="diary-upload wide">
                  <strong>Photos et pièces du jour</strong>
                  <div className="attachment-list">
                    {workspace!.files
                      .filter((f) => f.entry_id === entry.id)
                      .map((f) => (
                        <a
                          key={f.id}
                          href={`/api/projects/${projectId}/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={15} />
                          {f.label}
                        </a>
                      ))}
                  </div>
                  {canWrite && (
                    <label className="field">
                      <span>Ajouter une photo ou un PDF (10 Mo maximum)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const form = new FormData();
                          form.append("file", file);
                          form.append("entry_id", entry.id);
                          void save(
                            () =>
                              api(`/projects/${projectId}/files`, "POST", form),
                            false,
                          );
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
              {!entry && (
                <p className="form-note wide">
                  Après l’enregistrement, ouvrez ce journal avec « Modifier »
                  pour ajouter les photos de la journée.
                </p>
              )}
            </>
          )}
          {dialog.type === "expense" && (
            <>
              {text("title", "Désignation")}
              {decimal("amount", "Montant HT (MAD)")}
              {text("date", "Date", { type: "date", defaultValue: day() })}
              {text("supplier", "Fournisseur / entreprise", {
                required: false,
              })}
              <Field label="Catégorie">
                <select name="category">
                  {[
                    "Matériaux",
                    "Main-d’œuvre",
                    "Matériel",
                    "Sous-traitance",
                    "Autre",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {dialog.type === "contract" && (
            <>
              {text("title", "Objet du marché")}
              {text("partner", "Entreprise / sous-traitant")}
              {text("reference", "Référence", { required: false })}
              {decimal("amount", "Montant du marché HT (MAD)")}
              {decimal("retention", "Retenue contractuelle (%)", 0, 0)}
              {text("payment_days", "Délai de paiement contractuel (jours)", {
                type: "number",
                min: 0,
                max: 365,
                defaultValue: 30,
              })}
              <p className="form-note wide">
                Renseignez les conditions de votre marché. Aucun taux légal
                n’est appliqué automatiquement.
              </p>
            </>
          )}
          {dialog.type === "valuation" && (
            <>
              <Field label="Marché concerné">
                <select name="contract_id" required>
                  {workspace!.entries
                    .filter((e) => e.kind === "contract")
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.data.title}
                      </option>
                    ))}
                </select>
              </Field>
              {text("period", "Mois de la situation", {
                type: "month",
                defaultValue: day().slice(0, 7),
              })}
              {decimal("amount", "Travaux de la période HT (MAD)")}
              <p className="form-note wide">
                Saisissez le montant du mois, sans cumul antérieur. Le serveur
                contrôle le plafond du marché et calcule la retenue.
              </p>
            </>
          )}
          {dialog.type === "supply" && (
            <>
              {text("title", "Désignation des fournitures")}
              {text("supplier", "Fournisseur")}
              {decimal("quantity", "Quantité", undefined, 0.001, "0.001")}
              {decimal("unit_price", "Prix unitaire HT (MAD)", undefined, 0)}
              {text("delivery", "Livraison souhaitée", {
                type: "date",
                defaultValue: day(),
              })}
            </>
          )}
          {dialog.type === "meeting" && (
            <>
              {text("title", "Objet de la réunion")}
              {text("date", "Date de réunion", {
                type: "date",
                defaultValue: value("date", day()),
              })}
              {text("participants", "Participants", { required: false })}
              <Field label="Décisions et actions convenues" wide>
                <textarea
                  name="notes"
                  rows={7}
                  required
                  minLength={2}
                  maxLength={10000}
                  defaultValue={value("notes")}
                />
              </Field>
            </>
          )}
          {dialog.type === "upload" && (
            <>
              {text("label", "Libellé du document", { required: false })}
              {text("revision", "Révision", { defaultValue: "A" })}
              <Field label="Fichier PDF, JPEG ou PNG" wide>
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  required
                />
              </Field>
            </>
          )}
          {dialog.type === "invite" && (
            <>
              {text("email", "Adresse e-mail du destinataire", {
                type: "email",
              })}
              <Field label="Rôle sur le chantier">
                <select name="role">
                  <option value="member">
                    Collaborateur — consulter et enregistrer
                  </option>
                  <option value="viewer">
                    Consultation — lecture uniquement
                  </option>
                </select>
              </Field>
              <p className="form-note wide">
                Le lien est valable 7 jours, utilisable une fois et lié à cette
                adresse. Partagez-le directement avec la personne ; aucun e-mail
                n’est envoyé automatiquement.
              </p>
              {invitePath && (
                <Field label="Lien d’invitation à partager" wide>
                  <input
                    readOnly
                    value={invitePath}
                    onFocus={(e) => e.target.select()}
                  />
                </Field>
              )}
            </>
          )}
        </div>
        <ErrorBox message={error || uploadError} />
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy}
          >
            Fermer
          </button>
          {(canWrite || dialog.type === "project") && (
            <button className="button" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}
              {dialog.type === "invite"
                ? "Créer le lien d’invitation"
                : "Enregistrer"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
