// G5 fork-a helpers (examples 2 · 3 · 4 · 9): tree dumps and overlay structure capture.
const previewFrame = (page) => page.frames().find((f) => f.url().includes("preview.html"));
export { previewFrame };

/** Canvas tree of a record (type · props.children · slot · short id). */
export const dumpTree = (page, sourceId) =>
  page.evaluate((sourceId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const start = [...root.canvasInputs.values()].find((r) => r.sourceId === sourceId);
    const dump = (id, d = 0) => {
      const r = root.canvasInputs.get(id);
      const p = r.props ?? {};
      const extra = Object.entries(p).filter(([k]) => k !== "style").map(([k, v]) => `${k}=${JSON.stringify(v)?.slice(0, 30)}`).join(" ");
      return `${"  ".repeat(d)}${root.typeOf(r)}${r.hidden ? " (hidden)" : ""} ${extra} [${r.sourceId.slice(-48)}]\n` + r.children.map((k) => dump(k, d + 1)).join("");
    };
    return start ? dump(start.id) : null;
  }, sourceId);

/** outerHTML of the first element matching `selector` in the Preview document (or null). */
export const previewOverlayHtml = (page, selector) =>
  previewFrame(page).evaluate((selector) => document.querySelector(selector)?.outerHTML ?? null, selector);

/** Stripped HTML (class · data-* · id · style removed) for reading. */
export const strip = (html) =>
  (html ?? "").replace(/ (class|data-[a-z-]+|id|style|tabindex)="[^"]*"/g, "");

const ITEM_INSERT = `/@fs${process.cwd()}/apps/builder/src/builder/catalogRuntime/itemInsert.ts`;

/** The Design panel "+" (catalogItemInsertChoices — the Builder's item insert) on a record: adds `type`. */
export const plus = (page, recordId, type) =>
  page.evaluate(
    async ({ ITEM_INSERT, recordId, type }) => {
      const { catalogItemInsertChoices } = await import(ITEM_INSERT);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const position = ws.positionOfRecord(recordId);
      const choices = catalogItemInsertChoices(
        { graph: ws.runtime.graph, readModel: ws.readModel, newId: ws.newId },
        position,
      );
      const choice = choices.find((c) => c.type === type);
      if (!choice) return { ok: false, code: "NO_CHOICE", choices: choices.map((c) => c.type) };
      try {
        ws.execute(choice.build());
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error), message: String(error?.message ?? error).slice(0, 200) };
      }
    },
    { ITEM_INSERT, recordId, type },
  );

/** Escape twice in the Preview (closes open overlays). */
export async function closeOverlays(page) {
  const frame = previewFrame(page);
  for (let i = 0; i < 3; i++) {
    await frame.evaluate(() => {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    });
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
}

/** outerHTML of the LAST element matching `selector` in the Preview document (portals append). */
export const lastHtml = (page, selector) =>
  previewFrame(page).evaluate((selector) => {
    const all = document.querySelectorAll(selector);
    return all.length ? all[all.length - 1].outerHTML : null;
  }, selector);

export const countIn = (page, selector) =>
  previewFrame(page).evaluate((selector) => document.querySelectorAll(selector).length, selector);

/**
 * Mount the reference (`build(h, RAC, React)` source) in the Preview frame with the installed RAC;
 * `act(host, doc)` (source, optional) runs after mount; returns `pick(host, doc)` (source) — default
 * host.innerHTML. The overlay a reference opens portals to the Preview document body.
 */
export async function refMount(page, build, { act, pick, wait = 400 } = {}) {
  return previewFrame(page).evaluate(
    async ({ build, act, pick, wait }) => {
      const res = performance.getEntriesByType("resource").map((e) => e.name);
      const v = res.find((n) => n.includes(".vite/deps/react.js"))?.split("?v=")[1];
      const dep = (n) => `/node_modules/.vite/deps/${n}.js?v=${v}`;
      const React = (await import(dep("react"))).default;
      const RDC = (await import(dep("react-dom_client"))).default;
      const RAC = await import(dep("react-aria-components"));
      const host = document.createElement("div");
      host.style.cssText = "position:absolute;left:0;top:0;width:800px";
      document.body.appendChild(host);
      const root = RDC.createRoot(host);
      const element = new Function("h", "RAC", "React", `return (${build})(h, RAC, React);`)(React.createElement, RAC, React);
      root.render(element);
      await new Promise((r) => setTimeout(r, wait));
      if (act) {
        await new Function("host", "doc", `return (${act})(host, doc);`)(host, document);
        await new Promise((r) => setTimeout(r, wait));
      }
      const out = pick ? new Function("host", "doc", `return (${pick})(host, doc);`)(host, document) : host.innerHTML;
      root.unmount();
      host.remove();
      await new Promise((r) => setTimeout(r, 200));
      return out;
    },
    { build: build.toString(), act: act?.toString(), pick: pick?.toString(), wait },
  );
}

/** Type into an input in the Preview the way React sees it (native setter + input event). */
export const typeInto = (page, selector, value) =>
  previewFrame(page).evaluate(
    ({ selector, value }) => {
      const all = document.querySelectorAll(selector);
      const input = all[all.length - 1];
      if (!input) return false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    { selector, value },
  );

/**
 * Approved fixed differences removed before the Decision 11 structure:
 * - `span[hidden][data-focus-scope-anchor]` — shared ContentFocusScope anchor (hidden; G2 adr256DialogModal
 *   structure leaves hidden nodes out).
 */
export const dropAnchors = (html) => (html ?? "").replace(/<span hidden="" data-focus-scope-anchor="true"><\/span>/g, "");

/** A trigger's layout wrapper (ADR-255 D1 — DialogTrigger · TooltipTrigger · MenuTrigger `div`, no role) → its content. */
export const unwrapTrigger = (html) => {
  const m = /^<div[^>]*>([\s\S]*)<\/div>$/.exec(html ?? "");
  return m ? m[1] : html;
};
