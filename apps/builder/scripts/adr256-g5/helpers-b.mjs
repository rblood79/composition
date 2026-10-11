// G5 helpers for examples 5 · 6 · 7 · 12 · 14 (fork B) — on top of harness.mjs.
import {
  canvasVsPreview,
  diff,
  previewHtml,
  recordOf,
  referenceHtml,
  structure,
} from "./harness.mjs";

const previewFrame = (page) =>
  page.frames().find((f) => f.url().includes("preview.html"));

/**
 * Fixed differences collapsed before the Decision 11 comparison (each cited where it is used):
 * `unwrap` selectors replace an element by its children (a builder text node's `span`).
 */
export async function unwrapHtml(page, html, unwrap = []) {
  if (!unwrap.length) return html;
  return previewFrame(page).evaluate(
    ({ html, unwrap }) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      for (const selector of unwrap)
        for (const el of [...host.querySelectorAll(selector)])
          el.replaceWith(...el.childNodes);
      return host.innerHTML;
    },
    { html, unwrap },
  );
}

/** The non-aria state attributes of form controls (Decision 11 — same element, same state). */
export async function controlStates(page, html) {
  return previewFrame(page).evaluate((html) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    return [...host.querySelectorAll("input, button")]
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}${["type", "disabled", "required", "readonly", "checked"]
            .filter((a) => el.hasAttribute(a))
            .map((a) => `[${a}${a === "type" ? "=" + el.getAttribute(a) : ""}]`)
            .join("")}`,
      )
      .join(" ");
  }, html);
}

/** One compared case: the placed root's Preview DOM vs the reference · Canvas vs Preview. */
export async function compareCase(page, label, source, reference, opts = {}) {
  const id = await recordOf(page, source);
  const raw = (await previewHtml(page, id)) ?? "";
  const refRaw = await referenceHtml(page, reference, opts.reference ?? {});
  const p = await structure(page, await unwrapHtml(page, raw, opts.unwrap));
  const r = await structure(page, refRaw);
  const d = diff(p, r);
  const ps = await controlStates(page, raw);
  const rs = await controlStates(page, refRaw);
  const canvas = await canvasVsPreview(page, id);
  return {
    label,
    structure: d ? { pass: false, d } : { pass: true },
    controls: ps === rs ? { pass: true } : { pass: false, preview: ps, reference: rs },
    canvas,
  };
}

/** Print a short summary of a run result. */
export function summarize(name, result, errors) {
  const lines = [`# ${name} edits=${JSON.stringify(result.edits)} reopened=${result.reopened}`];
  for (const o of result.out)
    lines.push(
      `${o.label}: structure ${o.structure.pass ? "PASS" : "FAIL " + JSON.stringify(o.structure.d)} · controls ${o.controls.pass ? "PASS" : "FAIL " + JSON.stringify(o.controls)} · canvas ${o.canvas.compared} compared, off ${JSON.stringify(o.canvas.off)} unmatched ${JSON.stringify(o.canvas.unmatched)}`,
    );
  lines.push(`errors ${JSON.stringify(errors.slice(0, 5))}`);
  return lines.join("\n");
}
