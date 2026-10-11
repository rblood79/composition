// G5 helpers for examples 8 · 10 · 11 · 13 · 15 (fork C) — inspection and the shared main block.
import {
  canvasVsPreview,
  diff,
  launch,
  newProject,
  previewHtml,
  recordOf,
  referenceHtml,
  structure,
} from "./harness.mjs";

/** The Canvas record tree under the node with `sourceId` (type · props · hidden). */
export const tree = (page, sourceId) =>
  page.evaluate((sourceId) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const start = [...root.canvasInputs.values()].find((r) => r.sourceId === sourceId);
    if (!start) return null;
    const dump = (id, d = 0) => {
      const r = root.canvasInputs.get(id);
      const props = Object.entries(r.props ?? {})
        .filter(([, v]) => typeof v !== "object" || v === null)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ");
      return (
        `${"  ".repeat(d)}${root.typeOf(r)}${r.hidden ? " (hidden)" : ""} ${props} <${r.sourceId.split(/[:/]/).pop()}>\n` +
        r.children.map((k) => dump(k, d + 1)).join("")
      );
    };
    return dump(start.id);
  }, sourceId);

/** Stripped Preview HTML (no class · data-* · id · style · tabindex) for reading. */
export async function bareHtml(page, recordId) {
  const html = (await previewHtml(page, recordId)) ?? "";
  return html.replace(/ (class|data-[a-z-]+|id|style|tabindex)="[^"]*"/g, "");
}

/** Compare one case: Preview structure vs the reference (a builder source or an HTML string). */
export async function compareCase(page, sourceId, label, reference, options = {}) {
  const id = await recordOf(page, sourceId);
  const previewRaw = options.previewHtml
    ? await options.previewHtml(id)
    : ((await previewHtml(page, id)) ?? "");
  const p = await structure(page, previewRaw, options);
  // Known differences (named, with their reason): applied to the raw Preview HTML for a second
  // comparison — the first (raw) result is still reported.
  let known = null;
  if (options.known?.length) {
    let mapped = previewRaw;
    for (const [re, to] of options.known) mapped = mapped.replace(new RegExp(re, "g"), to);
    known = await structure(page, mapped, options);
  }
  const refHtml =
    typeof reference === "object" && reference && "html" in reference
      ? reference.html
      : await referenceHtmlC(page, reference, { act: options.act, wait: options.wait });
  const r = await structure(page, refHtml, options);
  const d = diff(p, r);
  const dk = known === null ? undefined : diff(known, r);
  const canvas = options.noCanvas ? null : await canvasVsPreview(page, id);
  return {
    label,
    structure: d ? { pass: false, d } : { pass: true },
    ...(dk === undefined ? {} : { withKnown: dk ? { pass: false, d: dk } : { pass: true } }),
    canvas,
    ...(options.full ? { preview: p, reference: r } : {}),
  };
}

export async function main(name, run) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-${name}-${Date.now()}`);
  let r;
  try {
    r = await run(page, errors);
  } catch (error) {
    r = { thrown: String(error?.stack ?? error).slice(0, 1500) };
  }
  console.log(JSON.stringify(r, null, 1));
  console.log("errors", JSON.stringify(errors.slice(0, 8)));
  await browser.close();
}

const ITEM_INSERT = `/@fs${process.cwd()}/apps/builder/src/builder/catalogRuntime/itemInsert.ts`;
/**
 * The Design panel's "+" (`CatalogItemInsertSection` → `catalogItemInsertChoices`): `pick(root)` (a
 * function source) returns the host record id; adds `count` items of `itemType`.
 */
export async function plus(page, pick, itemType, count = 1) {
  return page.evaluate(
    async ({ ITEM_INSERT, pick, itemType, count }) => {
      const { catalogItemInsertChoices } = await import(ITEM_INSERT);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const out = [];
      for (let i = 0; i < count; i++) {
        const id = new Function("root", `return (${pick})(root);`)(root);
        const position = ws.positionOfRecord(id);
        const choices = catalogItemInsertChoices(
          { graph: ws.runtime.graph, readModel: ws.readModel, newId: ws.newId },
          position,
        );
        const choice = choices.find((c) => c.type === itemType);
        if (!choice) return { ok: false, choices: choices.map((c) => c.type) };
        try {
          ws.execute(choice.build());
          out.push(1);
        } catch (error) {
          return { ok: false, code: error?.code ?? String(error) };
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      return { ok: true, added: out.length };
    },
    { ITEM_INSERT, pick: pick.toString(), itemType, count },
  );
}

/**
 * Known differences (regex → replacement on raw Preview HTML), each with its source:
 * - `image`: an Image in an S2 Card's preview is S2's box around its `img` (G5 example 13); a RAC
 *   example's plain `img` folds it (outside a CardPreview the Image is that `img` — example 10).
 * - `checkGlyph`: the toggle indicator box is the CheckboxIndicator node drawn by its owner, its glyph
 *   is the sheet's (user decision 2026-10-04 「1안」, ssot-hierarchy.md toggle indicator 절) — the
 *   reference's indicator holds an `svg`.
 */
export const KNOWN = {
  image: [`<div[^>]*class="react-aria-Image"[^>]*>(<img[^>]*>)</div>`, `$1`],
  checkGlyph: [`(<div class="checkbox"[^>]*>)(</div>)`, `$1<svg aria-hidden="true"></svg>$2`],
};

const previewFrameOf = (page) => page.frames().find((f) => f.url().includes("preview.html"));
/**
 * `referenceHtml` (harness) with `@internationalized/date` as a fourth argument `D` — the same
 * mount: the installed RAC from the Preview frame's `.vite/deps`, a detached host, `act` after mount.
 */
export async function referenceHtmlC(page, build, { act, wait = 300 } = {}) {
  return previewFrameOf(page).evaluate(
    async ({ build, act, wait }) => {
      const res = performance.getEntriesByType("resource").map((e) => e.name);
      const v = res.find((n) => n.includes(".vite/deps/react.js"))?.split("?v=")[1];
      const dep = (n) => `/node_modules/.vite/deps/${n}.js?v=${v}`;
      const React = (await import(dep("react"))).default;
      const RDC = (await import(dep("react-dom_client"))).default;
      const RAC = await import(dep("react-aria-components"));
      const D = await import(dep("@internationalized_date"));
      const host = document.createElement("div");
      host.style.cssText = "position:absolute;left:-10000px;top:0;width:800px";
      document.body.appendChild(host);
      const root = RDC.createRoot(host);
      root.render(new Function("h", "RAC", "React", "D", `return (${build})(h, RAC, React, D);`)(React.createElement, RAC, React, D));
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
