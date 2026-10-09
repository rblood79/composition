// S2 toast placement live (사용자 2026-10-10 「Toast placement — 프로젝트 설정」): real Builder
// (headed Chrome, Compare Mode). A Button whose press shows a toast (an interaction rule); the
// Settings panel's App section offers Toast Placement (default Bottom End). For each placement the
// Preview's toast region sits at that place of the Preview window: bottom end (default) — right ·
// bottom; top — centred · top; top end — right · top; bottom — centred · bottom. Undo brings the
// previous place back; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/toast-placement-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const toggle = () => page.locator(".settings-toast-placement-toggle").first();
const alignToggle = () => page.locator(".settings-toast-align-toggle").first();
const pressed = (group) =>
  group
    .locator('[aria-checked="true"], [data-selected]')
    .first()
    .textContent()
    .catch(() => null);
/** Choose a toggle's option (one history step when it changes). */
async function choose(group, label) {
  const option = group.getByRole("radio", { name: label, exact: true });
  if ((await option.getAttribute("aria-checked")) === "true") return;
  await option.click();
  await page.waitForTimeout(1200);
}
async function openSettings() {
  for (let i = 0; i < 2; i++) {
    if (await toggle().isVisible().catch(() => false)) return true;
    await page.locator("button.header-menu-button").first().click();
    await page.waitForTimeout(400);
    const item = page
      .locator(".header-menu-item")
      .filter({ hasText: /^Settings/ })
      .first();
    if (await item.isVisible().catch(() => false)) await item.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  }
  if (await toggle().isVisible().catch(() => false)) return true;
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(1000);
  return toggle().isVisible().catch(() => false);
}
/** Press the Preview's Button (its rule shows a toast), then read the region against the window. */
async function toastAt() {
  await page
    .frameLocator("#previewFrame")
    .locator(".react-aria-Button")
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const frame = document.querySelector("#previewFrame");
    const win = frame.contentWindow;
    const regions = [
      ...frame.contentDocument.querySelectorAll(".react-aria-ToastRegion"),
    ];
    const region = regions.at(-1);
    const r = region?.getBoundingClientRect();
    return {
      count: regions.length,
      position: region?.getAttribute("data-position") ?? null,
      text: region?.textContent?.trim() ?? null,
      box: r && {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      },
      window: { width: win.innerWidth, height: win.innerHeight },
    };
  });
}
const dismiss = () =>
  page.evaluate(() => {
    for (const button of document
      .querySelector("#previewFrame")
      .contentDocument.querySelectorAll(".react-aria-ToastRegion .toast-close"))
      button.click();
  });
const placed = (got, horizontal, vertical) => {
  if (!got.box) return false;
  const { left, right, top, bottom } = got.box;
  const { width, height } = got.window;
  const h =
    horizontal === "end"
      ? Math.abs(width - right) <= 1
      : Math.abs((left + right) / 2 - width / 2) <= 1;
  const v =
    vertical === "top" ? Math.abs(top) <= 1 : Math.abs(height - bottom) <= 1;
  return h && v;
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Toast placement");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

await addFromPalette("button");
const rule = await page.evaluate(async (commands) => {
  const c = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const button = [...root.canvasInputs.values()]
    .filter((r) => root.typeOf(r) === "Button")
    .at(-1);
  const ownerId = button.sourceId;
  ws.execute(
    c.setNodeInteractions({
      ownerId,
      entries: [
        {
          kind: "interaction",
          id: ws.newId("interaction"),
          ownerId,
          trigger: "onPress",
          action: { opcode: "toast", message: "Saved" },
        },
      ],
      label: "Rules",
    }),
  );
  await new Promise((r) => setTimeout(r, 1000));
  return { ownerId };
}, commands);

const opened = await openSettings();
const current = opened
  ? [await pressed(toggle()), await pressed(alignToggle())]
  : null;
record(
  "Settings · App offers Toast Placement · Toast Align — Bottom · End by default",
  opened && current?.[0] === "Bottom" && current?.[1] === "End",
  { opened, current, rule },
);
await page.screenshot({ path: `${OUT}/settings.png` });

const before = await toastAt();
await page.screenshot({ path: `${OUT}/toast-bottom-end.png` });
await dismiss();
record(
  "default: the toast shows at the bottom end of the Preview",
  before.text?.includes("Saved") &&
    before.position === "bottom-right" &&
    placed(before, "end", "bottom"),
  before,
);

const CASES = [
  ["Top", "Center", "top-center", "center", "top"],
  ["Top", "End", "top-right", "end", "top"],
  ["Bottom", "Center", "bottom-center", "center", "bottom"],
];
for (const [placement, align, position, horizontal, vertical] of CASES) {
  const label = `${placement} · ${align}`;
  await choose(toggle(), placement);
  await choose(alignToggle(), align);
  const got = await toastAt();
  await page.screenshot({ path: `${OUT}/toast-${position}.png` });
  await dismiss();
  record(
    `${label}: the toast shows at the ${vertical} ${horizontal}`,
    got.text?.includes("Saved") &&
      got.position === position &&
      placed(got, horizontal, vertical),
    got,
  );
}

await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
await page.waitForTimeout(1200);
const undone = await toastAt();
await dismiss();
record(
  "undo (the last step, Align Center): back to Bottom · End",
  undone.position === "bottom-right" && placed(undone, "end", "bottom"),
  undone,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
