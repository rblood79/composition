// Builder 문서 밖에서 설치 S2 1.8.2의 실제 Label 줄/표시 좌표를 측정하는 읽기 전용 oracle.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import * as Spectrum from "@react-spectrum/s2";
import { buildCodeCatalogLibrary } from "../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../packages/shared/src/catalog/document/graph";
import { insertNodes } from "../../../packages/shared/src/catalog/commands";
import { CatalogWorkspace } from "../src/builder/catalogRuntime/workspace";
import { CatalogStorage } from "../src/builder/catalogRuntime/storage";
import { catalogPaletteDefinitionId } from "../src/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "../src/builder/catalogRuntime/project";
import { createLayoutEngine } from "../src/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { catalogTextMeasure } from "../src/builder/catalogRuntime/textMeasure";
import { renderCatalogDom } from "../src/builder/catalogRuntime/domBinding";
import { injectPreviewBaseStyles } from "../src/preview/baseStyles";
import {
  buildCatalogProjectJson,
  catalogProjectContent,
} from "../../../packages/shared/src/catalog/runtime/exchange";
import { getSkiaNode } from "../src/builder/workspace/canvas/skia/useSkiaNode";
import { resolveTextNodeDebug } from "../src/builder/workspace/canvas/skia/textDrawOrigin";
import { skiaFontManager } from "../src/builder/workspace/canvas/skia/fontManager";
import {
  measureFontBox,
  cssFontFamilyList,
} from "../src/builder/workspace/canvas/utils/textMeasure";

export async function inspectLabelPaint(id) {
  const node = getSkiaNode(id);
  if (!node)
    return {
      unavailable:
        "Registry module changed during HMR; this diagnostic is not a product assertion.",
    };
  const text = node.text ?? node.children?.[0]?.text;
  const family = cssFontFamilyList(text.fontFamilies);
  const el = document
    .querySelector("#previewFrame")
    .contentDocument.querySelector(`[data-catalog-id="${id}"]`);
  const marker = el.insertBefore(
    el.ownerDocument.createElement("span"),
    el.firstChild,
  );
  marker.style.cssText = "display:inline-block;width:0;height:0";
  const baselineFromTop =
    marker.getBoundingClientRect().y - el.getBoundingClientRect().y;
  marker.remove();
  const lineMetrics = [];
  const doc = el.ownerDocument;
  const families = getComputedStyle(el).fontFamily;
  for (const [family, size, weight, line] of [
    [families, 14, 400, 21],
    [families, 18, 700, 27],
    ["Pretendard", 16, 400, 24],
    ["Inter", 16, 400, 24],
  ]) {
    await doc.fonts.load(`${weight} ${size}px ${family}`, "xLong");
    // 읽기 전용 측정. 제품의 가시 레이어나 문서는 변경하지 않는다.
    const probe = doc.body.appendChild(doc.createElement("div"));
    probe.lang = text.locale ?? "ko-KR";
    probe.style.cssText = `position:fixed;left:-10000px;top:0;font-family:${family};font-size:${size}px;font-weight:${weight};line-height:${line}px`;
    probe.append("xLong");
    const mark = probe.appendChild(doc.createElement("span"));
    mark.style.cssText = "display:inline-block;width:0;height:0";
    const font = {
      fontFamily: family,
      fontSize: size,
      fontWeight: weight,
      lineHeight: line / size,
      locale: text.locale,
    };
    lineMetrics.push({
      font,
      computed: {
        family: getComputedStyle(probe).fontFamily,
        size: getComputedStyle(probe).fontSize,
        line: getComputedStyle(probe).lineHeight,
      },
      domBaseline:
        mark.getBoundingClientRect().top - probe.getBoundingClientRect().top,
      box: catalogTextMeasure.fontBox(font),
      measured: catalogTextMeasure("xLong", font),
      inline: catalogTextMeasure.inline("xLong", font).clusters[0],
    });
    probe.remove();
  }
  return {
    dpr: doc.defaultView.devicePixelRatio,
    lineMetrics,
    node,
    baselineFromTop,
    skiaFaces: text.fontFamilies.map((family) => ({
      family,
      alias: skiaFontManager.resolveFamily(family),
      face: skiaFontManager
        .getTypeface(family, "400", "normal")
        ?.getFamilyName(),
      fallback: skiaFontManager.getTypeface(family)?.getFamilyName(),
      glyphs: Array.from(
        skiaFontManager
          .getTypeface(family, "400", "normal")
          ?.getGlyphIDs("xLong") ?? [],
      ),
    })),
    catalogFontBox: catalogTextMeasure.fontBox({
      fontFamily: family,
      fontSize: text.fontSize,
      fontWeight: text.fontWeight,
      lineHeight: text.lineHeight / text.fontSize,
      locale: text.locale,
    }),
    kitFaces: window.Typekit?.kit.map((f) => {
      const result = f.getFontData();
      if (!result.data) return { weight: f.weight, kind: result.kind };
      const view = new DataView(result.data);
      for (let i = 0; i < view.getUint16(4); i++) {
        const at = 12 + i * 16;
        const tag = String.fromCharCode(...new Uint8Array(result.data, at, 4));
        if (tag === "OS/2")
          return {
            weight: f.weight,
            actualWeight: view.getUint16(view.getUint32(at + 8) + 4),
          };
      }
      return { weight: f.weight };
    }),
    dom: {
      color: getComputedStyle(el).color,
      fonts: [el, el.parentElement].map((e) => {
        const s = getComputedStyle(e);
        return {
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          fontWeight: s.fontWeight,
          fontVariationSettings: s.fontVariationSettings,
          fontFeatureSettings: s.fontFeatureSettings,
          fontStyle: s.fontStyle,
        };
      }),
      rect: el.getBoundingClientRect().toJSON(),
      labelRect: el.parentElement.getBoundingClientRect().toJSON(),
    },
    fontBox: measureFontBox(
      family,
      text.fontSize,
      text.fontWeight,
      text.locale,
    ),
    unlocalizedFontBox: measureFontBox(family, text.fontSize, text.fontWeight),
    debug: resolveTextNodeDebug(id),
    families: skiaFontManager.getFamilies(),
    fonts: [...document.fonts].map((f) => ({
      family: f.family,
      weight: f.weight,
      status: f.status,
    })),
  };
}

let libraryPromise;

/** Official, read-only project export of the document authored through Builder UI. */
export async function exportLabelProject() {
  return JSON.parse(
    await buildCatalogProjectJson(
      catalogProjectContent(
        window.__COMPOSITION_CATALOG__.workspace.runtime.graph,
      ),
      async () => null,
    ),
  );
}

export async function measureCatalogLabel({
  type,
  label,
  necessityIndicator,
  width,
  size = "M",
  locale = "ko-KR",
}) {
  const library = await (libraryPromise ??= buildCodeCatalogLibrary());
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:label-audit",
        name: "Label audit",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, "label-audit-not-saved"),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      locale,
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
    },
  );
  const id = "project:node:label-audit";
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries({
              label,
              necessityIndicator,
              size,
              isRequired: true,
            }).map(([k, value]) => [k, { kind: "set", value }]),
          ),
          visual: { width: { kind: "set", value: width } },
          sizing: {},

          descendantOverrides: [],
        },
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = [...root.domInputs.values()].find((n) => n.sourceId === id);
  const labelNode = [...root.domInputs.values()].find(
    (n) => root.typeOf(n) === "Label",
  );
  const indicatorNode = [...root.domInputs.values()].find(
    (n) => n.props.slot === `necessity-${necessityIndicator}`,
  );
  const doc = document.querySelector("#previewFrame").contentDocument;
  const host = doc.body.appendChild(doc.createElement("div"));
  host.lang = locale;
  host.style.cssText =
    "position:fixed;top:140px;left:360px;z-index:9999;background:white;padding:16px;";
  const react = createRoot(host);
  try {
    react.render(renderCatalogDom(root, field.id));
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    await doc.fonts.ready;
    const element = host.querySelector(`[data-catalog-id="${labelNode.id}"]`);
    const fieldEl = host.querySelector(`[data-catalog-id="${field.id}"]`);
    const fieldRect = fieldEl.getBoundingClientRect();
    const body = element.querySelector('[slot="label-content"]');
    const range = doc.createRange();
    range.selectNodeContents(body);
    const lines = [...range.getClientRects()].map((r) => ({
      x: r.x - fieldRect.x,
      y: r.y - fieldRect.y,
      width: r.width,
      height: r.height,
    }));
    const indicator = host.querySelector(
      `[data-catalog-id="${indicatorNode.id}"]`,
    );
    const part = indicator.getBoundingClientRect();
    const geometry = root.getGeometry([
      field.id,
      labelNode.id,
      indicatorNode.id,
    ]);
    const canvasField = geometry.get(field.id);
    const canvasLabel = geometry.get(labelNode.id);
    const canvasPart = geometry.get(indicatorNode.id);
    return {
      type,
      label,
      necessityIndicator,
      size,
      fieldWidth: fieldRect.width,
      labelWidth: element.getBoundingClientRect().width,
      labelHeight: element.getBoundingClientRect().height,
      fontFamily: getComputedStyle(element).fontFamily,
      lineHeight: getComputedStyle(element).lineHeight,
      fontSize: getComputedStyle(element).fontSize,
      bodyFontSize: getComputedStyle(body).fontSize,
      bodyWeight: getComputedStyle(body).fontWeight,
      lines,
      indicator: {
        x: part.x - fieldRect.x,
        y: part.y - fieldRect.y,
        width: part.width,
        height: part.height,
      },
      canvas: {
        fieldWidth: canvasField.width,
        labelHeight: canvasLabel.height,
        indicator: {
          x: canvasLabel.x + canvasPart.x,
          y: canvasLabel.y + canvasPart.y,
          width: canvasPart.width,
          height: canvasPart.height,
        },
      },
    };
  } finally {
    react.unmount();
    host.remove();
    workspace.dispose();
  }
}

export async function measureS2Label({
  type,
  label,
  necessityIndicator,
  width,
  size = "M",
  fontFamily,
  locale = "ko-KR",
  debug = false,
}) {
  const host = document.body.appendChild(document.createElement("iframe"));
  host.style.cssText =
    "position:fixed;left:360px;top:140px;width:600px;height:400px;z-index:9999;border:0;background:white;";
  const doc = host.contentDocument;
  injectPreviewBaseStyles(doc);
  doc.documentElement.lang = locale;
  doc.documentElement.style.cssText =
    "font-size:16px;--s2-scale:1;--s2-font-size-base:14;color-scheme:light";
  doc.body.style.margin = "0";
  // S2 CSS만 격리해 Builder chrome의 svg/reset이 비교에 섞이지 않게 한다.
  for (const sheet of document.querySelectorAll("style[data-vite-dev-id]")) {
    if (sheet.getAttribute("data-vite-dev-id").includes("@react-spectrum/s2/"))
      doc.head.appendChild(sheet.cloneNode(true));
  }
  const previewDoc = document.querySelector("#previewFrame")?.contentDocument;
  if (previewDoc) for (const face of previewDoc.fonts) doc.fonts.add(face);
  const mount = doc.body.appendChild(doc.createElement("div"));
  const root = createRoot(mount);
  try {
    root.render(
      createElement(
        Spectrum.Provider,
        { locale, colorScheme: "light" },
        createElement(Spectrum[type === "Select" ? "Picker" : type], {
          UNSAFE_className: "label-oracle-field",
          label,
          necessityIndicator,
          isRequired: true,
          size,
          UNSAFE_style: { width, fontFamily },
        }),
      ),
    );
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    await doc.fonts.ready;
    const texts = doc.createTreeWalker(mount, NodeFilter.SHOW_TEXT);
    let bodyText;
    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
      const box = text.parentElement?.getBoundingClientRect();
      if (text.textContent === label && box?.width > 10 && box.height > 5) {
        bodyText = text;
        break;
      }
    }
    const element = bodyText?.parentElement;
    if (!element) throw new Error(`S2 Label missing: ${type}`);
    const field = element.closest(".label-oracle-field");
    const rect = element.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const body = doc.createRange();
    body.selectNodeContents(bodyText);
    const lines = [...body.getClientRects()].map((r) => ({
      x: r.x - fieldRect.x,
      y: r.y - fieldRect.y,
      width: r.width,
      height: r.height,
    }));
    const indicator =
      necessityIndicator === "icon"
        ? element.querySelector("svg")
        : element.querySelector(":scope > span > span");
    const part = indicator.getBoundingClientRect();
    return {
      type,
      ...(debug ? { html: field.outerHTML } : {}),
      label,
      necessityIndicator,
      size,
      fieldWidth: fieldRect.width,
      labelWidth: rect.width,
      labelHeight: rect.height,
      lineHeight: getComputedStyle(element).lineHeight,
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: getComputedStyle(element).fontSize,
      fontWeight: getComputedStyle(element).fontWeight,
      lines,
      indicator: {
        x: part.x - fieldRect.x,
        y: part.y - fieldRect.y,
        width: part.width,
        height: part.height,
      },
    };
  } finally {
    root.unmount();
    host.remove();
  }
}
