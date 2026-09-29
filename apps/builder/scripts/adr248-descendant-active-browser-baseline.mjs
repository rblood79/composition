#!/usr/bin/env node
// ADR-248 G0: old Builder public store command and isolated presentation boundary.
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
const dir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(dir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Descendant browser baseline HEAD drift");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
const out = resolve(process.argv[outIndex + 1]);
mkdirSync(out, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const buildIndexSha256 = sha256(
  readFileSync(resolve(root, "apps/builder/dist/index.html")),
);
const sourcePaths = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "apps/builder/src",
    "packages/shared/src",
    "packages/specs/src",
    "packages/engine/src",
  ],
  { cwd: root },
)
  .toString()
  .split("\0")
  .filter(Boolean);
const runtimeSourceHash = createHash("sha256");
for (const path of sourcePaths) {
  runtimeSourceHash.update(path);
  runtimeSourceHash.update("\0");
  runtimeSourceHash.update(readFileSync(resolve(root, path)));
  runtimeSourceHash.update("\0");
}
const runtimeSourceSha256 = runtimeSourceHash.digest("hex");
const iconRefId = "adr248-desc-icon-ref";
const listRefId = "adr248-desc-list-ref";
const scenario = {
  id: "adr248-old-active-descendant-commands-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "insertRef", id: "icon-ref", origin: "component-iconbutton" },
    { op: "insertRef", id: "list-ref", origin: "component-listbox" },
    {
      op: "toggleItemRole",
      target: "list-ref/component-listbox__item-1",
      role: "description",
      enabled: false,
    },
    {
      op: "presentationStylePatch",
      target: "icon-ref/Label",
      borderColor: "#ABCDEF",
    },
    {
      op: "presentationFillReplace",
      target: "icon-ref/Label",
      color: "#ABCDEF80",
    },
    { op: "refresh" },
    { op: "resetDescendantField", target: "icon-ref/Label", field: "style" },
  ],
  expectedRelations: [
    ["icon-ref", "component-iconbutton"],
    ["list-ref", "component-listbox"],
  ],
};
const scenarioHash = sha256(JSON.stringify(scenario));
const isolatedScenario = {
  id: "adr248-old-canonical-command-modes-b-c-v1",
  seed: 248,
  viewport: scenario.viewport,
  dpr: scenario.dpr,
  theme: scenario.theme,
  font: scenario.font,
  operations: [
    { op: "updateDescendant", target: "icon-ref/Label", type: "Heading" },
    {
      op: "updateDescendant",
      target: "list-ref/component-listbox__item-2/Description",
      children: ["owned-description"],
    },
    { op: "refresh" },
  ],
};
const isolatedScenarioHash = sha256(JSON.stringify(isolatedScenario));
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
    const servedIndex = await page.request.get(baseUrl);
    if (!servedIndex.ok())
      throw new Error(`Dev server index failed: ${servedIndex.status()}`);
    const servedIndexSha256 = sha256(await servedIndex.body());
    const projectId = new URL(page.url()).pathname.split("/").pop();
    const authored = await page.evaluate(
      async ({ iconRefId, listRefId, projectId }) => {
        const state = window.__composition_STORE__.getState();
        const body = state.elements.find(
          (item) =>
            item.type === "body" && item.page_id === state.currentPageId,
        );
        if (!body) throw new Error("Page body missing");
        const now = new Date().toISOString();
        for (const [id, origin, left] of [
          [iconRefId, "component-iconbutton", 130],
          [listRefId, "component-listbox", 400],
        ]) {
          await window.__composition_STORE__.getState().addElement({
            id,
            type: "ref",
            ref: origin,
            parent_id: body.id,
            page_id: state.currentPageId,
            created_at: now,
            updated_at: now,
            props: {
              style: {
                position: "absolute",
                left: `${left}px`,
                top: "100px",
                width: "220px",
                height: "140px",
              },
            },
          });
        }
        const { planItemRoleToggle } =
          await import("/src/builder/components/itemSlotRoles.ts");
        const itemId = `${listRefId}/component-listbox__item-1`;
        const roleUpdate = planItemRoleToggle(
          itemId,
          {
            mode: "instance",
            itemType: "ListBoxItem",
            rows: [
              {
                role: "description",
                required: false,
                enabled: true,
                present: true,
                segment: "Description",
              },
            ],
          },
          "description",
          false,
        );
        if (!roleUpdate) throw new Error("Role toggle rejected");
        window.__composition_STORE__.getState().setSelectedElement(itemId);
        window.__composition_STORE__
          .getState()
          .updateSelectedPropertiesWithChildren({}, [roleUpdate]);
        const presentation =
          await import("/src/builder/presentation/editorPresentationCommitAdapter.ts");
        const { FillType } = await import("/src/types/builder/fill.types.ts");
        const target = presentation.resolveEditorPresentationTarget(
          projectId,
          `${iconRefId}/Label`,
        );
        if (!target || target.kind !== "ref-descendant")
          throw new Error("Label presentation target missing");
        const fill = {
          blendMode: "normal",
          color: "#ABCDEF80",
          enabled: true,
          id: "fill-1",
          opacity: 1,
          type: FillType.Color,
        };
        presentation.commitEditorPresentationStyle({
          baseDocumentVersion:
            window.__canonical_STORE__.getState().documentVersion,
          commitIntent: "style-border-color",
          descriptor: {
            type: "style.patch",
            target,
            patch: { borderColor: "#ABCDEF" },
          },
          projectId,
          sessionId: "adr248-desc-style",
          targets: [target],
        });
        presentation.commitEditorPresentationFills({
          baseDocumentVersion:
            window.__canonical_STORE__.getState().documentVersion,
          commitIntent: "fill-color",
          descriptor: { type: "fills.replace", target, fills: [fill] },
          projectId,
          sessionId: "adr248-desc-fill",
          targets: [target],
        });
        return { pageId: "<page>", roleUpdate, target };
      },
      { iconRefId, listRefId, projectId },
    );
    const read = () =>
      page.evaluate(
        ({ projectId, iconRefId, listRefId }) => {
          const doc = window.__canonical_STORE__
            .getState()
            .getDocument(projectId);
          const find = (items, id) => {
            for (const item of items ?? []) {
              if (item.id === id) return item;
              const nested = find(item.children, id);
              if (nested) return nested;
            }
            return null;
          };
          const icon = find(doc?.children, iconRefId);
          const list = find(doc?.children, listRefId);
          if (!icon || !list) throw new Error("Authored refs missing");
          return {
            icon: { ref: icon.ref, label: icon.descendants?.Label ?? null },
            list: {
              ref: list.ref,
              description:
                list.descendants?.["component-listbox__item-1/Description"] ??
                null,
            },
          };
        },
        { projectId, iconRefId, listRefId },
      );
    const after = await read();
    assert.equal(after.icon.label.style.borderColor, "#ABCDEF");
    assert.equal(after.icon.label.fills[0].color, "#ABCDEF80");
    assert.equal(after.list.description.enabled, false);
    const reader = await page.evaluate(
      async ({ projectId, iconRefId, listRefId }) => {
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        const { resolveCanonicalDocument } =
          await import("/src/resolvers/canonical/index.ts");
        const roots = resolveCanonicalDocument(doc);
        const find = (nodes, id) => {
          for (const node of nodes ?? []) {
            if (node.id === id) return node;
            const nested = find(node.children, id);
            if (nested) return nested;
          }
          return null;
        };
        const icon = find(roots, iconRefId);
        const list = find(roots, listRefId);
        const iconLabel = (icon?.children ?? []).find(
          (item) => item.name === "Label",
        );
        const listItems = (list?.children ?? []).map((item) => ({
          id: item.id,
          childNames: (item.children ?? []).map((child) => child.name ?? null),
        }));
        return {
          iconLabel: iconLabel
            ? {
                style: iconLabel.props?.style ?? null,
                fills: iconLabel.fills ?? null,
              }
            : null,
          listItems,
        };
      },
      { projectId, iconRefId, listRefId },
    );
    assert.equal(reader.iconLabel?.style?.borderColor, "#ABCDEF");
    assert.equal(reader.iconLabel?.fills?.[0]?.color, "#ABCDEF80");
    assert.deepEqual(reader.listItems[0]?.childNames, ["Icon", "Label"]);
    assert.deepEqual(reader.listItems[1]?.childNames, [
      "Icon",
      "Label",
      "Description",
    ]);
    const isolatedResolver = await page.evaluate(async () => {
      const { resolveCanonicalDocument } =
        await import("/src/resolvers/canonical/index.ts");
      const { composeStateLayers } =
        await import("/src/builder/components/stateVariantLayers.ts");
      const modeB = resolveCanonicalDocument({
        version: "composition-1.0",
        children: [
          {
            id: "origin-b",
            type: "Button",
            reusable: true,
            children: [{ id: "label-b", type: "Label" }],
          },
          {
            id: "instance-b",
            type: "ref",
            ref: "origin-b",
            descendants: {
              "label-b": { id: "replacement-b", type: "Heading" },
            },
          },
        ],
      });
      const replaced =
        modeB.find((node) => node.id === "instance-b")?.children ?? [];
      const modeC = resolveCanonicalDocument({
        version: "composition-1.0",
        children: [
          {
            id: "origin-c",
            type: "frame",
            reusable: true,
            children: [
              { id: "slot-c", type: "frame", slot: ["card"], children: [] },
            ],
          },
          {
            id: "instance-c",
            type: "ref",
            ref: "origin-c",
            descendants: {
              "slot-c": { children: [{ id: "owned-c", type: "Card" }] },
            },
          },
        ],
      });
      const slot = modeC
        .find((node) => node.id === "instance-c")
        ?.children?.find((node) => node.id === "slot-c");
      const nested = resolveCanonicalDocument({
        version: "composition-1.0",
        children: [
          {
            id: "badge",
            type: "Button",
            reusable: true,
            children: [
              {
                id: "label",
                type: "Text",
                props: { children: "Text", style: { color: "red" } },
              },
            ],
          },
          {
            id: "host",
            type: "frame",
            reusable: true,
            children: [
              {
                id: "inner",
                type: "ref",
                ref: "badge",
                descendants: { label: { style: { color: "blue" } } },
              },
            ],
          },
          {
            id: "outer",
            type: "ref",
            ref: "host",
            descendants: { "inner/label": { style: { color: null } } },
          },
        ],
      });
      const nestedLabel = nested
        .find((node) => node.id === "outer")
        ?.children?.find((node) => node.id === "inner")
        ?.children?.find((node) => node.id === "label");
      const composed = composeStateLayers([
        {
          props: { style: { color: "red", fontSize: 12 } },
          fills: [{ id: "base-fill" }],
          descendants: { Label: { style: { color: "red" } } },
        },
        {
          props: { style: { color: null, fontWeight: 600 } },
          fills: [{ id: "state-fill" }],
          descendants: { Label: { style: { color: null, fontWeight: 600 } } },
        },
      ]);
      return {
        modeB: replaced.map((node) => ({ id: node.id, type: node.type })),
        modeC: {
          children:
            slot?.children?.map((node) => ({ id: node.id, type: node.type })) ??
            [],
          overrideKeys: slot?._overrides ?? [],
        },
        nestedNull: {
          children: nestedLabel?.props?.children ?? null,
          style: nestedLabel?.props?.style ?? null,
        },
        stateLayerComposition: composed,
      };
    });
    assert.deepEqual(isolatedResolver.modeB, [
      { id: "replacement-b", type: "Heading" },
    ]);
    assert.deepEqual(isolatedResolver.modeC.children, [
      { id: "owned-c", type: "Card" },
    ]);
    assert.equal(
      Object.hasOwn(isolatedResolver.nestedNull.style ?? {}, "color"),
      false,
    );
    assert.equal(
      isolatedResolver.stateLayerComposition?.fills?.[0]?.id,
      "state-fill",
    );
    await page.waitForFunction(
      async ({ projectId, iconRefId, listRefId }) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("composition");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        try {
          const tx = db.transaction("document_parts", "readonly");
          const readPart = (id) =>
            new Promise((resolve, reject) => {
              const req = tx
                .objectStore("document_parts")
                .get([projectId, `node:${id}`]);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
          const [icon, list] = await Promise.all([
            readPart(iconRefId),
            readPart(listRefId),
          ]);
          return Boolean(
            icon &&
            list &&
            JSON.parse(icon.value).descendants?.Label?.fills?.[0]?.color ===
              "#ABCDEF80" &&
            JSON.parse(list.value).descendants?.[
              "component-listbox__item-1/Description"
            ]?.enabled === false,
          );
        } finally {
          db.close();
        }
      },
      { projectId, iconRefId, listRefId },
      { timeout: 30_000 },
    );
    const persisted = await page.evaluate(
      async ({ projectId, iconRefId, listRefId }) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("composition");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        try {
          const tx = db.transaction("document_parts", "readonly");
          const get = (id) =>
            new Promise((resolve, reject) => {
              const req = tx
                .objectStore("document_parts")
                .get([projectId, `node:${id}`]);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
          const [icon, list] = await Promise.all([
            get(iconRefId),
            get(listRefId),
          ]);
          return {
            icon: {
              ref: JSON.parse(icon.value).ref,
              label: JSON.parse(icon.value).descendants?.Label ?? null,
            },
            list: {
              ref: JSON.parse(list.value).ref,
              description:
                JSON.parse(list.value).descendants?.[
                  "component-listbox__item-1/Description"
                ] ?? null,
            },
          };
        } finally {
          db.close();
        }
      },
      { projectId, iconRefId, listRefId },
    );
    assert.deepEqual(persisted, after);
    await page
      .locator('[data-testid="skia-canvas-unified"]')
      .waitFor({ state: "visible" });
    const geometry = await page.evaluate(
      ({ iconRefId, listRefId }) => {
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
        return { iconRef: pick(iconRefId), listRef: pick(listRefId) };
      },
      { iconRefId, listRefId },
    );
    const capture = {
      animations: "disabled",
      clip: { x: 100, y: 100, width: 700, height: 420 },
    };
    const beforePng = await page.screenshot({
      ...capture,
      path: resolve(out, "after.png"),
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await read();
    assert.deepEqual(refreshed, after);
    const afterPng = await page.screenshot({
      ...capture,
      path: resolve(out, "after-refresh.png"),
    });
    const resetAccepted = await page.evaluate(
      ({ iconRefId }) =>
        Boolean(
          window.__composition_STORE__
            .getState()
            .resetInstanceOverrideField(iconRefId, "style", "Label"),
        ),
      { iconRefId },
    );
    assert.equal(resetAccepted, true);
    const afterReset = await read();
    assert.equal(afterReset.icon.label.style, undefined);
    assert.equal(afterReset.icon.label.fills[0].color, "#ABCDEF80");
    const resetPng = await page.screenshot({
      ...capture,
      path: resolve(out, "after-reset.png"),
    });
    await page.waitForFunction(
      async ({ projectId, iconRefId }) => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open("composition");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        try {
          const tx = db.transaction("document_parts", "readonly");
          const part = await new Promise((resolve, reject) => {
            const req = tx
              .objectStore("document_parts")
              .get([projectId, `node:${iconRefId}`]);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const label = part && JSON.parse(part.value).descendants?.Label;
          return Boolean(
            label &&
            !Object.hasOwn(label, "style") &&
            label.fills?.[0]?.color === "#ABCDEF80",
          );
        } finally {
          db.close();
        }
      },
      { projectId, iconRefId },
      { timeout: 30_000 },
    );
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const resetRefreshed = await read();
    assert.deepEqual(resetRefreshed, afterReset);
    const isolatedStoreProbe = await page.evaluate(
      ({ iconRefId, listRefId, projectId }) => {
        window.__canonical_STORE__
          .getState()
          .updateDescendant(iconRefId, "Label", {
            id: "adr248-isolated-replacement",
            type: "Heading",
            props: { children: "Transient" },
          });
        window.__canonical_STORE__
          .getState()
          .updateDescendant(
            listRefId,
            "component-listbox__item-2/Description",
            {
              children: [
                {
                  id: "adr248-owned-description",
                  type: "Text",
                  props: { children: "Owned description" },
                },
              ],
            },
          );
        const find = (nodes, id) => {
          for (const node of nodes ?? []) {
            if (node.id === id) return node;
            const nested = find(node.children, id);
            if (nested) return nested;
          }
          return null;
        };
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        return {
          afterCommand: {
            modeB: find(doc?.children, iconRefId)?.descendants?.Label ?? null,
            modeC:
              find(doc?.children, listRefId)?.descendants?.[
                "component-listbox__item-2/Description"
              ] ?? null,
          },
        };
      },
      { iconRefId, listRefId, projectId },
    );
    assert.equal(isolatedStoreProbe.afterCommand.modeB?.type, "Heading");
    assert.equal(
      isolatedStoreProbe.afterCommand.modeC?.children?.[0]?.type,
      "Text",
    );
    isolatedStoreProbe.oldReader = await page.evaluate(
      async ({ projectId, iconRefId, listRefId }) => {
        const { resolveCanonicalDocument } =
          await import("/src/resolvers/canonical/index.ts");
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        const find = (nodes, id) => {
          for (const node of nodes ?? []) {
            if (node.id === id) return node;
            const nested = find(node.children, id);
            if (nested) return nested;
          }
          return null;
        };
        const ref = find(resolveCanonicalDocument(doc), iconRefId);
        const list = find(resolveCanonicalDocument(doc), listRefId);
        const second = list?.children?.find(
          (node) => node.id === "component-listbox__item-2",
        );
        const description = second?.children?.find(
          (node) => node.name === "Description",
        );
        return {
          modeB: (ref?.children ?? []).map((node) => ({
            id: node.id,
            type: node.type,
            text: node.props?.children ?? null,
          })),
          modeC: (description?.children ?? []).map((node) => ({
            id: node.id,
            type: node.type,
            text: node.props?.children ?? null,
          })),
        };
      },
      { projectId, iconRefId, listRefId },
    );
    assert.equal(
      isolatedStoreProbe.oldReader.modeB.find((node) => node.type === "Heading")
        ?.text,
      "Transient",
    );
    assert.equal(
      isolatedStoreProbe.oldReader.modeC.find((node) => node.type === "Text")
        ?.text,
      "Owned description",
    );
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    isolatedStoreProbe.afterRefresh = await page.evaluate(
      ({ projectId, iconRefId, listRefId }) => {
        const find = (nodes, id) => {
          for (const node of nodes ?? []) {
            if (node.id === id) return node;
            const nested = find(node.children, id);
            if (nested) return nested;
          }
          return null;
        };
        const doc = window.__canonical_STORE__
          .getState()
          .getDocument(projectId);
        return {
          modeB: find(doc?.children, iconRefId)?.descendants?.Label ?? null,
          modeC:
            find(doc?.children, listRefId)?.descendants?.[
              "component-listbox__item-2/Description"
            ] ?? null,
        };
      },
      { projectId, iconRefId, listRefId },
    );
    assert.deepEqual(
      isolatedStoreProbe.afterRefresh,
      isolatedStoreProbe.afterCommand,
    );
    const runtimeEnvironment = await page.evaluate(async () => {
      const { getCurrentThemeSnapshot } =
        await import("/src/utils/theme/installThemeSnapshot.ts");
      const theme = getCurrentThemeSnapshot();
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio,
        theme: theme
          ? {
              themeId: theme.themeId,
              preset: theme.preset,
              darkMode: theme.darkMode,
            }
          : null,
        documentTheme: document.documentElement.getAttribute("data-theme"),
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
      };
    });
    assert.deepEqual(runtimeEnvironment.viewport, scenario.viewport);
    assert.equal(runtimeEnvironment.dpr, scenario.dpr);
    assert.equal(runtimeEnvironment.theme?.darkMode, "light");
    const report = {
      head,
      buildIndexSha256,
      runtime: "old Builder dev",
      executionBuildIdentity: `dev-source:${runtimeSourceSha256}`,
      servedIndexSha256,
      runtimeEnvironment,
      scenario,
      scenarioHash,
      fontState: await page.evaluate(() => ({
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loadStatus: document.fonts.status,
      })),
      authored,
      after,
      reader,
      isolatedResolver,
      geometry,
      semanticTree: {
        iconLabel: {
          style: reader.iconLabel?.style ?? null,
          fillColor: reader.iconLabel?.fills?.[0]?.color ?? null,
        },
        listItems: reader.listItems,
      },
      persisted,
      refreshed,
      resetAccepted,
      afterReset,
      resetRefreshed,
      isolatedStoreProbe,
      isolatedScenario,
      isolatedScenarioHash,
      screenshots: {
        after: { path: "after.png", sha256: sha256(beforePng) },
        afterRefresh: { path: "after-refresh.png", sha256: sha256(afterPng) },
        afterReset: { path: "after-reset.png", sha256: sha256(resetPng) },
      },
      errors,
    };
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    writeFileSync(
      resolve(out, "baseline.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(
      `${out}/baseline.json: old descendant role/style/fill persisted and refreshed\n`,
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
