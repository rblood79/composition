#!/usr/bin/env node
// ADR-326 Phase 0 — 시제품 P1 · P2 · P3 · P6 의 go / no-go 를 실제 브라우저에서 판정한다 (breakdown §6).
//   node apps/builder/scripts/adr326-phase0-prototypes.mjs <out-dir> [--only p1,p3,p6] [--browser chrome,webkit]
// `adr326Prototypes.mjs` 를 production lib build 해 빈 페이지에 올린다 (headless · DPR 1).
// 기준값 = 지금의 조립 (arm a — ADR-322 G2 · G3 가 닫은 동작) 의 실제 브라우저 관찰. 새 조립 (arm b) 이 같은
// 키 순서에서 같은 focus · 열림 · 값 · 접근 이름을 내면 go. P6 의 기준 = 「crumb 을 전부 그린 Breadcrumbs」.
// 접근성 트리: Chrome 은 브라우저의 것 (CDP `Accessibility.getFullAXTree`), WebKit 은 Playwright 의
// `ariaSnapshot` (DOM 에서 계산한 값 — 브라우저 트리 아님, WebKit 의 실제 낭독은 G6 VoiceOver 청취).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr326-phase0";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const ONLY = arg("--only", null)?.split(",");
const BROWSERS = (arg("--browser", "chrome,webkit") ?? "").split(",");

const { build } = await import("vite");
await build({
  configFile: false,
  logLevel: "warn",
  root: `${REPO}/apps/builder`,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: `${REPO}/apps/builder/scripts/adr326Prototypes.mjs`,
      formats: ["es"],
      fileName: () => "prototypes.js",
    },
    outDir: `${OUT}/site`,
    emptyOutDir: true,
    minify: true,
  },
});
writeFileSync(
  `${OUT}/site/index.html`,
  `<!doctype html><meta charset="utf-8"><title>adr326</title>
<style>body{margin:16px;font:14px system-ui}
[role=menu],[role=treegrid],[role=grid]{background:#fff;border:1px solid #999;min-width:200px;max-height:420px;overflow:auto}
[role=menuitemradio],[role=menuitem],[role=row]{display:block;padding:2px 8px}
.react-aria-Popover{background:#fff}
.react-aria-Breadcrumbs{display:flex;gap:8px;list-style:none;margin:0;padding:0;white-space:nowrap;overflow:hidden;font:14px system-ui}
.react-aria-Breadcrumb{flex-shrink:0;display:flex;align-items:center}
body[data-fixed] .react-aria-Breadcrumb:not(.breadcrumb-menu){width:60px;overflow:hidden}
:focus-visible,[data-focus-visible],[data-focused]{outline:2px solid orange}
</style><body>
<script type="module">import { mount } from "./prototypes.js"; window.__mount = mount;</script>`,
);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const file = join(`${OUT}/site`, path === "/" ? "index.html" : path);
  if (!existsSync(file) || path === "/favicon.ico") {
    res.writeHead(path === "/favicon.ico" ? 204 : 404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type":
      { ".js": "text/javascript", ".html": "text/html" }[extname(file)] ??
      "application/octet-stream",
  });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const URL_BASE = `http://127.0.0.1:${server.address().port}/`;

const settle = (page, frames = 6) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const tick = (left) =>
          left ? requestAnimationFrame(() => tick(left - 1)) : resolve();
        tick(n);
      }),
    frames,
  );
const mount = async (page, kind, cfg) => {
  await page.goto(URL_BASE);
  await page.waitForFunction(() => typeof window.__mount === "function");
  await page.evaluate(
    ([k, c]) => window.__mount({ kind: k, cfg: c }),
    [kind, cfg],
  );
  await page.waitForFunction(() => window.__ready === true);
  await settle(page, 8);
};
const press = async (page, key) => {
  await page.keyboard.press(key);
  await settle(page);
};

/** One observation: focus, what is open, the virtual focus, the field's value. */
const observe = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const name = (node) => {
      if (!node) return null;
      const by = node.getAttribute("aria-labelledby");
      if (by)
        return by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? `#${id}?`)
          .join(" ");
      return node.getAttribute("aria-label");
    };
    const focus =
      !el || el === document.body
        ? "body"
        : (el.getAttribute("data-part") ??
          el.closest("[data-part]")?.getAttribute("data-part") ??
          `${el.tagName.toLowerCase()}[${el.getAttribute("role") ?? ""}]`);
    const active = el?.getAttribute("aria-activedescendant");
    const popover = document.querySelector('[data-part="popover"]');
    const list = document.querySelector(
      '[data-part="list"], [data-part="results"]',
    );
    const dialog = document.querySelector('[role="dialog"]');
    const trigger = document.querySelector('[data-part="trigger"]');
    const controls = trigger?.getAttribute("aria-controls");
    return {
      focus,
      virtual: active
        ? (document.getElementById(active)?.getAttribute("data-part") ?? "?")
        : null,
      menus: document.querySelectorAll('[role="menu"]').length,
      expanded: [
        ...document.querySelectorAll('[role="row"][aria-expanded="true"]'),
      ]
        .map((row) => row.getAttribute("data-part"))
        .sort(),
      popover: popover
        ? { role: popover.getAttribute("role"), name: name(popover) }
        : null,
      dialog: dialog
        ? { name: name(dialog), part: dialog.getAttribute("data-part") }
        : null,
      list: list ? { role: list.getAttribute("role"), name: name(list) } : null,
      trigger: {
        expanded: trigger?.getAttribute("aria-expanded"),
        haspopup: trigger?.getAttribute("aria-haspopup"),
        controls: controls
          ? (document.getElementById(controls)?.getAttribute("role") ??
            document.getElementById(controls)?.getAttribute("data-part") ??
            "missing")
          : null,
        name: name(trigger),
      },
      state: window.__state(),
    };
  });
/** Chrome's own accessibility tree — the roles a screen reader gets, with their names. */
const axTree = async (page, browser) => {
  if (browser !== "chrome")
    return {
      source: "ariaSnapshot (DOM)",
      tree: await page.locator("body").ariaSnapshot(),
    };
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const keep = new Set([
    "dialog",
    "menu",
    "tree",
    "searchbox",
    "treeitem",
    "menuitem",
    "menuitemradio",
    "grid",
    "row",
  ]);
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const parentRole = (node) => {
    for (let at = byId.get(node.parentId); at; at = byId.get(at.parentId))
      if (keep.has(at.role?.value) && !at.ignored) return at.role.value;
    return null;
  };
  return {
    source: "CDP getFullAXTree",
    tree: nodes
      .filter((node) => !node.ignored && keep.has(node.role?.value))
      .map(
        (node) =>
          `${node.role.value}:${node.name?.value ?? ""} < ${parentRole(node) ?? "-"}`,
      ),
  };
};

const SELECTORS = { trigger: '[data-part="trigger"]' };
/** The same key script for both arms — what the arms must answer the same way. */
const SCRIPTS = {
  columns: async (page, log) => {
    await page.locator(SELECTORS.trigger).focus();
    await press(page, "Enter");
    log("open (Enter)", await observe(page));
    await press(page, "ArrowDown");
    log("↓", await observe(page));
    await press(page, "ArrowRight");
    log("→ (sub-level)", await observe(page));
    await press(page, "ArrowRight");
    log("→ (third level)", await observe(page));
    await press(page, "Enter");
    log("Enter (pick 역삼동)", await observe(page));
    await press(page, "Enter");
    log("reopen", await observe(page));
    await press(page, "ArrowDown");
    await press(page, "ArrowRight");
    await press(page, "Escape");
    log("→ then Esc", await observe(page));
    await press(page, "Escape");
    log("Esc again", await observe(page));
    await press(page, "Enter");
    await page.keyboard.type("명");
    await settle(page);
    log("type 명", await observe(page));
    await press(page, "ArrowDown");
    await press(page, "Enter");
    log("↓ Enter (result)", await observe(page));
    await press(page, "Enter");
    await page.mouse.click(400, 500);
    await settle(page);
    log("click outside", await observe(page));
    await press(page, "Tab");
    log("Tab after close", await observe(page));
  },
  tree: async (page, log) => {
    await page.locator(SELECTORS.trigger).focus();
    await press(page, "Enter");
    log("open (Enter)", await observe(page));
    await press(page, "ArrowDown");
    log("↓ in search", await observe(page));
    await press(page, "Tab");
    log("Tab", await observe(page));
    await press(page, "ArrowRight");
    log("→ (expand)", await observe(page));
    await press(page, "ArrowDown");
    await press(page, "ArrowDown");
    await press(page, "ArrowRight");
    await press(page, "ArrowDown");
    log("↓ ↓ → ↓", await observe(page));
    await press(page, "Enter");
    log("Enter (pick 명동)", await observe(page));
    await press(page, "Enter");
    log("reopen", await observe(page));
    await press(page, "Escape");
    log("Esc", await observe(page));
    await press(page, "Enter");
    await page.keyboard.type("남");
    await settle(page);
    log("type 남", await observe(page));
    await press(page, "ArrowDown");
    await press(page, "Enter");
    log("↓ Enter (result)", await observe(page));
    await press(page, "Enter");
    await page.mouse.click(400, 500);
    await settle(page);
    log("click outside", await observe(page));
  },
};

/** Fields whose value names the arm itself (the trigger name, the clear button) — recorded, not compared. */
const comparable = (step) => ({
  ...step,
  focus: step.focus === "clear" ? "search" : step.focus,
});

/** arm a = 지금 · b = 이 ADR · b-nr = b + 공용 Popover 의 FocusScope 복원 끔 (RAC `Overlay` 의 것만). */
const ARMS = ["a", "b", "b-nr"];
const ARM_CFG = {
  a: { arm: "a" },
  b: { arm: "b" },
  "b-nr": { arm: "b", popoverProps: { restoreFocus: false } },
};
/**
 * The AX lines the new assembly adds by design, not by regression: the SearchField origin's clear
 * button (RAC SearchField — out of the tab order) and the catalog Popover's OverlayArrow svg
 * (Select's list box has the same — the `select` check).
 */
const KNOWN_AX = [/^\s*- img$/, /^\s*- button "검색 지우기": ×$/];
const normalizedAx = (ax) =>
  Array.isArray(ax.tree)
    ? ax.tree
    : ax.tree
        .split("\n")
        .filter((line) => !KNOWN_AX.some((re) => re.test(line)))
        .join("\n");
/** Every arm against arm a — the go is decided on arm b (b-nr is the fallback if b differs). */
function compareArms(arms) {
  const byArm = {};
  for (const name of ARMS.slice(1)) {
    const diffs = arms.a.steps
      .map((step, i) => [step, arms[name].steps[i]])
      .filter(
        ([a, b]) =>
          JSON.stringify(comparable(a)) !== JSON.stringify(comparable(b)),
      )
      .map(([a, b]) => ({ step: a.label, a, b }));
    const axSame =
      JSON.stringify(normalizedAx(arms.a.ax)) ===
      JSON.stringify(normalizedAx(arms[name].ax));
    byArm[name] = {
      diffs: diffs.length,
      steps: diffs.map((d) => d.step),
      axSame,
    };
  }
  const best = byArm.b.diffs === 0 && byArm.b.axSame ? "b" : "b-nr";
  const diffs = arms.a.steps
    .map((step, i) => [step, arms[best].steps[i]])
    .filter(
      ([a, b]) =>
        JSON.stringify(comparable(a)) !== JSON.stringify(comparable(b)),
    )
    .map(([a, b]) => ({ step: a.label, a, b }));
  return {
    diffs,
    axSame: byArm[best].axSame,
    byArm: { ...byArm, chosen: best },
  };
}

const CHECKS = {
  // 대조군 — Select (catalog Popover 노드) 의 바깥 클릭 · Esc · 고르기 뒤 focus. 공용 Popover 의 FocusScope 가 겹친
  // 것이 Select 에도 있는지 (Cascader 만의 회귀인지) 본다.
  async select(page, out) {
    const seen = {};
    for (const [name, popoverProps] of [
      ["as-is", {}],
      ["no-restore", { restoreFocus: false }],
    ]) {
      const steps = [];
      await mount(page, "select", { popoverProps });
      await page.locator(SELECTORS.trigger).focus();
      await press(page, "Enter");
      steps.push({ label: "open", ...(await observe(page)) });
      await page.mouse.click(400, 500);
      await settle(page);
      steps.push({
        label: "click outside",
        focus: (await observe(page)).focus,
      });
      await page.locator(SELECTORS.trigger).focus();
      await press(page, "Enter");
      await press(page, "Escape");
      steps.push({ label: "Esc", focus: (await observe(page)).focus });
      await press(page, "Enter");
      await press(page, "ArrowDown");
      await press(page, "Enter");
      steps.push({
        label: "pick",
        focus: (await observe(page)).focus,
        value: (await observe(page)).state.value,
      });
      seen[name] = steps.slice(1);
    }
    out.select = { go: true, note: "기록용 (대조군)", seen };
  },
  // P1 + P2 — columns: catalog Popover node · `trigger: "Cascader"` · SearchField node + lazy list in one Autocomplete.
  async p1(page, out, browser) {
    const arms = {};
    for (const name of ARMS) {
      const cfg = { ...ARM_CFG[name], mode: "columns" };
      await mount(page, "field", cfg);
      const steps = [];
      await SCRIPTS.columns(page, (label, value) =>
        steps.push({ label, ...value }),
      );
      await mount(page, "field", cfg);
      await page.locator(SELECTORS.trigger).focus();
      await press(page, "Enter");
      const ax = await axTree(page, browser);
      const dom = await page.evaluate(() => {
        const popover = document.querySelector('[data-part="popover"]');
        return {
          trigger: popover?.getAttribute("data-trigger"),
          size: popover?.getAttribute("data-size"),
        };
      });
      arms[name] = { steps, ax, dom };
    }
    const { diffs, axSame, byArm } = compareArms(arms);
    out.p1 = { go: diffs.length === 0 && axSame, diffs, axSame, byArm, arms };
  },
  // P1 + P3 — tree: Popover > Dialog (`display: contents`) > Autocomplete > SearchField + Tree.
  async p3(page, out, browser) {
    const arms = {};
    for (const name of ARMS) {
      const cfg = { ...ARM_CFG[name], mode: "tree" };
      await mount(page, "field", cfg);
      const steps = [];
      await SCRIPTS.tree(page, (label, value) =>
        steps.push({ label, ...value }),
      );
      await mount(page, "field", cfg);
      await page.locator(SELECTORS.trigger).focus();
      await press(page, "Enter");
      const ax = await axTree(page, browser);
      const dom = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const popover = document.querySelector('[data-part="popover"]');
        return {
          trigger: popover?.getAttribute("data-trigger"),
          dialogDisplay: dialog ? getComputedStyle(dialog).display : null,
          dialogRect: dialog ? dialog.getBoundingClientRect().height : null,
        };
      });
      arms[name] = { steps, ax, dom };
    }
    const { diffs, axSame, byArm } = compareArms(arms);
    out.p3 = { go: diffs.length === 0 && axSame, diffs, axSame, byArm, arms };
  },
  // P6 — crumb slots: ref (every crumb drawn) vs slot (four slots + the real count), live widths.
  async p6(page, out) {
    const letters = ["Root", "A", "B", "C", "D", "E", "F"];
    const words = [
      "Everything",
      "Clothing",
      "Women",
      "Outerwear",
      "Rain jackets",
      "Long coats",
      "Waterproof",
    ];
    const cases = [];
    // (Review m5's input: crumbs 60 px, gap 8, folder 32 — 310 shows the last two, 180 the last one.)
    cases.push({
      name: "m5 310",
      path: letters.slice(0, 6),
      width: 310,
      fixed: true,
    });
    cases.push({
      name: "m5 180",
      path: letters.slice(0, 6),
      width: 180,
      fixed: true,
    });
    for (const depth of [2, 4, 6])
      for (const width of [420, 240])
        cases.push({
          name: `words ${depth} × ${width}`,
          path: words.slice(0, depth + 1),
          width,
          fixed: false,
        });
    const results = [];
    for (const c of cases) {
      const path = c.path.map((text) => ({ key: text, text }));
      const arms = {};
      for (const arm of ["ref", "slot"]) {
        await mount(page, "crumbs", {
          path,
          width: c.width,
          arm,
          fixed: c.fixed,
        });
        const seen = await page.evaluate(() => {
          const list = document.querySelector('[data-part="trail"]');
          const origin = list.getBoundingClientRect();
          return {
            visible: window.__state().visible,
            crumbs: [...list.children].map((li) => {
              const r = li.getBoundingClientRect();
              return {
                part: li.getAttribute("data-part"),
                x: Math.round(r.left - origin.left),
                w: Math.round(r.width),
              };
            }),
          };
        });
        let menu = [];
        const moves = [];
        if (await page.locator('[data-part="folder-button"]').count()) {
          await page.locator('[data-part="folder-button"]').click();
          await settle(page);
          menu = await page.evaluate(() =>
            [...document.querySelectorAll('[data-part^="menu-item:"]')].map(
              (el) => el.getAttribute("data-part").slice(10),
            ),
          );
          await page.keyboard.press("Escape");
          await settle(page);
          // (Every menu item moves to its own key — review m5's closing condition.)
          for (const key of menu) {
            await page.locator('[data-part="folder-button"]').click();
            await settle(page);
            await page.locator(`[data-part="menu-item:${key}"]`).click();
            await settle(page);
            moves.push(key);
          }
        }
        // (A visible, not current crumb moves too.)
        const firstLink = page
          .locator(
            '[data-part^="crumb:"] a, [data-part^="crumb:"] [role="link"]',
          )
          .first();
        if (await firstLink.count()) {
          await firstLink.click();
          await settle(page);
        }
        const moved = (await page.evaluate(() => window.__state().moved)) ?? [];
        arms[arm] = {
          ...seen,
          menu,
          moved,
          expectedMoves: [...moves, path[0].key],
        };
      }
      const same =
        JSON.stringify({
          c: arms.ref.crumbs,
          m: arms.ref.menu,
          v: arms.ref.visible,
          mv: arms.ref.moved,
        }) ===
        JSON.stringify({
          c: arms.slot.crumbs,
          m: arms.slot.menu,
          v: arms.slot.visible,
          mv: arms.slot.moved,
        });
      const movesOk = ["ref", "slot"].every(
        (arm) =>
          JSON.stringify(arms[arm].moved) ===
          JSON.stringify(arms[arm].expectedMoves),
      );
      // (Every ancestor is the first crumb, in the menu or visible — none lost.)
      const accounted = ["ref", "slot"].every((arm) => {
        const visibleKeys = arms[arm].crumbs
          .map((crumb) => crumb.part)
          .filter((part) => part?.startsWith("crumb:"))
          .map((part) => part.slice(6));
        const all = new Set([...visibleKeys, ...arms[arm].menu]);
        return path.every((item) => all.has(item.key));
      });
      results.push({ case: c.name, same, movesOk, accounted, arms });
    }
    out.p6 = {
      go: results.every((r) => r.same && r.movesOk && r.accounted),
      m5: results
        .filter((r) => r.case.startsWith("m5"))
        .map((r) => ({
          case: r.case,
          visible: r.arms.slot.visible,
          menu: r.arms.slot.menu,
          moved: r.arms.slot.moved,
        })),
      results,
    };
  },
};

const report = {};
for (const browser of BROWSERS) {
  const launcher =
    browser === "webkit"
      ? await webkit.launch({ headless: true })
      : await chromium.launch({ headless: true, channel: "chrome" });
  const page = await (
    await launcher.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 900, height: 700 },
    })
  ).newPage();
  const out = { version: launcher.version() };
  for (const [name, check] of Object.entries(CHECKS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    try {
      await check(page, out, browser);
    } catch (error) {
      out[name] = { go: false, error: String(error?.stack ?? error) };
    }
  }
  report[browser] = out;
  await launcher.close();
}
server.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const summary = Object.fromEntries(
  Object.entries(report).map(([browser, out]) => [
    browser,
    Object.fromEntries(
      Object.entries(out)
        .filter(([key]) => key !== "version")
        .map(([key, value]) => [
          key,
          value.go
            ? "go"
            : value.error
              ? `error`
              : `no-go (${value.diffs?.length ?? "-"} diffs)`,
        ]),
    ),
  ]),
);
process.stdout.write(
  `${JSON.stringify(summary, null, 2)}\n${OUT}/report.json\n`,
);
