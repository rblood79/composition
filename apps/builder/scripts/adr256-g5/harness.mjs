// ADR-256 G5 harness — the reference example set (breakdown §4) in the real Builder (headed Chrome).
// Per example: assemble with the Builder's commands · save and reopen · the Preview DOM's Decision 11
// structure = the example code mounted with the installed RAC in the same Preview frame (the oracle uses
// no catalog code) · Compare Mode Canvas boxes = Preview boxes.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

export const REPO = process.cwd();
export const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const COMMANDS = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;

export async function launch() {
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
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return { browser, page, errors };
}

async function ready(page) {
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
}

export async function compareOn(page) {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

export async function newProject(page, name) {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await ready(page);
  await compareOn(page);
}

/** Save (autosave) and reopen the same project. */
export async function reopen(page) {
  await page.waitForTimeout(1500);
  const url = page.url();
  await page.reload();
  await ready(page);
  await page.waitForTimeout(2500);
  await compareOn(page);
  return page.url() === url;
}

/**
 * Run catalog commands in the Builder page: `build(c, ws, h, arg)` returns a command or a list of
 * commands (each executed in turn — every one is a Builder edit step). `h` helps address records.
 */
export async function edit(page, build, arg) {
  return page.evaluate(
    async ({ COMMANDS, build, arg }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const all = () => [...root.canvasInputs.values()];
      const h = {
        type: (r) => root.typeOf(r),
        get: (id) => root.canvasInputs.get(id),
        bySource: (sourceId) => all().find((r) => r.sourceId === sourceId),
        /** The descendants of `id` of `type` (document order). */
        within: (id, type) => {
          const out = [];
          const visit = (rid) => {
            const r = root.canvasInputs.get(rid);
            if (!r) return;
            for (const k of r.children) {
              const kr = root.canvasInputs.get(k);
              if (kr && (!type || root.typeOf(kr) === type)) out.push(kr);
              visit(k);
            }
          };
          visit(id);
          return out;
        },
        target: (id) => ws.positionOfRecord(id).target,
        body: () => all().find((r) => r.sourceId.endsWith("home-body")),
        newId: () => ws.newId("node"),
        node: (id, definitionId, props = {}, visual = {}) => ({
          kind: "node",
          id,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
          visual: Object.fromEntries(
            Object.entries(visual).map(([k, v]) => [k, { kind: "set", value: v }]),
          ),
          sizing: {},
          descendantOverrides: [],
        }),
        set: (value) => ({ kind: "set", value }),
        later: (fn) => ({ __later: fn }),
        /** The Attributes axis (metadata `ariaLabel`) of an owned node. */
        ariaLabel: (id, value) => c.setNodeAttribute({ id: root.canvasInputs.get(id).sourceId, field: "ariaLabel", value }),
      };
      h.insert = (parentId, entries, index) =>
        c.insertNodes({
          parent: parentId === "body" ? { kind: "node", id: h.body().sourceId } : h.target(parentId),
          entries,
          rootIds: entries.map((e) => e.id),
          ...(index === undefined ? {} : { index }),
          newId: ws.newId,
        });
      h.props = (id, props) =>
        c.setFields({
          targets: [h.target(id)],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) =>
              [k, v === undefined ? { kind: "remove" } : { kind: "set", value: v }],
            ),
          ),
        });
      try {
        const steps = [];
        let built = new Function("c", "ws", "h", "arg", `return (${build})(c, ws, h, arg);`)(
          c,
          ws,
          h,
          arg,
        );
        if (built && typeof built.then === "function") built = await built;
        // A builder may return `h.later(() => command)` steps (each sees the previous steps' records).
        const list = Array.isArray(built) ? built : [built];
        for (const step of list) {
          const command = step && step.__later ? step.__later() : step;
          if (command) {
            ws.execute(command);
            steps.push(1);
            await new Promise((r) => setTimeout(r, 120));
          }
        }
        await new Promise((r) => setTimeout(r, 600));
        return { ok: true, steps: steps.length };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error), message: String(error?.message ?? error).slice(0, 300) };
      }
    },
    { COMMANDS, build: build.toString(), arg },
  );
}

/** Insert an original under body; returns the new node's source id. */
export async function place(page, definitionId) {
  return page.evaluate(
    async ({ COMMANDS, definitionId }) => {
      const c = await import(COMMANDS);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const body = [...ws.root.canvasInputs.values()].find((r) => r.sourceId.endsWith("home-body"));
      const id = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body.sourceId },
          entries: [
            { kind: "node", id, definitionId, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      await new Promise((r) => setTimeout(r, 1200));
      return id;
    },
    { COMMANDS, definitionId },
  );
}

/** The record id (identity) of the node with `sourceId` (the first — a placed root has one). */
export const recordOf = (page, sourceId) =>
  page.evaluate(
    (sourceId) =>
      [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()].find(
        (r) => r.sourceId === sourceId,
      )?.id ?? null,
    sourceId,
  );

const previewFrame = (page) => page.frames().find((f) => f.url().includes("preview.html"));

/** Press an element in the Preview (RAC virtual press — Compare Mode puts the header over it). */
export async function press(page, selector) {
  await page.frameLocator("#previewFrame").locator(selector).first().dispatchEvent("click");
  await page.waitForTimeout(800);
}

/** The record ids of a record's children (the Canvas record tree — the document's order). */
export const childIds = (page, recordId) =>
  page.evaluate(
    (id) => [...(window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.children ?? [])],
    recordId,
  );

/**
 * The Preview element(s) of a record: its marker element (a `display: contents` marker → its
 * children). A node with no element of its own (a RAC DialogTrigger · MenuTrigger · TooltipTrigger —
 * G5 examples 2 · 9) is its children's elements, in order.
 */
export async function previewHtml(page, recordId) {
  const own = await previewFrame(page).evaluate((id) => {
    const el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    return getComputedStyle(el).display === "contents" ? el.innerHTML : el.outerHTML;
  }, recordId);
  if (own !== null) return own;
  const parts = [];
  for (const child of await childIds(page, recordId)) {
    const html = await previewFrame(page).evaluate(
      (id) => document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)?.outerHTML ?? null,
      child,
    );
    if (html !== null) parts.push(html);
  }
  return parts.length ? parts.join("") : null;
}

/**
 * The reference: `build(h, RAC, React)` (a function source) returns a React element; it is mounted in
 * the Preview frame with the installed RAC (`.vite/deps` — the same copy the Preview loads), and
 * `select(host)` (optional source) picks the element(s) compared. `act(host)` may run after mount.
 */
export async function referenceHtml(page, build, { act, wait = 300 } = {}) {
  return previewFrame(page).evaluate(
    async ({ build, act, wait }) => {
      const res = performance.getEntriesByType("resource").map((e) => e.name);
      const v = res.find((n) => n.includes(".vite/deps/react.js"))?.split("?v=")[1];
      const dep = (n) => `/node_modules/.vite/deps/${n}.js?v=${v}`;
      const React = (await import(dep("react"))).default;
      const RDC = (await import(dep("react-dom_client"))).default;
      const RAC = await import(dep("react-aria-components"));
      const host = document.createElement("div");
      host.style.cssText = "position:absolute;left:-10000px;top:0;width:800px";
      document.body.appendChild(host);
      const root = RDC.createRoot(host);
      const element = new Function("h", "RAC", "React", `return (${build})(h, RAC, React);`)(
        React.createElement,
        RAC,
        React,
      );
      root.render(element);
      await new Promise((r) => setTimeout(r, wait));
      if (act) {
        await new Function("host", `return (${act})(host);`)(host);
        await new Promise((r) => setTimeout(r, wait));
      }
      const html = host.innerHTML;
      root.unmount();
      host.remove();
      return html;
    },
    { build: build.toString(), act: act?.toString(), wait },
  );
}

/**
 * Decision 11 structure of an HTML fragment: tag · parent-child · sibling order · text · `slot` · role
 * and aria attributes · aria links as positions. Not compared: generated ids · `data-*` · class ·
 * inline style. Fixed differences (G0 · user decision 2026-10-09 「Icon div · 글자 span 유지」): an Icon
 * is `div.react-aria-Icon > svg` (compared as its svg), a glyph's paths are not compared. RAC's hidden
 * collection `template` · focus-scope sentinels are not content.
 */
export async function structure(page, html, { ignore = [] } = {}) {
  return previewFrame(page).evaluate(
    ({ html, ignore }) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      for (const el of [...host.querySelectorAll("template, span[data-focus-scope-start], span[data-focus-scope-end]")])
        el.remove();
      for (const icon of [...host.querySelectorAll("div.react-aria-Icon")]) icon.replaceWith(...icon.childNodes);
      for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
      // (display: contents markers carry nothing of their own.)
      const all = [...host.querySelectorAll("*")];
      const position = (id) => {
        const index = all.findIndex((element) => element.id === id);
        return index < 0 ? "missing" : `#${index}`;
      };
      const LINKS = new Set(["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant", "for"]);
      const skip = new Set(ignore);
      const walk = (element) => {
        const attributes = [...element.attributes]
          .filter((a) => /^(role|slot)$/.test(a.name) || a.name.startsWith("aria-") || a.name === "for")
          .filter((a) => !skip.has(a.name))
          .map((a) =>
            LINKS.has(a.name)
              ? `${a.name}=${a.value.split(" ").filter(Boolean).map(position).join(",")}`
              : `${a.name}=${a.value}`,
          )
          .sort();
        const content = [...element.childNodes]
          .map((child) => (child.nodeType === 1 ? walk(child) : (child.textContent ?? "").trim()))
          .filter((s) => s !== "");
        return `<${element.tagName.toLowerCase()}${attributes.length ? " " + attributes.join(" ") : ""}>${content.join("")}</>`;
      };
      return [...host.children].map(walk).join("\n");
    },
    { html, ignore },
  );
}

/** First differing position of two structure strings (with context). */
export function diff(a, b) {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return { at: i, preview: a.slice(Math.max(0, i - 120), i + 160), reference: b.slice(Math.max(0, i - 120), i + 160) };
}

/**
 * Compare Mode: each visible descendant record's Canvas box (relative to the root) = its Preview
 * element's box (relative to the root element). Records without a laid-out Preview element are listed.
 */
export async function canvasVsPreview(page, recordId, tolerance = 1.5) {
  // (Canvas geometry is relative to the parent record — the DOM box is taken against the parent's element.)
  const canvas = await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const ids = [];
    const visit = (rid) => {
      const r = root.canvasInputs.get(rid);
      if (!r || r.hidden) return;
      ids.push(rid);
      for (const k of r.children) visit(k);
    };
    visit(id);
    const g = root.getGeometry([...ids, root.canvasInputs.get(id)?.parentId].filter(Boolean));
    return ids
      .slice(1)
      .map((rid) => {
        const b = g.get(rid);
        const r = root.canvasInputs.get(rid);
        if (!b) return null;
        // (A parent with no element of its own — a RAC trigger, `display: contents` — is measured
        // through to its parent: the box offset by the parent's.)
        const p = root.canvasInputs.get(r.parentId);
        const pb = g.get(r.parentId) ?? root.getGeometry([r.parentId]).get(r.parentId);
        return {
          id: rid,
          parentId: r.parentId,
          grandId: p?.parentId,
          type: root.typeOf(r),
          box: [b.x, b.y, b.width, b.height],
          viaBox: pb ? [b.x + pb.x, b.y + pb.y, b.width, b.height] : null,
        };
      })
      .filter(Boolean);
  }, recordId);
  const dom = await previewFrame(page).evaluate((rows) => {
    const at = (id) => {
      let el = document.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
      while (el && getComputedStyle(el).display === "contents") el = el.firstElementChild;
      return el;
    };
    return rows.map(({ id, parentId, grandId }) => {
      const el = at(id);
      const parent = at(parentId);
      const grand = !parent && grandId ? at(grandId) : null;
      if (!el || !(parent || grand)) return null;
      const r = el.getBoundingClientRect();
      const base = (parent ?? grand).getBoundingClientRect();
      return { via: !parent, box: [r.left - base.left, r.top - base.top, r.width, r.height] };
    });
  }, canvas.map(({ id, parentId, grandId }) => ({ id, parentId, grandId })));
  const rows = canvas.map((c, i) => ({
    ...c,
    box: dom[i]?.via ? (c.viaBox ?? c.box) : c.box,
    dom: dom[i]?.box ?? null,
  }));
  // (A box empty on one side only is a difference — a fill the Canvas draws 0×0 — not a skip; only
  //  a box empty on both sides (nothing drawn) is left out.)
  const empty = (box) => box[2] * box[3] === 0;
  const compared = rows.filter((r) => r.dom && !(empty(r.box) && empty(r.dom)));
  const off = compared.filter((r) => r.box.some((v, k) => Math.abs(v - r.dom[k]) > tolerance));
  const round = (box) => box?.map((v) => Math.round(v * 10) / 10);
  return {
    compared: compared.length,
    // (Which boxes were compared — a part dropped from the comparison shows here, not only in a count.)
    comparedTypes: compared.map((r) => r.type),
    off: off.map((r) => ({ type: r.type, canvas: round(r.box), dom: round(r.dom) })),
    unmatched: rows.filter((r) => !r.dom).map((r) => r.type),
  };
}
