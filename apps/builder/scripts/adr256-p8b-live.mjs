// ADR-256 Phase 8b live — a Dialog opens in its Modal node, in the real Builder (headed Chrome,
// Compare Mode opens the Preview): L-1 the placed Dialog is DialogTrigger > Button + Modal > Dialog,
// the Canvas draws the trigger · L-2 the Preview opens one ModalOverlay > Modal > Dialog named by its
// title · L-3 not dismissable: an outside press keeps it, Close closes it · L-4 the Modal's Design
// panel has Dismissable (the Dialog's not), on → an outside press closes · L-5 saved and reopened ·
// L-6 no page errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p8b-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
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
const errorsAt = [];
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
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};



const dialogProbe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const trigger = all.find((r) => root.typeOf(r) === "DialogTrigger");
    const shape = (r) => ({
      type: root.typeOf(r),
      hidden: r.hidden === true,
      dismissable: r.props.isDismissable,
      children: r.children.map((id) => shape(root.canvasInputs.get(id))),
    });
    return trigger ? shape(trigger) : null;
  });
const overlayState = () =>
  preview((doc) => {
    const overlays = doc.querySelectorAll(".react-aria-ModalOverlay");
    const modals = doc.querySelectorAll(".react-aria-Modal");
    const dialog = doc.querySelector('.react-aria-Modal [role="dialog"]');
    const title = dialog && doc.getElementById(dialog.getAttribute("aria-labelledby") ?? "");
    const rect = modals[0]?.getBoundingClientRect();
    return {
      overlays: overlays.length,
      modals: modals.length,
      dialogInModal: !!dialog,
      title: title?.textContent ?? null,
      box: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
    };
  });
const pressOutside = () =>
  preview((doc) => {
    const overlay = doc.querySelector(".react-aria-ModalOverlay");
    if (!overlay) return false;
    const view = doc.defaultView;
    for (const type of ["pointerdown", "pointerup"])
      overlay.dispatchEvent(
        new view.PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "mouse", button: 0 }),
      );
    overlay.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
    return true;
  });
const kinds = (node) => node && [node.type, ...node.children.map(kinds)];

await newProject(`adr256-p8b-${Date.now()}`);
await compareOn();
await addFromPalette("Dialog");
await page.waitForTimeout(1000);

// L-1: the placed Dialog is DialogTrigger > Button + Modal > Dialog; the Canvas draws the trigger.
const p1 = await dialogProbe();
record(
  "L-1 DialogTrigger > Button + Modal > Dialog (Heading · frame · DialogFooter) · Modal hidden on Canvas",
  p1?.children.map((c) => c.type).join() === "Button,Modal" &&
    p1.children[1].hidden &&
    !p1.children[0].hidden &&
    p1.children[1].children.map((c) => c.type).join() === "Dialog" &&
    p1.children[1].children[0].children.map((c) => c.type).join() ===
      "Heading,frame,DialogFooter",
  { p1: kinds(p1) },
);
errorsAt.push(["L-1", errors.length]);

// L-2: the Preview opens one ModalOverlay > Modal > Dialog, named by its title.
await press("button:has-text('Open Dialog')");
const o2 = await overlayState();
record(
  "L-2 Preview: one ModalOverlay · one Modal · the Dialog in it · named Dialog Title",
  o2.overlays === 1 && o2.modals === 1 && o2.dialogInModal && o2.title === "Dialog Title" && o2.box?.[0] > 0,
  o2,
);
errorsAt.push(["L-2", errors.length]);

// L-3: not dismissable — an outside press keeps it; the close Button closes it.
await pressOutside();
await page.waitForTimeout(800);
const o3a = await overlayState();
await press(".react-aria-Dialog button[slot='close']");
const o3b = await overlayState();
record(
  "L-3 outside press keeps it open (isDismissable false) · Close button closes",
  o3a.modals === 1 && o3b.modals === 0,
  { o3a, o3b },
);
errorsAt.push(["L-3", errors.length]);

// L-4: the Modal's Design panel shows Dismissable; turning it on, an outside press closes it.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const modal = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Modal");
  ws.selectRecords([modal.id]);
});
await page.waitForTimeout(800);
const design = page.getByRole("button", { name: "Design", exact: true }).first();
await design.click();
await page.waitForTimeout(1200);
writeFileSync(`${OUT}/l4-modal-panel.png`, await page.screenshot());
const modalPanel = await page.evaluate(() => document.body.innerText);
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const dialog = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Dialog");
  ws.selectRecords([dialog.id]);
});
await page.waitForTimeout(1000);
const dialogPanel = await page.evaluate(() => document.body.innerText);
await design.click();
await page.waitForTimeout(500);
const r4 = await page.evaluate(async ({ commands }) => {
  const c = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const modal = [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Modal");
  try {
    ws.execute(
      c.setFields({
        targets: [ws.positionOfRecord(modal.id).target],
        props: { isDismissable: { kind: "set", value: true } },
      }),
    );
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error?.code ?? String(error) };
  }
}, { commands });
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await page.waitForTimeout(800);
await press("button:has-text('Open Dialog')");
const o4a = await overlayState();
await pressOutside();
await page.waitForTimeout(800);
const o4b = await overlayState();
record(
  "L-4 Modal panel shows Dismissable (Dialog's does not) · on → an outside press closes it",
  /Dismissable/.test(modalPanel) && !/Dismissable/.test(dialogPanel) && r4.ok && o4a.modals === 1 && o4b.modals === 0,
  { modalPanel: /Dismissable/.test(modalPanel), dialogPanel: /Dismissable/.test(dialogPanel), r4, o4a, o4b },
);
errorsAt.push(["L-4", errors.length]);

// L-5: saved and reopened the same (the Modal layer · its isDismissable).
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
const p5 = await dialogProbe();
record(
  "L-5 saved and reopened: Button + Modal (isDismissable true) > Dialog",
  page.url() === projectUrl &&
    p5?.children.map((c) => c.type).join() === "Button,Modal" &&
    p5.children[1].dismissable === true &&
    p5.children[1].children[0].type === "Dialog",
  { p5: kinds(p5), dismissable: p5?.children[1]?.dismissable },
);
record("L-6 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
