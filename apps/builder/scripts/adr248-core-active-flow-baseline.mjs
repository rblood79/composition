#!/usr/bin/env node
// ADR-248 G0: old public command values through canonical, readers, IDB and refresh.
// No new document payload is used as an input to this driver.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  loadStorageState,
  waitReady,
} from "./perf-baseline.mjs";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Old active flow baseline uses another HEAD");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const buildIndexSha256 = sha256(
  readFileSync(resolve(root, "apps/builder/dist/index.html")),
);
const frameId = "adr248-flow-frame";
const childId = "adr248-flow-child";
const refId = "adr248-flow-ref";
const descendantKey = "Label";
const stateValue = [
  {
    id: "flow-variable",
    name: "flowVariable",
    type: "boolean",
    defaultValue: false,
  },
];
const eventValue = {
  id: "flow-event",
  type: "interaction",
  elementId: refId,
  trigger: "onPress",
  action: { kind: "navigate", params: { path: "/home" } },
};
const scenario = {
  id: "adr248-old-core-active-flow-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    {
      op: "insertFrame",
      id: "frame",
      parent: "page",
      child: "child",
      clip: true,
      placeholder: true,
    },
    { op: "setElementState", id: "child", variable: "flow-variable" },
    {
      op: "insertRef",
      id: "ref",
      origin: "component-iconbutton",
      parent: "page",
    },
    { op: "patchDescendant", id: "ref", path: descendantKey, text: "G0 label" },
    { op: "setPageLayoutResponsive", mobileGap: 44, mobileColumns: 1 },
    { op: "setPagePlacementResponsive", mobileLeft: 15 },
    { op: "addTheme", id: "theme-2", name: "G0 theme", tint: "red" },
    { op: "setThemeToken", key: "color.accent", value: "#112233" },
    { op: "addInteraction", id: "flow-event", trigger: "onPress" },
    { op: "refresh" },
  ],
  expectedRelations: [
    ["child", "frame"],
    ["frame", "page"],
    ["ref", "page"],
    ["ref", "component-iconbutton"],
  ],
};
const scenarioHash = sha256(JSON.stringify(scenario));
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(
      resolve(root, "apps/builder/scripts/.auth-session.json"),
      baseUrl,
    ),
    frameCapture: false,
    deviceScaleFactor: scenario.dpr,
  });
  try {
    await createIsolatedProject(page, baseUrl);
    const projectId = new URL(page.url()).pathname.split("/").pop();
    const pageId = await page.evaluate(
      () => window.__composition_STORE__.getState().currentPageId,
    );
    assert.ok(pageId);
    const authored = await page.evaluate(
      async ({
        frameId,
        childId,
        refId,
        stateValue,
        descendantKey,
        eventValue,
      }) => {
        const current = window.__composition_STORE__.getState();
        const body = current.elements.find(
          (item) =>
            item.type === "body" && item.page_id === current.currentPageId,
        );
        if (!body) throw new Error("Page body missing");
        const now = new Date().toISOString();
        await current.addComplexElement(
          {
            id: frameId,
            type: "frame",
            parent_id: body.id,
            page_id: current.currentPageId,
            order_num: 0,
            created_at: now,
            updated_at: now,
            clip: true,
            placeholder: true,
            props: {
              style: {
                position: "absolute",
                left: "80px",
                top: "60px",
                width: "300px",
                height: "180px",
                border: "2px solid #3851a4",
              },
            },
          },
          [
            {
              id: childId,
              type: "Text",
              parent_id: frameId,
              page_id: current.currentPageId,
              order_num: 0,
              created_at: now,
              updated_at: now,
              props: {
                children: "G0 child",
                style: {
                  position: "absolute",
                  left: "8px",
                  top: "8px",
                  width: "160px",
                  height: "40px",
                },
              },
            },
          ],
        );
        await window.__composition_STORE__
          .getState()
          .updateElement(childId, { state: stateValue });
        await window.__composition_STORE__.getState().addElement({
          id: refId,
          type: "ref",
          ref: "component-iconbutton",
          componentName: "IconButton",
          parent_id: body.id,
          page_id: current.currentPageId,
          created_at: now,
          updated_at: now,
          props: {
            style: {
              position: "absolute",
              left: "430px",
              top: "70px",
              width: "180px",
              height: "60px",
            },
          },
        });
        const canonical = window.__canonical_STORE__.getState();
        canonical.updateDescendant(refId, descendantKey, {
          children: "G0 label",
        });
        canonical.setPageLayout({
          responsive: { gap: { mobile: 44 }, columns: { mobile: 1 } },
        });
        canonical.setPagePlacements([
          {
            pageId: current.currentPageId,
            placement: {
              style: { position: "absolute", left: 48, top: 64 },
              responsive: { left: { mobile: 15 } },
            },
          },
        ]);
        const themes =
          await import("/src/builder/panels/themes/themeActions.ts");
        const themeId = themes.addTheme("G0 theme");
        if (themeId !== "theme-2")
          throw new Error(`Unexpected theme id: ${themeId}`);
        if (!themes.setActiveTheme(themeId))
          throw new Error("Theme activation failed");
        if (!themes.setActiveThemePreset({ tint: "red" }))
          throw new Error("Theme preset failed");
        if (
          !themes.setThemeToken(themeId, "color.accent", {
            type: "color",
            value: "#112233",
            source: "spec-token",
          })
        )
          throw new Error("Theme token failed");
        canonical.addEvent(eventValue);
        return { bodyId: body.id, themeId };
      },
      { frameId, childId, refId, stateValue, descendantKey, eventValue },
    );
    const readCanonical = () =>
      page.evaluate(
        ({ projectId, pageId, frameId, childId, refId }) => {
          const doc = window.__canonical_STORE__
            .getState()
            .getDocument(projectId);
          if (!doc) throw new Error("Canonical document missing");
          const find = (items, id) => {
            for (const item of items ?? []) {
              if (item.id === id) return item;
              const child = find(item.children, id);
              if (child) return child;
            }
            return null;
          };
          const frame = find(doc.children, frameId);
          const child = find(doc.children, childId);
          const ref = find(doc.children, refId);
          const origin = find(doc.children, "component-iconbutton");
          if (!frame || !child || !ref || !origin)
            throw new Error("Authored nodes missing");
          return {
            version: doc.version,
            rootChildCount: doc.children.length,
            rootChildIds: doc.children.map((item) =>
              item.id === pageId ? "<page>" : item.id,
            ),
            absentRootFields: [
              "tokens",
              "componentRules",
              "imports",
              "pagePositions",
              "_meta",
              "actions",
            ].filter((key) => !Object.hasOwn(doc, key)),
            frame: {
              type: frame.type,
              clip: frame.clip ?? null,
              placeholder: frame.placeholder ?? null,
              childIds: (frame.children ?? []).map((item) => item.id),
            },
            child: { type: child.type, state: child.state ?? null },
            ref: {
              type: ref.type,
              ref: ref.ref ?? null,
              descendants: ref.descendants ?? null,
            },
            origin: {
              type: origin.type,
              reusable: origin.reusable ?? null,
              childIds: (origin.children ?? []).map((item) => item.id),
            },
            layoutResponsive: doc.pageLayout?.responsive ?? null,
            placementModel: doc.pageLayout?.placementModel ?? null,
            legacyFallback: doc.pageLayout?.legacyFallback ?? null,
            placementResponsive:
              doc.pageLayout?.placements?.[pageId]?.responsive ?? null,
            themes: doc.themes
              ? {
                  active: doc.themes.active,
                  order: doc.themes.order,
                  item: doc.themes.items["theme-2"] ?? null,
                }
              : null,
            events: doc.events ?? null,
          };
        },
        { projectId, pageId, frameId, childId, refId },
      );
    const readPersisted = () =>
      page.evaluate(
        async ({ projectId, pageId, frameId, childId, refId }) => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open("composition");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            const tx = db.transaction(
              ["document_heads", "document_parts"],
              "readonly",
            );
            const get = (request) =>
              new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
            const [head, rootPart, framePart, childPart, refPart, originPart] =
              await Promise.all([
                get(tx.objectStore("document_heads").get(projectId)),
                ...[
                  "document",
                  `node:${frameId}`,
                  `node:${childId}`,
                  `node:${refId}`,
                  "node:component-iconbutton",
                ].map((key) =>
                  get(tx.objectStore("document_parts").get([projectId, key])),
                ),
              ]);
            if (
              !head ||
              !rootPart ||
              !framePart ||
              !childPart ||
              !refPart ||
              !originPart
            )
              return null;
            const doc = JSON.parse(rootPart.value);
            const frame = JSON.parse(framePart.value);
            const child = JSON.parse(childPart.value);
            const ref = JSON.parse(refPart.value);
            const origin = JSON.parse(originPart.value);
            return {
              hasRevision: Boolean(head.revision),
              version: doc.version,
              rootChildCount: doc.children.length,
              rootChildIds: doc.children.map((id) =>
                id === pageId ? "<page>" : id,
              ),
              absentRootFields: [
                "tokens",
                "componentRules",
                "imports",
                "pagePositions",
                "_meta",
                "actions",
              ].filter((key) => !Object.hasOwn(doc, key)),
              frame: {
                type: frame.type,
                clip: frame.clip ?? null,
                placeholder: frame.placeholder ?? null,
                childIds: frame.children ?? [],
              },
              child: { type: child.type, state: child.state ?? null },
              ref: {
                type: ref.type,
                ref: ref.ref ?? null,
                descendants: ref.descendants ?? null,
              },
              origin: {
                type: origin.type,
                reusable: origin.reusable ?? null,
                childIds: origin.children ?? [],
              },
              layoutResponsive: doc.pageLayout?.responsive ?? null,
              placementModel: doc.pageLayout?.placementModel ?? null,
              legacyFallback: doc.pageLayout?.legacyFallback ?? null,
              placementResponsive:
                doc.pageLayout?.placements?.[pageId]?.responsive ?? null,
              themes: doc.themes
                ? {
                    active: doc.themes.active,
                    order: doc.themes.order,
                    item: doc.themes.items["theme-2"] ?? null,
                  }
                : null,
              events: doc.events ?? null,
            };
          } finally {
            db.close();
          }
        },
        { projectId, pageId, frameId, childId, refId },
      );
    const after = await readCanonical();
    assert.equal(after.version, "composition-1.0");
    assert.equal(after.placementModel, "derived");
    assert.equal(after.legacyFallback, null);
    assert.deepEqual(after.absentRootFields, [
      "tokens",
      "componentRules",
      "imports",
      "pagePositions",
      "_meta",
      "actions",
    ]);
    assert.deepEqual(after.frame, {
      type: "frame",
      clip: true,
      placeholder: true,
      childIds: [childId],
    });
    assert.deepEqual(after.child.state, stateValue);
    assert.equal(after.ref.ref, "component-iconbutton");
    assert.equal(after.ref.descendants?.[descendantKey]?.children, "G0 label");
    assert.equal(after.origin.reusable, true);
    assert.equal(after.themes?.item?.preset?.tint, "red");
    assert.equal(
      after.themes?.item?.tokens?.["color.accent"]?.value,
      "#112233",
    );
    assert.deepEqual(after.events, [eventValue]);
    assert.equal(after.layoutResponsive?.gap?.mobile, 44);
    assert.equal(after.placementResponsive?.left?.mobile, 15);
    await page.waitForFunction(
      async ({ projectId, refId }) => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("composition");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const tx = db.transaction("document_parts", "readonly");
          const request = tx
            .objectStore("document_parts")
            .get([projectId, `node:${refId}`]);
          const part = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return Boolean(
            part &&
            JSON.parse(part.value).descendants?.Label?.children === "G0 label",
          );
        } finally {
          db.close();
        }
      },
      { projectId, refId },
      { timeout: 30_000 },
    );
    const persisted = await readPersisted();
    assert.ok(persisted?.hasRevision);
    assert.deepEqual(
      { ...persisted, hasRevision: undefined },
      { ...after, hasRevision: undefined },
    );
    const reader = await page.evaluate(
      async ({ projectId, pageId, childId, refId, root }) => {
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        const { resolveCanonicalDocument } =
          await import("/src/resolvers/canonical/index.ts");
        const { resolvePageLayout, resolvePagePlacementStyle } =
          await import("/src/builder/workspace/canvas/scene/pagePlacement.ts");
        const { resolveThemeSnapshot } =
          await import("/src/utils/theme/resolveThemeSnapshot.ts");
        const { DEFAULT_BASE_TYPOGRAPHY } =
          await import("/src/builder/fonts/customFonts.ts");
        const { buildInteractionIndex } = await import(
          `/@fs/${root}/packages/shared/src/interactions/bindings.ts`
        );
        const roots = resolveCanonicalDocument(doc);
        const walk = (items, id) => {
          for (const item of items ?? []) {
            if (item.id === id) return item;
            const result = walk(item.children, id);
            if (result) return result;
          }
          return null;
        };
        const projected = window.__composition_STORE__.getState().elements;
        const element = projected.find((item) => item.id === childId);
        const ref = walk(roots, refId);
        const theme = resolveThemeSnapshot(doc.themes.items["theme-2"], {
          rootTokens: doc.tokens,
          baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
        });
        const interaction = buildInteractionIndex(doc.events)
          .get(refId)
          ?.get("onPress");
        return {
          childElementState: element?.state ?? null,
          mobileLayout: resolvePageLayout(doc.pageLayout, "mobile", 2),
          mobilePlacement: resolvePagePlacementStyle(
            doc.pageLayout?.placements?.[pageId],
            "mobile",
          ),
          theme: {
            id: theme.themeId,
            tint: theme.cssVars.find(
              (item) => item.name === "--tint" && !item.isDark,
            )?.value,
            warningCount: theme.warnings.length,
          },
          interaction:
            interaction?.map((item) => ({
              id: item.id,
              trigger: item.trigger,
              action: item.action,
            })) ?? [],
          refResolved: ref
            ? {
                type: ref.type,
                childCount: ref.children?.length ?? 0,
                labels: (ref.children ?? []).map((item) => ({
                  name: item.name ?? null,
                  text: item.props?.children ?? null,
                })),
              }
            : null,
        };
      },
      { projectId, pageId, childId, refId, root },
    );
    assert.equal(reader.mobileLayout.gap, 44);
    assert.equal(reader.mobileLayout.columns, 1);
    assert.equal(reader.mobilePlacement.left, 15);
    assert.equal(reader.theme.id, "theme-2");
    assert.equal(reader.theme.tint, "#112233");
    assert.deepEqual(reader.interaction, [
      { id: "flow-event", trigger: "onPress", action: eventValue.action },
    ]);
    await page
      .locator('[data-testid="skia-canvas-unified"]')
      .waitFor({ state: "visible" });
    const geometry = await page.evaluate(
      ({ frameId, childId, refId }) => {
        const map = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
        if (!map) return null;
        const pick = (id) => {
          const value = map.get(id);
          return value
            ? {
                x: value.x,
                y: value.y,
                width: value.width,
                height: value.height,
              }
            : null;
        };
        return { frame: pick(frameId), child: pick(childId), ref: pick(refId) };
      },
      { frameId, childId, refId },
    );
    const capture = {
      animations: "disabled",
      clip: { x: 100, y: 100, width: 620, height: 400 },
    };
    const beforeRefreshPng = await page.screenshot({
      ...capture,
      path: resolve(out, "after.png"),
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await readCanonical();
    assert.deepEqual(refreshed, after);
    const refreshedPersisted = await readPersisted();
    assert.deepEqual(refreshedPersisted, persisted);
    await page
      .locator('[data-testid="skia-canvas-unified"]')
      .waitFor({ state: "visible" });
    const afterRefreshPng = await page.screenshot({
      ...capture,
      path: resolve(out, "after-refresh.png"),
    });
    const report = {
      head,
      buildIndexSha256,
      runtime: "old Builder dev",
      scenario,
      scenarioHash,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      semanticTree: [
        {
          id: "frame",
          type: after.frame.type,
          parent: "page",
          children: ["child"],
        },
        { id: "child", type: after.child.type, parent: "frame", children: [] },
        {
          id: "ref",
          type: after.ref.type,
          parent: "page",
          ref: after.ref.ref,
          descendantPaths: Object.keys(after.ref.descendants ?? {}),
        },
      ],
      geometry,
      after,
      reader,
      persisted,
      refreshed,
      screenshots: {
        after: { path: "after.png", sha256: sha256(beforeRefreshPng) },
        afterRefresh: {
          path: "after-refresh.png",
          sha256: sha256(afterRefreshPng),
        },
      },
      errors,
    };
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(
      `${out}/baseline.json: old core active flow persisted and refreshed\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
