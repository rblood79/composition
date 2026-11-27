#!/usr/bin/env node
// ADR-321 G3 live — Stepper · StepPanel (Phase 3, 사용자 결정 2 「넣는다」 · 자리 「감싸는 새 type」): 실제
// Builder 에서 팔레트로 Stepper 를 놓고 (StepList 3 단계 + StepPanel 3), 첫 패널 안에 Form 을 넣어
// Form 의 onSubmit 규칙이 목록의 「다음 단계」 를 실행하게 한 뒤
//   1. Builder Canvas: 지금 단계 (step-1) 의 패널만 그린다 (record hidden · Canvas 상자) · 목록과 패널 사이 16
//   2. 짝 명령: Design 「+」 = Step + StepPanel 한 key · 지금 단계를 새 단계로 → 그 패널 · Undo 둘
//      · Step 삭제 = 짝 패널도 · Undo
//   3. Publish: Stepper 는 role 없는 div · 자식 = RAC Group (단계 목록) + 지금 단계의 패널 하나 (group 밖)
//      · Canvas 상자 = DOM 상자 (Stepper · 목록 · 패널, ±1 px)
//   4. Publish: Form 제출 → 「다음 단계」 → 패널 2 · 단계 1 을 누르면 패널 1 (Form) 이 돌아온다
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5174 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr321-g3-live.mjs <out-dir> [--headless]
//   BROWSER=webkit 이면 Playwright WebKit 으로
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr321-g3-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};

/** The Stepper's records: its list's step keys, its panels as `key` (drawn) or `(key)` (hidden). */
const model = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = ws.root;
    const stepper = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Stepper",
    );
    const kids = stepper.children.map((id) => r.canvasInputs.get(id));
    const list = kids.find((x) => r.typeOf(x) === "StepList");
    const panels = kids.filter((x) => r.typeOf(x) === "StepPanel");
    return {
      stepper: stepper.id,
      stepperNode: stepper.sourceId,
      list: list.id,
      listNode: list.sourceId,
      steps: list.children.map((id) => String(r.canvasInputs.get(id).props.id)),
      stepRecords: list.children,
      panels: panels.map((p) =>
        p.hidden ? `(${p.props.itemId})` : String(p.props.itemId),
      ),
      panelRecords: panels.map((p) => p.id),
      panelNodes: panels.map((p) => p.sourceId),
    };
  });
const canvasBox = (recordId) =>
  page.evaluate((id) => {
    const b = window.__COMPOSITION_CATALOG__.canvas.boundsOf(id);
    return b && { x: b.x, y: b.y, w: b.width, h: b.height };
  }, recordId);

const openPublish = async () => {
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
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-StepList .step-link", {
    timeout: 60000,
  });
  await pub.waitForTimeout(700);
  return pub;
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr321 g3 live ${WEBKIT ? "webkit" : "chrome"}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  await openRail("components");
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: /^stepper$/i })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);

  // 1. Canvas: the current step's panel only.
  const start = await model();
  record(
    "1a origin + Canvas: only step-1's panel drawn",
    same(start.steps, ["step-1", "step-2", "step-3"]) &&
      same(start.panels, ["step-1", "(step-2)", "(step-3)"]),
    start,
  );
  const boxes = {
    stepper: await canvasBox(start.stepper),
    list: await canvasBox(start.list),
    panel: await canvasBox(start.panelRecords[0]),
  };
  const gap = boxes.panel.y - (boxes.list.y + boxes.list.h);
  record(
    "1b Canvas: list then panel, 16 apart",
    Math.abs(gap - 16) <= 1,
    boxes,
  );
  await page.screenshot({ path: `${OUT}/1-builder-canvas.png` });

  // 2. Pair commands.
  const pairs = await page.evaluate(
    async ({ listRecord }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const loaded = (path) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((entry) => new URL(entry).pathname === path)
          .at(-1) ?? path;
      const { catalogItemInsertChoices } = await import(
        loaded("/src/builder/catalogRuntime/itemInsert.ts")
      );
      const r = ws.root;
      const read = () => {
        const stepper = [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === "Stepper",
        );
        const kids = stepper.children.map((id) => r.canvasInputs.get(id));
        const list = kids.find((x) => r.typeOf(x) === "StepList");
        return {
          steps: list.children.map((id) =>
            String(r.canvasInputs.get(id).props.id),
          ),
          panels: kids
            .filter((x) => r.typeOf(x) === "StepPanel")
            .map((p) =>
              p.hidden ? `(${p.props.itemId})` : String(p.props.itemId),
            ),
          list,
        };
      };
      const out = {};
      const choices = catalogItemInsertChoices(
        { graph: ws.runtime.graph, readModel: ws.readModel, newId: ws.newId },
        ws.positionOfRecord(listRecord),
      );
      ws.execute(choices[0].build());
      out.added = read();
      const key = out.added.steps[3];
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(out.added.list.id).target],
          props: { defaultSelectedKey: { kind: "set", value: key } },
        }),
      );
      out.selected = read();
      ws.undo();
      ws.undo();
      out.undone = read();
      const second = out.undone.list.children[1];
      ws.execute(
        c.removeTargets({ targets: [ws.itemOfRecord(second).target] }),
      );
      out.removed = read();
      ws.undo();
      out.restored = read();
      for (const k of Object.keys(out)) delete out[k].list;
      out.key = key;
      return out;
    },
    { listRecord: start.list },
  );
  const k = pairs.key;
  record(
    "2 pair commands: 「+」 adds Step + panel (one key) · selecting it draws its panel · undo · delete takes the panel · undo",
    same(pairs.added.steps.length, 4) &&
      same(pairs.added.panels, ["step-1", "(step-2)", "(step-3)", `(${k})`]) &&
      same(pairs.selected.panels, ["(step-1)", "(step-2)", "(step-3)", k]) &&
      same(pairs.undone.panels, ["step-1", "(step-2)", "(step-3)"]) &&
      same(pairs.removed.steps, ["step-1", "step-3"]) &&
      same(pairs.removed.panels, ["step-1", "(step-3)"]) &&
      same(pairs.restored.panels, ["step-1", "(step-2)", "(step-3)"]),
    pairs,
  );

  // A Form in step 1's panel: its submit runs the list's 「다음 단계」. (Its fields made optional.)
  const formRecord = await page.evaluate(
    async ({ panelNode, listNode }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const loaded = (path) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((entry) => new URL(entry).pathname === path)
          .at(-1) ?? path;
      const { catalogInteractionsCommand, catalogNewInteraction } =
        await import(loaded("/src/builder/catalogRuntime/interactions.ts"));
      const { catalogPaletteDefinitionId } = await import(
        loaded("/src/builder/catalogRuntime/paletteInsert.ts")
      );
      const graph = ws.runtime.graph;
      const id = "project:node:g3-form";
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: panelNode },
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(graph.library, "Form"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      const owner = { ownerId: id };
      ws.execute(
        catalogInteractionsCommand(
          owner,
          [
            catalogNewInteraction(
              owner,
              "onSubmit",
              [
                {
                  opcode: "capability",
                  target: { nodeId: listNode },
                  capabilityId: "nextStep",
                },
              ],
              ws.newId,
            ),
          ],
          "Rules",
        ),
      );
      return ws.root.recordsOfSource(id)[0];
    },
    { panelNode: start.panelNodes[0], listNode: start.listNode },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/2-builder-form-in-panel.png` });

  // 3 · 4. Publish.
  const pub = await openPublish();
  const tree = await pub.evaluate((id) => {
    const box = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    return {
      tag: box?.tagName.toLowerCase(),
      role: box?.getAttribute("role"),
      children: [...(box?.children ?? [])].map((child) => ({
        role: child.getAttribute("role"),
        label: child.getAttribute("aria-label"),
        form: !!child.querySelector("form"),
        text: child.textContent.slice(0, 40),
      })),
    };
  }, start.stepper);
  record(
    "3a Publish: role-less div > RAC Group + step 1's panel (with the Form) outside the group",
    tree.tag === "div" &&
      tree.role === null &&
      tree.children.length === 2 &&
      tree.children[0].role === "group" &&
      tree.children[1].role === null &&
      tree.children[1].form,
    tree,
  );
  const domBox = (id) =>
    pub.evaluate((id) => {
      const el = document.querySelector(
        `[data-catalog-id="${CSS.escape(id)}"]`,
      );
      const b = el?.getBoundingClientRect();
      return b && { x: b.x, y: b.y, w: b.width, h: b.height };
    }, id);
  const canvasNow = {
    stepper: await canvasBox(start.stepper),
    list: await canvasBox(start.list),
    panel: await canvasBox(start.panelRecords[0]),
  };
  const dom = {
    stepper: await domBox(start.stepper),
    list: await domBox(start.list),
    panel: await domBox(start.panelRecords[0]),
  };
  const rel = (set) =>
    Object.fromEntries(
      Object.entries(set).map(([key, b]) => [
        key,
        b && {
          x: Math.round(b.x - set.stepper.x),
          y: Math.round(b.y - set.stepper.y),
          w: Math.round(b.w),
          h: Math.round(b.h),
        },
      ]),
    );
  const a = rel(canvasNow);
  const b = rel(dom);
  // (The Canvas page is 1920 wide, the Publish window 1600: widths are compared as the Stepper's.)
  const near = Object.keys(a).every(
    (key) =>
      ["x", "y", "h"].every(
        (axis) => Math.abs(a[key][axis] - b[key][axis]) <= 1,
      ) && Math.abs(a[key].w / a.stepper.w - b[key].w / b.stepper.w) < 0.002,
  );
  record(
    "3b Canvas box = Publish box (Stepper · list · panel with its Form — y · height ±1 px, width as the Stepper's)",
    near,
    { canvas: a, dom: b },
  );
  await pub.screenshot({ path: `${OUT}/3-publish-start.png` });

  const panelsShown = () =>
    pub.evaluate((id) => {
      const box = document.querySelector(
        `[data-catalog-id="${CSS.escape(id)}"]`,
      );
      return [...box.children]
        .filter((child) => child.getAttribute("role") !== "group")
        .map((child) =>
          child.querySelector("form") ? "form" : child.textContent,
        );
    }, start.stepper);
  // Fill the Form's text fields (a required one would hold the submit), then submit with its button.
  await pub.evaluate((id) => {
    for (const input of document.querySelectorAll(
      `[data-catalog-id="${CSS.escape(id)}"] input`,
    ))
      input.removeAttribute("required");
  }, formRecord);
  const submit = pub.locator(
    `[data-catalog-id="${formRecord}"] button[type="submit"]`,
  );
  const before = await panelsShown();
  await submit.first().click();
  await pub.waitForTimeout(400);
  const afterSubmit = await panelsShown();
  const states = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Step")].map((li) =>
      li.getAttribute("data-step-state"),
    ),
  );
  await pub.screenshot({ path: `${OUT}/4-publish-after-submit.png` });
  await pub.locator(".react-aria-StepList .step-link").nth(0).click();
  await pub.waitForTimeout(400);
  const back = await panelsShown();
  record(
    "4 Form 제출 → 다음 단계 (패널 2, step-1 완료) · 단계 1 누르기 → Form 의 패널",
    same(before, ["form"]) &&
      same(afterSubmit, ["Step 2 content"]) &&
      same(states, ["completed", "current", "incomplete"]) &&
      same(back, ["form"]),
    { before, afterSubmit, states, back },
  );
  await pub.close();
} catch (error) {
  record("run", false, String(error?.stack ?? error));
} finally {
  record("5 page error 0", errors.length === 0, errors);
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n${failed ? "FAILED" : "ALL PASS"} ${results.length - failed}/${results.length}\n`,
  );
  process.exit(failed ? 1 : 0);
}
