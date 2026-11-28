#!/usr/bin/env node
// ADR-326 G5 live — 대칭 하니스 (breakdown §4.5 · §7 G5 · HC2 · R2 · R8 · R9). 실제 Builder 에서 Cascader 를
// 놓고 Open 으로 연 Canvas 의 막 연 화면과, 같은 문서의 Preview (누르지 않은 시작 열림) 를 Chrome · WebKit 으로
// 대조한다. 기대값: 두 쪽이 같다 (±1 px) — 이 파일의 판정이 정본이다.
//   방식 (columns · tree · drill) × 시작 값 (없음 · 깊은 값 laptops) × 크기 (S · M · XL) — 원본 항목
//   방식 × 표본 창 밖 값 (루트 150 × 자식 1 연결, 값 R150-1 — Builder 의 표본 창 100 밖) — M
//   각 조합: 열린 상자 크기 · 보이는 행 (상자 안 — HC2) 의 key 순서 · 행 rect · 라벨 rect · check 표시 행 ·
//   drill 의 경로 조각 글자 · 폴더 메뉴 · 「뒤로」 rect (모두 열린 상자 기준)
//   가지 선택 (tree computers · drill laptops · computers — drill 단계의 「전체」 줄) · 「뒤로」 비활성
//   R9: tree · laptops 에서 Desktops (잎) · Computers (열린 가지) 항목에 배경을 쓰면 그 행만 칠해짐 — Canvas 의
//       칠 높이 = Preview 의 행 높이 (열린 가지의 자식 줄은 칠하지 않음) · 열린 가지의 opacity 0.5 도 그 줄만 (화면
//       픽셀) · Undo 로 사라짐
//   console error 0 · page error 0 (WebKit 의 Builder ProgressCircle 오류는 known — 이 ADR 밖)
//
//   BROWSER=webkit BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr326-g5-live.mjs <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { createRequire } from "node:module";
import { railButton } from "./railButton.mjs";

const { PNG } = createRequire(import.meta.url)(
  `${process.cwd()}/node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs`,
);

const OUT = process.argv[2] ?? "/private/tmp/adr326-g5-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");
const WEBKIT = process.env.BROWSER === "webkit";
const NAME = WEBKIT ? "webkit" : "chrome";
const COMMANDS = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const PAINT = "rgb(255, 0, 0)";
// (ONLY=<regex> — the combos whose name matches, no R9; ONLY=R9 — R9 alone: a RED run of one repair.)
const R9_ONLY = process.env.ONLY === "R9";
const ONLY = process.env.ONLY && !R9_ONLY ? new RegExp(process.env.ONLY) : null;

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} [${NAME}] ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

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
const consoleErrors = [];
const watch = (p, who) => {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      consoleErrors.push(`${who}: ${m.text().slice(0, 200)}`);
  });
};
const page = await context.newPage();
watch(page, "builder");
const settle = (p, ms = 250) => p.waitForTimeout(ms);
const near = (a, b) => Math.abs(a - b) <= 1;
const sameRect = (a, b) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => near(v, b[i]));

/** The Canvas's open box of a field (by its label): rows in the box, their rects, the trail. */
const canvasView = (p, label) =>
  p.evaluate((label) => {
    const h = window.__COMPOSITION_CATALOG__;
    const root = h.workspace.root;
    const records = root.canvasInputs;
    const typeOf = (r) => root.typeOf(r);
    const drawn = (r) => {
      for (let c = r; c; c = records.get(c.parentId)) if (c.hidden) return false;
      return true;
    };
    const field = [...records.values()].find(
      (r) => typeOf(r) === "Cascader" && r.props.label === label,
    );
    const popover = field.children
      .map((id) => records.get(id))
      .find((r) => r && typeOf(r) === "Popover");
    if (!popover || !drawn(popover)) return { open: false };
    const box = h.canvas.boundsOf(popover.id);
    const rel = (b) =>
      b && [b.x - box.x, b.y - box.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
    const list = popover.children
      .map((id) => records.get(id))
      .find((r) => r && typeOf(r) === "CascaderList");
    const listBox = h.canvas.boundsOf(list.id);
    const rows = [];
    const visit = (id) => {
      const item = records.get(id);
      if (!item || typeOf(item) !== "CascaderItem" || !drawn(item)) return;
      const state = item.derivedProps?._cascaderRow;
      if (state === "row" || state === "open") {
        const whole = h.canvas.boundsOf(item.id);
        const part = root.getGeometry([`${item.id}::part:cascader-row`]).get(`${item.id}::part:cascader-row`);
        const rowBox = part ? { ...whole, height: part.height } : whole;
        // (A row in the list box's clip — the Preview's first screen, HC2.)
        if (rowBox.y < listBox.y + listBox.height - 1) {
          const parts = item.children.map((c) => records.get(c)).filter(Boolean);
          const labelPart = parts.find((c) => c.props.slot === "label");
          const check = parts.find((c) => c.props.slot === "selection");
          rows.push({
            // (A drill level's own row shows the level name — its label's derived words.)
            key: String(labelPart.derivedProps?.children ?? item.props.label),
            row: rel(rowBox),
            label: rel(h.canvas.boundsOf(labelPart.id)),
            checked: !!check && drawn(check) && check.derivedProps?._selectionMarkHidden === false,
          });
        }
      }
      item.children.forEach(visit);
    };
    list.children.forEach(visit);
    const trail = popover.children
      .map((id) => records.get(id))
      .find((r) => r && typeOf(r) === "Breadcrumbs");
    const shownCrumbs =
      trail && drawn(trail)
        ? trail.children
            .map((id) => records.get(id))
            .filter((c) => c && drawn(c) && !root.breadcrumbCollapsed(c.id))
        : [];
    const crumbs = shownCrumbs.map((c) => {
      const text = c.children
        .map((id) => records.get(id))
        .find((t) => t && typeOf(t) === "Text");
      return text?.derivedProps?.children ?? text?.props.children;
    });
    const crumbRects = shownCrumbs.map((c) => rel(h.canvas.boundsOf(c.id)));
    // (The folder menu box — a layout leaf after the first crumb, `settleBreadcrumbs`.)
    const menu = trail && root.breadcrumbMenuInputs.get(trail.id);
    const trailBox = trail && drawn(trail) ? h.canvas.boundsOf(trail.id) : null;
    const menuRect =
      menu && trailBox
        ? (() => {
            const m = root.getGeometry([menu.id]).get(menu.id);
            return m && rel({ x: trailBox.x + m.x, y: trailBox.y + m.y, width: m.width, height: m.height });
          })()
        : null;
    const back = popover.children
      .map((id) => records.get(id))
      .find((r) => r && r.props.slot === "back");
    return {
      open: true,
      box: [Math.round(box.width), Math.round(box.height)],
      rows,
      crumbs,
      folder: !!menu,
      crumbRects,
      menuRect,
      back: back && drawn(back) ? rel(h.canvas.boundsOf(back.id)) : null,
      backDisabled: !!back && back.derivedProps?._fieldDisabled === true,
    };
  }, label);

/** The Preview's open box of a field — the same reading of the DOM. */
const domView = (p, label) =>
  p.evaluate((label) => {
    const field = [...document.querySelectorAll(".react-aria-Cascader")].find(
      (el) => el.querySelector(".react-aria-Label")?.textContent?.startsWith(label),
    );
    const pops = [...document.querySelectorAll('.react-aria-Popover[data-trigger="Cascader"]')];
    const pop = pops[0];
    if (!field || !pop) return { open: false, pops: pops.length };
    const box = pop.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return [r.x - box.x, r.y - box.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
    };
    const list = pop.querySelector(".react-aria-CascaderList");
    const listBox = list.getBoundingClientRect();
    const rows = [...list.querySelectorAll(".react-aria-CascaderItem")]
      .filter((row) => {
        const r = row.getBoundingClientRect();
        return r.height > 0 && r.y < listBox.y + listBox.height - 1;
      })
      .map((row) => {
        const label = row.querySelector('.react-aria-Text[slot="label"]');
        const check = row.querySelector('.react-aria-Icon[slot="selection"]');
        return {
          key: label?.textContent ?? "",
          row: rel(row),
          label: label ? rel(label) : null,
          checked: !!check && getComputedStyle(check).visibility === "visible",
        };
      });
    const trail = pop.querySelector(".react-aria-Breadcrumbs");
    const shown = trail
      ? [...trail.querySelectorAll(".react-aria-Breadcrumb:not(.breadcrumb-menu)")]
      : [];
    const crumbs = shown.map((c) => c.textContent?.trim());
    const folderEl = trail?.querySelector(".breadcrumb-menu");
    const back = pop.querySelector('[slot="back"]');
    return {
      open: true,
      box: [Math.round(box.width), Math.round(box.height)],
      rows,
      crumbs,
      crumbRects: shown.map(rel),
      // (The folder's ActionButton — the Canvas's menu box is the button, its separator after it.)
      menuRect: folderEl ? rel(folderEl.querySelector("button") ?? folderEl) : null,
      folder: !!folderEl,
      back: back && getComputedStyle(back).display !== "none" ? rel(back) : null,
      backDisabled: !!back && back.disabled === true,
    };
  }, label);

const compare = (canvas, dom) => {
  const why = [];
  if (!canvas.open || !dom.open) why.push("open");
  if (canvas.open && dom.open) {
    if (!sameRect(canvas.box, dom.box)) why.push("box");
    const keys = (v) => v.rows.map((r) => r.key).join("|");
    if (keys(canvas) !== keys(dom)) why.push("keys");
    else
      canvas.rows.forEach((row, i) => {
        const other = dom.rows[i];
        if (!sameRect(row.row, other.row)) why.push(`row:${row.key}`);
        if (!sameRect(row.label, other.label)) why.push(`label:${row.key}`);
        if (row.checked !== other.checked) why.push(`check:${row.key}`);
      });
    if (JSON.stringify(canvas.crumbs) !== JSON.stringify(dom.crumbs)) why.push("crumbs");
    if (canvas.folder !== dom.folder) why.push("folder");
    else if (canvas.folder && !sameRect(canvas.menuRect?.slice(0, 2), dom.menuRect?.slice(0, 2)))
      why.push("folder-place");
    if (
      canvas.crumbRects.length !== dom.crumbRects.length ||
      canvas.crumbRects.some((r, i) => !sameRect(r?.slice(0, 2), dom.crumbRects[i]?.slice(0, 2)))
    )
      why.push("crumb-place");
    if (!!canvas.back !== !!dom.back || (canvas.back && !sameRect(canvas.back, dom.back)))
      why.push("back");
    if (canvas.backDisabled !== dom.backDisabled) why.push("back-disabled");
  }
  return why;
};

/** Set one field's props (by its label) in the Builder. */
const setField = (p, label, props) =>
  p.evaluate(
    async ({ COMMANDS, label, props }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const field = [...ws.root.domInputs.values()].find(
        (r) => ws.root.typeOf(r) === "Cascader" && r.props.label === label,
      );
      ws.execute(
        c.setFields({
          targets: [ws.itemOfRecord(field.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
        }),
      );
    },
    { COMMANDS, label, props },
  );

/** Open the Preview, read a field's open box, close it. */
const preview = async (label) => {
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  watch(pub, "publish");
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('.react-aria-Popover[data-trigger="Cascader"]', { timeout: 60000 });
  await settle(pub, 1200);
  const view = await domView(pub, label);
  return { pub, view };
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(page, 300);
  await page.keyboard.type(`adr326 g5 live ${NAME}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.canvas, null, {
    timeout: 30000,
  });
  await settle(page, 1500);
  const rail = railButton(page, "components");
  if ((await rail.getAttribute("aria-pressed")) === "true") {
    await rail.click();
    await settle(page, 600);
  }
  // (One field at a time on the page — the Preview opens it alone: a static one and a bound one.)
  await page.evaluate(
    async ({ COMMANDS }) => {
      const c = await import(COMMANDS);
      const h = window.__COMPOSITION_CATALOG__;
      const b = h.binding;
      const ws = h.workspace;
      const r = ws.root;
      const ctx = {
        graph: ws.runtime.graph,
        records: ws.root.domInputs,
        selection: () => [],
        itemOfRecord: (i) => ws.itemOfRecord(i),
        pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
        newId: ws.newId,
      };
      const add = (type) => {
        const before = new Set(r.canvasInputs.keys());
        ws.execute(h.palette.catalogPaletteInsertPlan(ctx, type).command);
        return [...r.canvasInputs.values()].find(
          (x) => r.typeOf(x) === type && !before.has(x.id),
        ).sourceId;
      };
      const set = (id, props, visual) =>
        ws.execute(
          c.setFields({
            targets: [{ kind: "node", id }],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
            ),
            ...(visual
              ? {
                  visual: Object.fromEntries(
                    Object.entries(visual).map(([k, v]) => [k, { kind: "set", value: v }]),
                  ),
                }
              : {}),
          }),
        );
      const rows = [];
      for (let i = 1; i <= 150; i++) {
        rows.push({ id: `R${i}`, name: `Root ${i}`, parent: null });
        rows.push({ id: `R${i}-1`, name: `Child ${i}`, parent: `R${i}` });
      }
      ws.execute(
        c.setDataEntries({
          puts: [
            {
              kind: "collection",
              id: "data:collection:g5",
              name: "g5",
              schema: [
                { id: "g5-id", key: "id", type: "string" },
                { id: "g5-name", key: "name", type: "string" },
                { id: "g5-parent", key: "parent", type: "string" },
              ],
              keyField: "g5-id",
              mockData: rows,
              useMockData: true,
            },
          ],
          label: "g5 rows",
        }),
      );
      // (A six-level chain D1 > … > D6 — a `drill` trail longer than its four positions.)
      ws.execute(
        c.setDataEntries({
          puts: [
            {
              kind: "collection",
              id: "data:collection:g5deep",
              name: "g5deep",
              schema: [
                { id: "g5d-id", key: "id", type: "string" },
                { id: "g5d-name", key: "name", type: "string" },
                { id: "g5d-parent", key: "parent", type: "string" },
              ],
              keyField: "g5d-id",
              mockData: [1, 2, 3, 4, 5, 6].flatMap((n) => [
                { id: `D${n}`, name: `Deep ${n}`, parent: n === 1 ? null : `D${n - 1}` },
                { id: `E${n}`, name: `Else ${n}`, parent: n === 1 ? null : `D${n - 1}` },
              ]),
              useMockData: true,
            },
          ],
          label: "g5 deep rows",
        }),
      );
      const field = add("Cascader");
      set(field, { label: "Static" }, { width: 260 });
      const deep = add("Cascader");
      ws.execute(
        b.catalogBindingCommand(
          [{ kind: "node", id: deep }],
          {
            collectionId: "data:collection:g5deep",
            fieldMap: {
              value: "data:field:g5d-id",
              label: "data:field:g5d-name",
              parentId: "data:field:g5d-parent",
            },
          },
          ws.newId,
        ),
      );
      set(deep, { label: "Deep", defaultValue: "D6", mode: "drill" }, { width: 260 });
      const bound = add("Cascader");
      ws.execute(
        b.catalogBindingCommand(
          [{ kind: "node", id: bound }],
          {
            collectionId: "data:collection:g5",
            fieldMap: {
              value: "data:field:g5-id",
              label: "data:field:g5-name",
              parentId: "data:field:g5-parent",
            },
          },
          ws.newId,
        ),
      );
      set(bound, { label: "Bound", defaultValue: "R150-1" }, { width: 260 });
    },
    { COMMANDS },
  );
  await settle(page, 1200);

  const combos = [];
  for (const mode of ["columns", "tree", "drill"])
    for (const value of ["", "laptops"])
      for (const size of ["S", "M", "XL"])
        combos.push({ label: "Static", mode, value, size });
  for (const mode of ["columns", "tree", "drill"])
    combos.push({ label: "Bound", mode, value: "R150-1", size: "M" });
  // (Any level picks: a picked branch's row checked in a tree, a drill level's 「<branch> 전체」 row.)
  combos.push({ label: "Static", mode: "tree", value: "computers", size: "M", branch: true });
  combos.push({ label: "Static", mode: "drill", value: "laptops", size: "M", branch: true });
  combos.push({ label: "Static", mode: "drill", value: "computers", size: "M", branch: true });
  // (A trail of seven crumbs — its positions hold the first and the last two, the folder the rest.)
  for (const width of [260, 600])
    combos.push({ label: "Deep", mode: "drill", value: "D6", size: "M", width });

  for (const combo of combos) {
    const { label, mode, value, size, width, branch = false } = combo;
    const name = `${label} ${mode} ${value || "값 없음"} ${size}${width ? ` ${width}` : ""}${branch ? " 가지 선택" : ""}`;
    if (R9_ONLY || (ONLY && !ONLY.test(name)))
      continue;
    // (Only this field open — the others closed.)
    for (const other of ["Static", "Bound", "Deep"])
      if (other !== label) await setField(page, other, { isOpen: false });
    await setField(page, label, {
      mode,
      defaultValue: value,
      size,
      allowsBranchSelection: branch,
      isOpen: true,
    });
    if (width)
      await page.evaluate(
        async ({ COMMANDS, label, width }) => {
          const c = await import(COMMANDS);
          const ws = window.__COMPOSITION_CATALOG__.workspace;
          const field = [...ws.root.domInputs.values()].find(
            (r) => ws.root.typeOf(r) === "Cascader" && r.props.label === label,
          );
          ws.execute(
            c.setFields({
              targets: [ws.itemOfRecord(field.id).target],
              visual: { width: { kind: "set", value: width } },
            }),
          );
        },
        { COMMANDS, label, width },
      );
    await settle(page, 900);
    const canvas = await canvasView(page, label);
    const { pub, view } = await preview(label);
    const why = compare(canvas, view);
    const id = name;
    record(id, !why.length && canvas.rows.length > 0, {
      why,
      ...(why.length ? { canvas, dom: view } : { rows: canvas.rows.map((r) => r.key), crumbs: canvas.crumbs }),
    });
    if (why.length) {
      const slug = id.replace(/\s+/g, "-");
      await pub.screenshot({ path: `${OUT}/${NAME}-${slug}-preview.png` });
      await page.screenshot({ path: `${OUT}/${NAME}-${slug}-builder.png` });
    }
    await pub.close();
  }

  if (ONLY) throw new Error("ONLY — no R9");
  // R9 — one item's look edit reaches its row only (both sides) · Undo takes it away.
  for (const other of ["Bound", "Deep"]) await setField(page, other, { isOpen: false });
  await setField(page, "Static", {
    mode: "tree",
    defaultValue: "laptops",
    size: "M",
    allowsBranchSelection: false,
    isOpen: true,
  });
  await page.evaluate(async (COMMANDS) => {
    const c = await import(COMMANDS);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    // (A leaf row and an open branch's row — its items' rows below it keep theirs.)
    const items = [...ws.root.domInputs.values()].filter(
      (r) =>
        ws.root.typeOf(r) === "CascaderItem" &&
        ["Desktops", "Computers"].includes(String(r.props.label)),
    );
    ws.execute(
      c.setFields({
        targets: items.map((item) => ws.itemOfRecord(item.id).target),
        visual: { backgroundColor: { kind: "set", value: "#ff0000" } },
      }),
    );
    // (The open branch half seen — its row only, the DOM's row element: not its items' rows.)
    ws.execute(
      c.setFields({
        targets: [ws.itemOfRecord(items.find((r) => r.props.label === "Computers").id).target],
        visual: { opacity: { kind: "set", value: 0.5 } },
      }),
    );
  }, COMMANDS);
  await settle(page, 900);
  const CANVAS = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/canvasBinding.ts`;
  const paints = () =>
    page.evaluate(async (CANVAS) => {
      const { catalogCanvasNodeData, catalogCascaderRowData } = await import(CANVAS);
      const h = window.__COMPOSITION_CATALOG__;
      const root = h.workspace.root;
      // (The painted box of each painted row: an open branch's is its row — 32, not its items'.)
      return [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === "CascaderItem" && !r.hidden)
        .filter((r) => r.visual?.backgroundColor !== undefined)
        .map((r) => {
          // (Its box paint's height — its own box, or an open branch's row node: `cascaderRowOf`.)
          const data =
            catalogCascaderRowData(root, r) ?? catalogCanvasNodeData(root, r.id);
          const box = data.box ? data : undefined;
          return [String(r.props.label), Math.round(box?.height ?? -1)];
        })
        .sort();
    }, CANVAS);
  const painted = await paints();
  // (The drawn pixels: the open branch's row red, its item's row under it not — the right end of
  //  each row, off the words.)
  const points = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const root = h.workspace.root;
    const cam = h.canvas.camera();
    const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
    const at = (label) => {
      const item = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "CascaderItem" && r.props.label === label,
      );
      const box = h.canvas.boundsOf(item.id);
      return {
        x: rect.left + cam.x + (box.x + box.width - 12) * cam.zoom,
        y: rect.top + cam.y + (box.y + 16) * cam.zoom,
      };
    };
    return { Computers: at("Computers"), Laptops: at("Laptops") };
  });
  const shot = PNG.sync.read(await page.screenshot());
  const pixel = ({ x, y }) => {
    const i = (Math.round(y) * shot.width + Math.round(x)) * 4;
    return [shot.data[i], shot.data[i + 1], shot.data[i + 2]];
  };
  const red = (c) => c[0] > 200 && c[1] < 60 && c[2] < 60;
  const pixels = { Computers: pixel(points.Computers), Laptops: pixel(points.Laptops) };
  const { pub, view } = await preview("Static");
  const domPainted = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-CascaderItem")]
      .filter((row) => getComputedStyle(row).backgroundColor === "rgb(255, 0, 0)")
      .map((row) => [
        row.querySelector('[slot="label"]')?.textContent,
        Math.round(row.getBoundingClientRect().height),
      ])
      .sort(),
  );
  await pub.close();
  // (A child leaf of the open branch removed: the branch's row stays drawn — its row node is no
  //  record, a structure edit around it binds again — Stop 판독.)
  await page.evaluate(async (COMMANDS) => {
    const c = await import(COMMANDS);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const leaf = [...ws.root.domInputs.values()].find(
      (r) => ws.root.typeOf(r) === "CascaderItem" && r.props.label === "Desktops",
    );
    ws.execute(c.removeTargets({ targets: [ws.itemOfRecord(leaf.id).target] }));
  }, COMMANDS);
  await settle(page, 900);
  const shotAfter = PNG.sync.read(await page.screenshot());
  const pixelAfter = ({ x, y }) => {
    const i = (Math.round(y) * shotAfter.width + Math.round(x)) * 4;
    return [shotAfter.data[i], shotAfter.data[i + 1], shotAfter.data[i + 2]];
  };
  const afterRemove = pixelAfter(
    await page.evaluate(() => {
      const h = window.__COMPOSITION_CATALOG__;
      const root = h.workspace.root;
      const cam = h.canvas.camera();
      const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
      const item = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "CascaderItem" && r.props.label === "Computers",
      );
      const box = h.canvas.boundsOf(item.id);
      return {
        x: rect.left + cam.x + (box.x + box.width - 12) * cam.zoom,
        y: rect.top + cam.y + (box.y + 16) * cam.zoom,
      };
    }),
  );
  await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.undo();
    ws.undo();
    ws.undo();
  });
  await settle(page, 900);
  const undone = await paints();
  record(
    "R9 Desktops · 열린 가지 Computers 배경 → 그 행만 (Canvas 칠 높이 = Preview 행) · Undo → 없음",
    JSON.stringify(painted) === '[["Computers",32],["Desktops",32]]' &&
      // (Half red over white: the open branch's row; its item's row under it untouched.)
      pixels.Computers[0] > 240 &&
      pixels.Computers[1] > 100 &&
      pixels.Computers[1] < 160 &&
      JSON.stringify(pixels.Laptops) === "[255,255,255]" &&
      afterRemove[0] > 240 &&
      afterRemove[1] > 100 &&
      afterRemove[1] < 160 &&
      JSON.stringify(domPainted) === JSON.stringify(painted) &&
      undone.length === 0 &&
      view.open,
    { painted, domPainted, undone, pixels, afterRemove, PAINT },
  );
} catch (error) {
  if (!String(error).includes("ONLY — no R9"))
    record("harness", false, { error: String(error?.stack ?? error) });
} finally {
  const KNOWN = /Invalid value for <circle> attribute r="calc\(/;
  const other = consoleErrors.filter((e) => !KNOWN.test(e));
  record("console error 0 · page error 0", !errors.length && !other.length, {
    errors,
    consoleErrors: other,
    known: consoleErrors.length - other.length,
  });
  writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(`\n[${NAME}] ${failed ? `FAIL ${failed}` : `ALL PASS ${results.length}`}\n`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
