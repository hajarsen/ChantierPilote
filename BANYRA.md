# Banyra — a French construction workspace

Banyra is a working product edition built on OpenConstructionERP 18.9.0. The
default entry point is `/pilot`; `/login` uses its own identity and sign-in
screen. The full upstream ERP remains available through **Outils ERP avancés**.

## Product scope

- Project portfolio, project creation, search and a per-user site selection.
- Field actions with priority, due date, named field coordinator and lifecycle.
- Quality inspections and safety observations, with four-point checklists.
  The interface requires all points to be checked before offering completion;
  this is a UI workflow, not an additional server-side approval policy.
- Daily site journals with date, workforce, equipment and narrative. Existing
  journals are edited with the server's optimistic-lock version; closed
  journals remain protected. One journal is maintained per site and day.
- Cost overview using the existing cost-control report, plus an editable
  project budget envelope. The envelope is separate from cost-line budgets.
- Purchase-order register and creation of draft orders with a line item,
  supplier, delivery date and VAT. Totals are calculated by the existing
  backend using decimal arithmetic. Approval, issue, receipts and detailed
  estimating remain in the existing ERP workflows, linked from this edition.
- CSV exports with formula neutralization, responsive navigation, a new logo,
  locally served fonts, and an updated installable-app manifest.

The first edition intentionally speaks French. New copy lives in a separate
`chantierPilote` i18next namespace in `frontend/src/features/chantier-pilote/copy.ts`;
it does not rewrite the upstream locale bundles. Styling is scoped to `.cp-app`.
The internal feature directory name is retained from the initial working name.

The name **Banyra** is provisional: availability of **banyra.ma** has not been
verified. Requests to the registry were denied by the environment network policy.
The draft now requests HTTPS access to `www.registre.ma` and `whois.registre.ma`.
No domain has been registered, and this edition claims no deployment domain.

## Data and integration

No duplicate backend or parallel data store was introduced. All writes use the
existing authenticated APIs and their server-side project access checks.
Task metadata identifies custom registers with `cp_kind = quality | safety`;
other tasks remain coordination actions. Portfolio reads fetch complete paged
registers for each accessible project, with bounded concurrency. Financial
displays stay in the project's currency; there is no mixed-currency aggregation.

Local browser state contains only the current user's selected project ID.
Demo access uses the existing explicit server-controlled demo-login endpoint;
normal login retains the ERP's session handling and validated internal redirects.
Demo content remains sample ERP data, not the customer's real projects.
Shared-client offline writes are identified as pending until confirmed; this
edition does not promise an independently tested offline synchronization engine.

## Running and verification

Use the prepared environment and existing checkout; no worktree is needed.
Backend startup and embedded PostgreSQL are unchanged. See the environment's
saved startup instructions. From `frontend/`, run `npm run dev` for development
or `npm run build` for the full TypeScript and production-bundle gate.

From the repository root, the preferred local launcher is:

```bash
python3 scripts/banyra_dev.py start --wait 180
python3 scripts/banyra_dev.py status
python3 scripts/banyra_dev.py stop
```

The launcher detaches both development services from the invoking shell, records
their process identities under `.venv/`, and keeps logs in `.venv/banyra-logs/`.
Repeated starts reuse its existing processes. Stop only affects the exact
processes it started, never the database data. This cannot guarantee survival of
an environment shutdown; start the services again after a restore.

These services are local to the cloud machine. They do **not** create a public
website, and screenshot paths are not application URLs. Public access still
requires a hosting account/server, a deployed runtime and a working HTTPS URL.
No such deployment or `.ma` domain is currently configured.

Focused unit checks:

```bash
npm run test -- --run src/features/chantier-pilote/api.test.ts \
  src/features/boq/api.test.ts src/shared/lib/api.test.ts --maxWorkers=2
```

With backend and frontend running, the real-browser workflow test creates an
isolated validation project, verifies persisted records and exact order totals,
checks mobile overflow, and archives its own project in cleanup:

```bash
BANYRA_CHROMIUM=/usr/bin/chromium npx playwright test \
  --config=banyra.playwright.config.ts
```

Omit `BANYRA_CHROMIUM` to use a Playwright-managed Chromium installation.
`BANYRA_BASE_URL` optionally selects another local test server. No tokens or
passwords are printed by the test.

## Attribution

The original AGPL-3.0 license, authorship notices and upstream source attribution
remain in place. Banyra adds its own product experience; it does not claim to be
Novade or copy its interface, branding or assets. The illustrative site image is
reused from this repository's `backend/app/scripts/flagship_assets/site_photos/04.jpg`.
It is labelled as an illustration, not as a photograph of any listed project.
