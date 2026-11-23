#!/usr/bin/env node
// S2 Modal size · CustomDialog · FullscreenDialog live (2026-11-23, S2 체크리스트 §9.3 6-5):
//   1. Components 패널 「custom dialog」 · 「fullscreen dialog」 → 두 원본 instance (DialogTrigger 루트)
//   2. Design 패널: custom = Size · Padding · Dismissible, fullscreen = Variant
//   3. Canvas (열림): custom M → Modal 480 · Dialog 480, L + padding none → 640 · padding 0,
//      fullscreen → Modal (20, 20) · 폭 = 화면 − 40, takeover → (0, 0) · 화면 전체 · 모서리 0
//   4. Publish: custom → Modal data-size L · 폭 640 · Dialog padding 0 · 닫기 버튼으로 닫힘,
//      fullscreen → Modal = 창 − 40 (사방 20), Cancel 로 닫힘
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-custom-dialog-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-custom-dialog-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** The Canvas boxes of every DialogTrigger's Modal · Dialog (by the trigger record id). */
const canvasBoxes = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const all = [...r.canvasInputs.values()];
    const below = (id, type) => {
      const stack = [id];
      while (stack.length) {
        const node = r.canvasInputs.get(stack.pop());
        if (!node) continue;
        if (r.typeOf(node) === type) return node;
        stack.push(...node.children);
      }
    };
    return all
      .filter((x) => r.typeOf(x) === "DialogTrigger")
      .map((trigger) => {
        const modal = below(trigger.id, "Modal");
        const dialog = below(trigger.id, "Dialog");
        const g = r.getGeometry([trigger.id, modal.id, dialog.id]);
        // (A Modal's rect is its parent's — the trigger's — coordinates; the page's = + the trigger's.)
        const at = g.get(trigger.id);
        const box = (b, page) =>
          b &&
          [
            b.x + (page ? at.x : 0),
            b.y + (page ? at.y : 0),
            b.width,
            b.height,
          ].map((v) => Math.round(v));
        return {
          trigger: trigger.id,
          size: modal.props.size,
          modal: box(g.get(modal.id), true),
          dialog: box(g.get(dialog.id)),
          modalRadius: modal.visual.radius,
          dialogPadding: dialog.visual.paddingTop ?? dialog.visual.paddingY,
        };
      });
  });

const setProps = (id, props) =>
  page.evaluate(
    ({ id, props }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      ws.execute(
        h.commands.setFields({
          targets: [ws.positionOfRecord(id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          label: "Dialog",
        }),
      );
    },
    { id, props },
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("custom dialog live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. Components panel.
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  for (const label of [/^custom dialog$/i, /^fullscreen dialog$/i]) {
    const item = page
      .locator("button, [role='button'], [role='option'], [role='gridcell']")
      .filter({ hasText: label })
      .first();
    await item.waitFor({ state: "visible", timeout: 15000 });
    await item.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/builder-palette.png` });
  const placed = await canvasBoxes();
  record(
    "1 Components 「custom dialog」 · 「fullscreen dialog」 → DialogTrigger 2 · Modal size M · fullscreen",
    placed.length === 2 &&
      placed[0].size === "M" &&
      placed[1].size === "fullscreen",
    placed,
  );
  const [custom, full] = placed.map((p) => p.trigger);

  // 2. Design panel.
  const designFields = async (id) => {
    await page.evaluate((id) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.selectItems([ws.itemOfRecord(id)]);
    }, id);
    if ((await components.getAttribute("aria-pressed")) === "true") {
      await components.click();
      await page.waitForTimeout(600);
    }
    const design = railButton(page, "properties");
    if ((await design.getAttribute("aria-pressed")) !== "true") {
      await design.click();
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(800);
    return (
      (await page
        .locator('.panel-wrapper[data-panel="properties"]')
        .textContent()) ?? ""
    );
  };
  const customPanel = await designFields(custom);
  await page.screenshot({ path: `${OUT}/builder-design-custom.png` });
  const fullPanel = await designFields(full);
  const wanted = {
    custom: ["Size", "Padding", "Dismissible"],
    full: ["Variant"],
  };
  record(
    "2 Design 패널: custom = Size · Padding · Dismissible, fullscreen = Variant",
    wanted.custom.every((label) => customPanel.includes(label)) &&
      wanted.full.every((label) => fullPanel.includes(label)),
    {
      missingCustom: wanted.custom.filter((l) => !customPanel.includes(l)),
      missingFull: wanted.full.filter((l) => !fullPanel.includes(l)),
    },
  );

  // 3. Canvas, opened (the trigger's own `isOpen`).
  await setProps(custom, { isOpen: true });
  await page.waitForTimeout(900);
  const m = (await canvasBoxes()).find((b) => b.trigger === custom);
  await page.screenshot({ path: `${OUT}/builder-canvas-custom-m.png` });
  await setProps(custom, { size: "L", padding: "none" });
  await page.waitForTimeout(900);
  const l = (await canvasBoxes()).find((b) => b.trigger === custom);
  await setProps(custom, { isOpen: false });
  await setProps(full, { isOpen: true });
  await page.waitForTimeout(900);
  const f = (await canvasBoxes()).find((b) => b.trigger === full);
  await page.screenshot({ path: `${OUT}/builder-canvas-fullscreen.png` });
  const viewport = await page.evaluate(
    () => window.__COMPOSITION_CATALOG__.workspace.root.viewport,
  );
  await setProps(full, { variant: "fullscreenTakeover" });
  await page.waitForTimeout(900);
  const t = (await canvasBoxes()).find((b) => b.trigger === full);
  await setProps(full, { isOpen: false, variant: "fullscreen" });
  await page.waitForTimeout(600);
  record(
    "3 Canvas: M 480 · L 640 + padding 0 · fullscreen 사방 20 · takeover 화면 전체 · 모서리 0",
    m.modal[2] === 480 &&
      m.dialog[2] === 480 &&
      m.modal[3] === m.dialog[3] &&
      m.modal[1] === Math.round((viewport.height - m.modal[3]) / 2) &&
      l.modal[2] === 640 &&
      l.dialog[2] === 640 &&
      l.dialogPadding === 0 &&
      f.modal[0] === 20 &&
      f.modal[1] === 20 &&
      f.modal[2] === viewport.width - 40 &&
      f.modal[3] === viewport.height - 40 &&
      f.dialog[2] === f.modal[2] &&
      t.modal[0] === 0 &&
      t.modal[2] === viewport.width &&
      t.modal[3] === viewport.height &&
      t.modalRadius === 0,
    { viewport, m, l, f, t },
  );

  // 4. Publish.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  const openCustom = pub.getByRole("button", { name: "Open dialog" }).first();
  await openCustom.waitFor({ timeout: 60000 });
  await pub.waitForTimeout(1200);
  await openCustom.click();
  await pub.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await pub.waitForTimeout(700);
  const readOpen = () =>
    pub.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const modal = dialog.closest(".react-aria-Modal");
      const rect = (el) => {
        const b = el.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height].map((v) => Math.round(v));
      };
      return {
        size: modal?.getAttribute("data-size"),
        padding: dialog.getAttribute("data-padding"),
        modal: modal && rect(modal),
        dialog: rect(dialog),
        dialogPadding: getComputedStyle(dialog).paddingTop,
        radius: modal && getComputedStyle(modal).borderTopLeftRadius,
      };
    });
  const customDom = await readOpen();
  await pub.screenshot({ path: `${OUT}/publish-custom.png` });
  await pub
    .locator('[role="dialog"] .dialog-close-button')
    .first()
    .click();
  await pub.waitForTimeout(800);
  const customClosed = (await pub.locator('[role="dialog"]').count()) === 0;
  await pub.getByRole("button", { name: "Open Fullscreen" }).first().click();
  await pub.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await pub.waitForTimeout(700);
  const fullDom = await readOpen();
  await pub.screenshot({ path: `${OUT}/publish-fullscreen.png` });
  await pub
    .locator('[role="dialog"] button')
    .filter({ hasText: "Cancel" })
    .first()
    .click();
  await pub.waitForTimeout(800);
  const fullClosed = (await pub.locator('[role="dialog"]').count()) === 0;
  record(
    "4 Publish: custom L 640 · padding 0 · 닫기 버튼, fullscreen 창 − 40 · Cancel 로 닫힘",
    customDom.size === "L" &&
      customDom.modal[2] === 640 &&
      customDom.dialog[2] === 640 &&
      customDom.padding === "none" &&
      customDom.dialogPadding === "0px" &&
      customClosed &&
      fullDom.size === "fullscreen" &&
      JSON.stringify(fullDom.modal) === JSON.stringify([20, 20, 1880, 1060]) &&
      fullDom.dialog[2] === 1880 &&
      fullDom.dialog[3] === 1060 &&
      fullClosed,
    { customDom, customClosed, fullDom, fullClosed },
  );
  await pub.close();
  record("5 page error 0", errors.length === 0, errors);
} catch (error) {
  record("error", false, String(error?.stack ?? error));
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
