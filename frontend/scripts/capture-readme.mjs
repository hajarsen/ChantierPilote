/** Record the actual Banyra UI against an isolated, fictional SQLite workspace. */
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const media = join(root, "docs/media");
const scratch = mkdtempSync(join(tmpdir(), "banyra-readme-"));
const origin = "http://127.0.0.1:8012";
mkdirSync(media, { recursive: true });

// Reuse the installed FFmpeg binary through Playwright's configurable tool cache.
// No browser or encoder is downloaded, and no application data is reused.
const encoder = execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
const registry = JSON.parse(
  readFileSync(
    join(root, "frontend/node_modules/playwright-core/browsers.json"),
    "utf8",
  ),
);
const revision = registry.browsers.find(
  (item) => item.name === "ffmpeg",
).revision;
process.env.PLAYWRIGHT_BROWSERS_PATH = join(scratch, "browser-tools");
const encoderDir = join(
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  `ffmpeg-${revision}`,
);
mkdirSync(encoderDir, { recursive: true });
symlinkSync(encoder, join(encoderDir, "ffmpeg-linux"));
const { chromium } = await import("@playwright/test");

let logs = "";
const server = spawn(
  join(root, ".venv/bin/python"),
  ["-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8012"],
  {
    cwd: root,
    env: {
      ...process.env,
      BANYRA_DATA_DIR: join(scratch, "data"),
      BANYRA_SECURE_COOKIES: "0",
      BANYRA_PUBLIC_ORIGIN: origin,
      BANYRA_ALLOW_REGISTRATION: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => {
    logs = (logs + chunk).slice(-6000);
  });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      ready = (await fetch(`${origin}/api/health`)).ok;
    } catch {}
    if (ready) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  if (!ready) throw new Error(`Banyra n’a pas démarré. ${logs}`);
  browser = await chromium.launch({
    executablePath: process.env.BANYRA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: "fr-MA",
    reducedMotion: "reduce",
    recordVideo: {
      dir: join(scratch, "recording"),
      size: { width: 1600, height: 1000 },
    },
  });
  const registration = await context.request.post(
    `${origin}/api/auth/register`,
    {
      data: {
        name: "Équipe Banyra",
        email: "presentation@example.invalid",
        password: "Banyra-Video-Demo-2026",
      },
    },
  );
  if (registration.status() !== 201) throw new Error(await registration.text());
  const { csrf } = await registration.json();
  const seeded = await context.request.post(`${origin}/api/demo/bootstrap`, {
    headers: { "X-CSRF-Token": csrf },
  });
  if (!seeded.ok()) throw new Error(await seeded.text());
  const portfolio = await context.request.get(`${origin}/api/projects`);
  const project = (await portfolio.json())[0];
  const sample = await context.request.post(
    `${origin}/api/projects/${project.id}/bim/demo`,
    { headers: { "X-CSRF-Token": csrf } },
  );
  if (!sample.ok()) throw new Error(await sample.text());

  const started = Date.now();
  const page = await context.newPage();
  const video = page.video();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const chapters = [];
  const elapsed = () => (Date.now() - started) / 1000;
  const pause = (ms) => page.waitForTimeout(ms); // Deliberate pacing of a presentation, not test synchronisation.
  const nav = (name) =>
    page
      .locator(".sidebar nav")
      .getByRole("button", { name, exact: true })
      .click();
  const frame = async (name, fullPage = false) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(250);
    await page.screenshot({
      path: join(media, name),
      fullPage,
      animations: "disabled",
    });
  };
  const chapter = async (title, action) => {
    const start = elapsed();
    await action();
    chapters.push({ title, start, end: elapsed() });
  };

  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Vos chantiers en un regard" })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await frame("vue-ensemble.png", true);
  await chapter("01 — Pilotage du chantier et montants en MAD", async () => {
    await pause(3500);
    await page.locator(".overview-grid").scrollIntoViewIfNeeded();
    await pause(3000);
  });

  await nav("Maquette BIM · 3D");
  await page
    .locator("canvas[data-element-count='215']")
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("checkbox", { name: /Sélectionner/ })
    .first()
    .check();
  await page
    .locator(".bim-properties")
    .getByText("GlobalId", { exact: true })
    .waitFor();
  await frame("maquette-3d.png", true);
  await page.locator(".bim-viewer-panel").scrollIntoViewIfNeeded();
  await chapter("02 — Maquette BIM 3D et propriétés des éléments", async () => {
    await pause(2500);
    const box = await page.locator(".bim-canvas").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.52, {
      steps: 18,
    });
    await page.mouse.up();
    await pause(2500);
    await page
      .getByRole("button", { name: "Désélectionner", exact: true })
      .click();
    await page.getByRole("button", { name: "Recentrer", exact: true }).click();
    await pause(1500);
  });

  await nav("Planning · 4D");
  await page
    .getByRole("heading", { name: "Planning des travaux", exact: true })
    .waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  const dateInput = page.getByLabel("Date de simulation 4D", { exact: true });
  const slider = page.getByLabel("Parcourir le planning 4D", { exact: true });
  await page
    .getByRole("checkbox", { name: "Simulation 4D du planning", exact: true })
    .check();
  await chapter("03 — Planning des travaux et simulation 4D", async () => {
    await page.locator(".bim-planning").scrollIntoViewIfNeeded();
    await pause(3000);
    await page.locator(".bim-viewer-panel").scrollIntoViewIfNeeded();
    const min = Number(await slider.getAttribute("min"));
    const max = Number(await slider.getAttribute("max"));
    for (let index = 0; index <= 8; index++) {
      const date = new Date(
        (min + Math.round(((max - min) * index) / 8)) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      await dateInput.fill(date);
      await pause(220);
    }
    await dateInput.fill(
      new Date((min + Math.round((max - min) * 0.38)) * 86400000)
        .toISOString()
        .slice(0, 10),
    );
    await pause(2000);
  });
  await frame("planning-4d.png", true);

  await nav("Actions terrain");
  await page.locator(".task-row").first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await chapter(
    "04 — Actions terrain, réserves et responsabilités",
    async () => {
      await pause(2500);
      await page.locator(".task-row").first().click();
      await page.getByRole("dialog").waitFor();
      await pause(2500);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Fermer", exact: true })
        .click();
      await pause(1000);
    },
  );

  await nav("Journal de chantier");
  await page.locator(".journal-list").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await chapter("05 — Journal quotidien, équipes et contrôles", async () => {
    await pause(4500);
  });
  await nav("Budget & coûts");
  await page.locator(".metrics.three").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await chapter("06 — Suivi des dépenses en dirhams marocains", async () => {
    await pause(4500);
  });
  await nav("Vue d’ensemble");
  await page
    .getByRole("heading", { name: "Vos chantiers en un regard" })
    .waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await chapter(
    "BANYRA — Prototype de suivi de chantier · Données fictives",
    async () => {
      await pause(3000);
    },
  );

  // A continuously painted tail allows us to align the video clock with the
  // interaction clock. This calibration card is excluded from the final cuts.
  await page.setContent(
    '<main style="background:#203d33;color:white;height:100vh;display:grid;place-items:center;font:40px sans-serif"><div>Banyra<span id="clock" style="display:block;height:4px;background:#e97a4a;margin-top:20px;transform-origin:left"></span></div></main>',
  );
  await page.evaluate(() => {
    const tick = () => {
      document.getElementById("clock").style.transform =
        `scaleX(${0.5 + 0.5 * Math.sin(performance.now() / 100)})`;
      requestAnimationFrame(tick);
    };
    tick();
  });
  await pause(1000);
  const recordingEnd = elapsed();
  await page.close();
  await context.close();
  const rawVideo = await video.path();
  if (failures.length) throw new Error(failures.join("\n"));
  await browser.close();
  browser = null;

  const rawDuration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        rawVideo,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  const clockOffset = Math.max(0, recordingEnd - rawDuration);
  writeFileSync(
    join(scratch, "capture.json"),
    JSON.stringify(
      { rawVideo, rawDuration, recordingEnd, clockOffset, chapters },
      null,
      2,
    ),
  );

  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const clips = [];
  chapters.forEach((item, index) => {
    const from = Math.max(0, item.start - clockOffset);
    const to = Math.min(rawDuration, item.end - clockOffset);
    if (to - from < 0.5) return;
    const caption = join(scratch, `chapter-${index}.txt`);
    writeFileSync(caption, item.title);
    const clip = join(scratch, `clip-${index}.mp4`);
    execFileSync(
      encoder,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        from.toFixed(3),
        "-i",
        rawVideo,
        "-t",
        (to - from).toFixed(3),
        "-vf",
        `drawtext=fontfile=${font}:textfile=${caption}:fontsize=21:fontcolor=white:box=1:boxcolor=0x203d33@0.92:boxborderw=14:x=24:y=h-52`,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-y",
        clip,
      ],
      { stdio: "inherit" },
    );
    clips.push(clip);
  });
  const playlist = join(scratch, "clips.txt");
  writeFileSync(playlist, clips.map((clip) => `file '${clip}'`).join("\n"));
  execFileSync(
    encoder,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      playlist,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      "-y",
      join(media, "banyra-demo.mp4"),
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    encoder,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      clips[1],
      "-t",
      "6",
      "-filter_complex",
      "fps=8,scale=880:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      "-y",
      join(media, "demo-apercu.gif"),
    ],
    { stdio: "inherit" },
  );
  const duration = Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        join(media, "banyra-demo.mp4"),
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  console.log(
    JSON.stringify({
      media,
      duration: Math.round(duration),
      screenshots: 3,
      video: "banyra-demo.mp4",
      isolatedData: true,
    }),
  );
} catch (error) {
  console.error(error.message);
  console.error(logs.slice(-3000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
