#!/usr/bin/env node
// ADR-248 Phase 0: execute old Builder descendant planners against the old resolver.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
const inventory = JSON.parse(readFileSync(resolve(dir, "inventory.json"), "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(head, inventory.baselineHead);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync("git", ["ls-files", "-z", "apps/builder/src", "packages/shared/src", "packages/specs/src", "packages/engine/src"], { cwd: root })
  .toString().split("\0").filter(Boolean);
const sourceHash = createHash("sha256");
for (const path of sourcePaths) {
  sourceHash.update(path).update("\0").update(readFileSync(resolve(root, path))).update("\0");
}
const scenario = {
  id: "adr248-old-descendant-planner-reader-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  font: "app-default",
  theme: "default-light",
  operations: [
    { op: "insertCollectionItem", host: "tabs-instance/TabList", candidate: "Tab", key: "k3" },
    { op: "insertGroupItem", host: "radio-instance", candidate: "Radio", id: "radio-new" },
    { op: "insertTableColumn", host: "table-instance/TableHeader", key: "column1" },
    { op: "insertAndMoveChild", target: "slot-instance/slot", id: "moved-text" },
    { op: "replayInverse", target: "slot-instance/slot" },
    { op: "editOwnedSlotChild", target: "slot-instance/owned-label", text: "Edited owned" },
    { op: "bindPageLayout", page: "current", layout: "layout-origin", ownedChild: "header-note" },
    { op: "insertRef", id: "ordered-a", origin: "component-iconbutton" },
    { op: "insertRef", id: "ordered-b", origin: "component-iconbutton" },
    { op: "patchDescendant", id: "ordered-a", path: "Label", text: "Ordered label" },
    { op: "rename", id: "ordered-a", name: "Renamed ref" },
    { op: "reorderSibling", id: "ordered-a", direction: 1 },
    { op: "undo" },
    { op: "redo" },
    { op: "delete", id: "ordered-b" },
    { op: "resolveStateAndInstanceOwnership", state: "hover", target: "state-instance/Label" },
    { op: "duplicate", id: "ordered-a" },
    { op: "copyPaste", source: "ordered-a" },
    { op: "detach", target: "duplicate-of-ordered-a" },
    { op: "resetDescendantField", id: "ordered-a", path: "Label", field: "children" },
    { op: "undo" },
    { op: "redo" },
  ],
};
const baseUrl = process.env.BUILDER_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: loadStorageState(resolve(root, "apps/builder/scripts/.auth-session.json"), baseUrl),
    frameCapture: false,
    deviceScaleFactor: 1,
  });
  try {
    await page.setViewportSize(scenario.viewport);
    await createIsolatedProject(page, baseUrl);
    const servedIndexSha256 = hash(await (await page.request.get(baseUrl)).body());
    const output = await page.evaluate(async ({ orderModuleUrl }) => {
      const { resolveCanonicalDocument } = await import("/src/resolvers/canonical/index.ts");
      const { planTabItemInsert } = await import("/src/builder/components/collectionItemInsert.ts");
      const { planGroupItemInsert } = await import("/src/builder/components/groupItemInsert.ts");
      const { planTableColumnInsert, resolveTableHeaderHostId } = await import("/src/builder/components/tableColumnInsert.ts");
      const { insertCanonicalChild, moveCanonicalChildToDescendants } = await import(orderModuleUrl);
      const { applyCanonicalHistoryEventsToDocument } = await import("/src/builder/stores/history/canonicalHistoryEvents.ts");
      const { applyEditToSlotFill } = await import("/src/builder/components/slotFillEdit.ts");
      const { applyPageFrameBindingExplicit } = await import("/src/adapters/canonical/pageFrameBinding.ts");
      const { readStateLayerProjection } = await import("/src/builder/components/stateVariantLayers.ts");
      const { resolveStateLayerStyle, toStateLayerDescendantsValue, applyStateLayerToDescendant } = await import("/src/preview/utils/stateLayerRender.ts");
      const projectId = window.__canonical_STORE__.getState().currentProjectId;
      const source = window.__canonical_STORE__.getState().getDocument(projectId);
      const find = (nodes, id) => {
        for (const node of nodes ?? []) {
          if (node.id === id) return node;
          const hit = find(node.children, id);
          if (hit) return hit;
        }
        return null;
      };
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const active = window.__composition_STORE__.getState();
      const body = active.elements.find((item) => item.type === "body" && item.page_id === active.currentPageId);
      if (!body) throw new Error("Page body missing for public reorder");
      const now = new Date().toISOString();
      for (const [id, left] of [["adr248-ordered-a", 100], ["adr248-ordered-b", 300]]) {
        await window.__composition_STORE__.getState().addElement({
          id, type: "ref", ref: "component-iconbutton", parent_id: body.id,
          page_id: active.currentPageId, created_at: now, updated_at: now,
          props: { style: { position: "absolute", left: `${left}px`, top: "200px", width: "180px", height: "60px" } },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      window.__canonical_STORE__.getState().updateDescendant("adr248-ordered-a", "Label", { children: "Ordered label" });
      await window.__composition_STORE__.getState().updateElement("adr248-ordered-a", { name: "Renamed ref" });
      const getPublicReader = () => {
        const doc = window.__canonical_STORE__.getState().getDocument(projectId);
        const page = find(doc.children, active.currentPageId);
        const bodyNode = page?.children?.find((item) => item.id === body.id);
        const resolvedA = find(resolveCanonicalDocument(doc), "adr248-ordered-a");
        return {
          siblingOrder: (bodyNode?.children ?? []).filter((item) => item.id.startsWith("adr248-ordered-")).map((item) => item.id),
          name: resolvedA?.name ?? null,
          canonicalName: find(doc.children, "adr248-ordered-a")?.name ?? null,
          storeName: window.__composition_STORE__.getState().elements.find((item) => item.id === "adr248-ordered-a")?.name ?? null,
          label: resolvedA?.children?.find((item) => item.name === "Label")?.props?.children ?? null,
        };
      };
      const publicBefore = getPublicReader();
      const reordered = window.__composition_STORE__.getState().reorderElementWithinParent("adr248-ordered-a", 1);
      const publicAfter = getPublicReader();
      await window.__composition_STORE__.getState().undo();
      const publicUndo = getPublicReader();
      await window.__composition_STORE__.getState().redo();
      const publicRedo = getPublicReader();
      await window.__composition_STORE__.getState().removeElement("adr248-ordered-b");
      const publicDeleted = getPublicReader();
      const canvasActions = await import("/src/builder/workspace/canvas/actions/canvasActions.ts");
      const actionContext = () => ({ elementsMap: new Map(window.__composition_STORE__.getState().elementsMap) });
      window.__composition_STORE__.getState().setSelectedElements(["adr248-ordered-a"]);
      await canvasActions.duplicateSelection(actionContext());
      const duplicateIds = window.__composition_STORE__.getState().selectedElementIds.filter((id) => id !== "adr248-ordered-a");
      const duplicateId = duplicateIds[0] ?? null;
      let clipboard = null;
      window.__composition_STORE__.getState().setSelectedElements(["adr248-ordered-a"]);
      const copied = await canvasActions.copySelection({ ...actionContext(), writeClipboardText: async (text) => { clipboard = text; return true; } });
      const beforePasteIds = new Set(window.__composition_STORE__.getState().elementsMap.keys());
      await canvasActions.paste({ ...actionContext(), readClipboardText: async () => clipboard, pasteHistory: "batch" });
      const pastedIds = [...window.__composition_STORE__.getState().elementsMap.keys()].filter((id) => !beforePasteIds.has(id) && !id.includes("/"));
      const duplicateNode = duplicateId ? find(window.__canonical_STORE__.getState().getDocument(projectId).children, duplicateId) : null;
      const pastedNodes = pastedIds.map((id) => find(window.__canonical_STORE__.getState().getDocument(projectId).children, id)).filter(Boolean);
      const detached = duplicateId ? window.__composition_STORE__.getState().detachInstance(duplicateId) : null;
      const detachedNode = duplicateId ? find(window.__canonical_STORE__.getState().getDocument(projectId).children, duplicateId) : null;
      const resetAccepted = window.__composition_STORE__.getState().resetInstanceOverrideField("adr248-ordered-a", "children", "Label");
      const resetReader = getPublicReader();
      await window.__composition_STORE__.getState().undo();
      const resetUndoReader = getPublicReader();
      await window.__composition_STORE__.getState().redo();
      const resetRedoReader = getPublicReader();
      const withInstance = (id, ref) => ({ ...source, children: [...source.children, { id, type: "ref", ref, props: {} }] });
      const collectionDoc = withInstance("adr248-tabs", "component-tabs");
      const collectionPlan = planTabItemInsert({ document: collectionDoc, hostId: "adr248-tabs/component-tabs__1", candidateId: "component-tab-item-default", newKey: "k3" });
      if (collectionPlan?.kind !== "instance") throw new Error("Collection instance plan unavailable");
      const collectionNext = clone(collectionDoc);
      find(collectionNext.children, "adr248-tabs").descendants = collectionPlan.descendants;
      const collectionReader = find(resolveCanonicalDocument(collectionNext), "adr248-tabs");
      const groupDoc = clone(withInstance("adr248-radio", "component-radiogroup"));
      find(groupDoc.children, "component-radiogroup__2").props.isSelected = true;
      find(groupDoc.children, "adr248-radio").props.value = "option1";
      const groupPlan = planGroupItemInsert({ document: groupDoc, hostId: "adr248-radio", candidateId: "component-radio", newId: "adr248-radio-new" });
      if (!groupPlan) throw new Error("Group instance plan unavailable");
      const groupNext = clone(groupDoc);
      const groupInstance = find(groupNext.children, "adr248-radio");
      groupInstance.children = [...(groupInstance.children ?? []), groupPlan.child];
      if (groupPlan.instanceDescendants) groupInstance.descendants = groupPlan.instanceDescendants;
      for (const update of groupPlan.propsUpdates) {
        const target = find(groupNext.children, update.id);
        if (target) target.props = { ...(target.props ?? {}), ...update.props };
      }
      const groupReader = find(resolveCanonicalDocument(groupNext), "adr248-radio");
      const tableDoc = withInstance("adr248-table", "component-table");
      const tableHost = resolveTableHeaderHostId(tableDoc, "adr248-table");
      const tablePlan = planTableColumnInsert({ document: tableDoc, hostId: tableHost });
      if (tablePlan?.kind !== "instance") throw new Error("Table instance plan unavailable");
      const tableNext = clone(tableDoc);
      find(tableNext.children, "adr248-table").descendants = tablePlan.descendants;
      const tableReader = find(resolveCanonicalDocument(tableNext), "adr248-table");
      const orderDoc = {
        version: "composition-1.0",
        children: [
          { id: "adr248-origin", type: "frame", reusable: true, children: [{ id: "adr248-slot", type: "Slot", props: { name: "content" }, children: [] }] },
          { id: "adr248-instance", type: "ref", ref: "adr248-origin", descendants: { "adr248-slot": { children: [{ id: "adr248-owned-first", type: "Text", props: { children: "First" } }] } } },
          { id: "adr248-moved", type: "Text", props: { children: "Moved" } },
        ],
      };
      const inserted = insertCanonicalChild(orderDoc, null, { id: "adr248-later", type: "Text", props: { children: "Later" } }, 2);
      if (!inserted.changed) throw new Error("Old insert order rejected");
      const moved = moveCanonicalChildToDescendants(inserted.document, "adr248-moved", "adr248-instance", "adr248-slot", 1);
      if (!moved.changed) throw new Error("Old descendant move rejected");
      const movedReader = find(resolveCanonicalDocument(moved.document), "adr248-instance");
      const beforeRef = find(inserted.document.children, "adr248-instance");
      const afterRef = find(moved.document.children, "adr248-instance");
      const inverseEvents = [
        { type: "remove", node: clone(beforeRef), parentId: null, index: 1 },
        { type: "insert", node: clone(afterRef), parentId: null, index: 1 },
      ];
      const undone = applyCanonicalHistoryEventsToDocument(moved.document, inverseEvents, "undo");
      const redone = applyCanonicalHistoryEventsToDocument(undone, inverseEvents, "redo");
      const childNames = (doc) => (find(resolveCanonicalDocument(doc), "adr248-instance")?.children ?? [])
        .find((child) => child.id === "adr248-slot")?.children?.map((child) => child.props?.children) ?? [];
      const editedSlot = applyEditToSlotFill(orderDoc.children[1].descendants, "adr248-slot/adr248-owned-first", { children: "Edited owned", style: { color: null, fontWeight: 600 } });
      if (!editedSlot) throw new Error("Owned slot child edit rejected");
      const slotEditDoc = clone(orderDoc);
      find(slotEditDoc.children, "adr248-instance").descendants = editedSlot;
      const slotEditReader = find(resolveCanonicalDocument(slotEditDoc), "adr248-instance")?.children?.find((child) => child.id === "adr248-slot")?.children?.[0];
      const stateDoc = {
        version: "composition-1.0",
        children: [
          { id: "state-origin", type: "Button", reusable: true, props: { style: { color: "red", fontSize: 12 } }, children: [{ id: "Label", type: "Text", props: { children: "Base", style: { color: "red", fontSize: 12 } } }] },
          { id: "state-origin--hover", type: "ref", ref: "state-origin", reusable: true, metadata: { variant: "hover" }, props: { style: { color: "blue", fontWeight: 600 } }, fills: [{ id: "state-fill", type: "color", color: "#112233" }], descendants: { Label: { children: "Hover", style: { color: "orange", fontSize: 18 } } } },
          { id: "state-instance", type: "ref", ref: "state-origin", props: { style: { color: "purple" } }, fills: [{ id: "own-fill", type: "color", color: "#334455" }], descendants: { Label: { children: "Owned", style: { color: "green" } } } },
        ],
      };
      const stateResolved = find(resolveCanonicalDocument(stateDoc), "state-instance");
      const projection = readStateLayerProjection(stateResolved?.props?._stateLayers);
      if (!projection) throw new Error(`State layer projection missing: ${JSON.stringify(stateResolved?.props)}`);
      const activeHover = { selected: false, disabled: false, hovered: true };
      const rootStyle = resolveStateLayerStyle("Button", stateResolved.props.style, projection, activeHover);
      const labelNode = stateResolved.children?.find((node) => node.id === "Label");
      const descendantState = applyStateLayerToDescendant(toStateLayerDescendantsValue("state-instance", projection, activeHover), "state-instance/Label", labelNode?.props ?? {});
      const store = window.__composition_STORE__.getState();
      const pageId = store.currentPageId;
      const bindingDoc = clone(source);
      const bindingPage = find(bindingDoc.children, pageId);
      if (!bindingPage) throw new Error("Old page missing");
      bindingPage.children.push({ id: "adr248-header-note", type: "Text", props: { children: "Header note" }, metadata: { pageFrameSlotName: "header" } });
      bindingDoc.children.push({
        id: "adr248-layout-origin", type: "frame", reusable: true,
        metadata: { type: "legacy-layout", layoutId: "adr248-layout-origin" },
        children: [{ id: "adr248-layout-body", type: "body", children: [{ id: "adr248-layout-header", type: "Slot", props: { name: "header" } }] }],
      });
      window.__canonical_STORE__.getState().setDocument(projectId, bindingDoc);
      await applyPageFrameBindingExplicit({
        pageId,
        contextReason: "adr248-g0-isolated-oracle",
        frameId: "adr248-layout-origin",
        getElementsState: () => window.__composition_STORE__.getState(),
        setPages: (pages) => window.__composition_STORE__.setState({ pages }),
      });
      const boundDoc = window.__canonical_STORE__.getState().getDocument(projectId);
      const boundPage = find(boundDoc.children, pageId);
      const boundReader = find(resolveCanonicalDocument(boundDoc), pageId);
      const tabList = collectionReader?.children?.find((child) => child.type === "TabList");
      const tabPanels = collectionReader?.children?.find((child) => child.type === "TabPanels");
      const groupRadios = groupReader?.children?.filter((child) => child.type === "Radio") ?? [];
      const tableHeader = tableReader?.children?.find((child) => child.type === "TableHeader");
      return {
        collection: {
          hostId: "adr248-tabs/component-tabs__1",
          writer: {
            addedTab: collectionPlan.descendants["component-tabs__1"].children.at(-1),
            addedPanel: collectionPlan.descendants["component-tabs__2"].children.at(-1),
          },
          reader: {
            type: collectionReader?.type,
            tabLabels: tabList?.children?.map((tab) => tab.children?.find((child) => child.type === "Text")?.props?.children),
            addedTabKey: tabList?.children?.at(-1)?.props?.id,
            addedPanelKey: tabPanels?.children?.at(-1)?.props?.itemId,
          },
        },
        group: {
          hostId: "adr248-radio",
          writer: { descendants: groupPlan.instanceDescendants, child: groupPlan.child, propsUpdates: groupPlan.propsUpdates },
          reader: {
            type: groupReader?.type,
            value: groupReader?.props?.value,
            inheritedSelected: groupRadios.find((radio) => radio.id === "component-radiogroup__2")?.props?.isSelected,
            addedSelected: groupRadios.find((radio) => radio.id === "adr248-radio-new")?.props?.isSelected,
            addedValue: groupRadios.find((radio) => radio.id === "adr248-radio-new")?.props?.value,
          },
        },
        table: {
          hostId: tableHost,
          writer: tablePlan.descendants,
          reader: {
            type: tableReader?.type,
            columns: tableHeader?.children?.map((column) => ({ key: column.props?.key, label: column.props?.children })),
          },
        },
        structural: {
          writer: { insertedId: "adr248-later", index: 2 },
          reader: { rootOrder: inserted.document.children.map((child) => child.id), retainedDescendantText: childNames(inserted.document) },
        },
        elementMutation: {
          writer: { movedId: "adr248-moved", parent: "adr248-instance/adr248-slot", index: 1 },
          reader: { childTexts: movedReader?.children?.find((child) => child.id === "adr248-slot")?.children?.map((child) => child.props?.children) ?? [] },
        },
        historyInverse: {
          writer: { eventTypes: inverseEvents.map((event) => event.type), direction: ["undo", "redo"] },
          reader: { before: childNames(moved.document), undo: childNames(undone), redo: childNames(redone) },
        },
        slotOwnedEdit: { writer: editedSlot["adr248-slot"].children[0].props, reader: slotEditReader?.props ?? null },
        stateInstancePrecedence: {
          writer: { origin: "state-origin", variant: "state-origin--hover", instance: "state-instance", own: projection.own, active: activeHover },
          reader: { rootStyle, rootFills: stateResolved.fills, descendant: descendantState },
        },
        pageBinding: {
          writer: { ref: boundPage?.ref ?? null, descendantKeys: Object.keys(boundPage?.descendants ?? {}).sort(), headerChild: boundPage?.descendants?.header?.children?.[0]?.id ?? null },
          reader: { type: boundReader?.type ?? null, headerNote: JSON.stringify(boundReader).includes("Header note") },
        },
        publicReorderHistory: {
          writer: { reordered },
          reader: { before: publicBefore, after: publicAfter, undo: publicUndo, redo: publicRedo, deleted: publicDeleted },
        },
        publicClonePasteDetach: {
          writer: { copied, clipboardBytes: clipboard?.length ?? 0, duplicateCount: duplicateIds.length, pastedCount: pastedIds.length, detached: Boolean(detached) },
          reader: {
            duplicate: duplicateNode ? { type: duplicateNode.type, ref: duplicateNode.ref ?? null, label: duplicateNode.descendants?.Label?.children ?? null } : null,
            pasted: pastedNodes.map((node) => ({ type: node.type, ref: node.ref ?? null, label: node.descendants?.Label?.children ?? null })),
            detached: detachedNode ? { type: detachedNode.type, ref: detachedNode.ref ?? null } : null,
          },
        },
        publicDescendantResetHistory: {
          writer: { resetAccepted: Boolean(resetAccepted), field: "children", path: "Label" },
          reader: { before: publicDeleted.label, reset: resetReader.label, undo: resetUndoReader.label, redo: resetRedoReader.label },
        },
      };
    }, { orderModuleUrl: `/@fs${resolve(root, "packages/shared/src/utils/compositionDocumentOrder.ts")}` });
    assert.equal(output.collection.reader?.type, "Tabs");
    assert.equal(output.collection.reader.addedTabKey, "k3");
    assert.equal(output.collection.reader.addedPanelKey, "k3");
    assert.equal(output.group.reader?.type, "RadioGroup");
    assert.equal(output.group.writer.descendants?.["component-radiogroup__2"]?.isSelected, false);
    assert.equal(output.group.reader.inheritedSelected, false);
    assert.equal(output.group.reader.addedSelected, true);
    assert.equal(output.table.reader?.type, "Table");
    assert.deepEqual(output.table.reader.columns, [{ key: "column1", label: "Column 1" }]);
    assert.deepEqual(output.structural.reader.retainedDescendantText, ["First"]);
    assert.deepEqual(output.elementMutation.reader.childTexts, ["First", "Moved"]);
    assert.deepEqual(output.historyInverse.reader, { before: ["First", "Moved"], undo: ["First"], redo: ["First", "Moved"] });
    assert.equal(output.slotOwnedEdit.reader?.children, "Edited owned");
    assert.equal(output.stateInstancePrecedence.reader.rootStyle?.color, "purple");
    assert.equal(output.stateInstancePrecedence.reader.rootStyle?.fontWeight, 600);
    assert.equal(output.stateInstancePrecedence.reader.descendant.props?.children, "Owned");
    assert.equal(output.pageBinding.writer.headerChild, "adr248-header-note");
    assert.equal(output.pageBinding.reader.headerNote, true);
    assert.equal(output.publicReorderHistory.writer.reordered, true);
    assert.deepEqual(output.publicReorderHistory.reader.before.siblingOrder, ["adr248-ordered-a", "adr248-ordered-b"]);
    assert.deepEqual(output.publicReorderHistory.reader.after.siblingOrder, ["adr248-ordered-b", "adr248-ordered-a"]);
    assert.deepEqual(output.publicReorderHistory.reader.deleted.siblingOrder, ["adr248-ordered-a"]);
    assert.equal(output.publicClonePasteDetach.writer.copied, true);
    assert.equal(output.publicClonePasteDetach.writer.duplicateCount, 1);
    assert.equal(output.publicClonePasteDetach.writer.pastedCount, 1);
    assert.equal(output.publicDescendantResetHistory.writer.resetAccepted, true);
    const projectId = await page.evaluate(() => window.__canonical_STORE__.getState().currentProjectId);
    const pageId = await page.evaluate(() => window.__composition_STORE__.getState().currentPageId);
    await page.waitForFunction(async ({ projectId, pageId }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("composition");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const part = await new Promise((resolve, reject) => {
          const request = db.transaction("document_parts", "readonly").objectStore("document_parts").get([projectId, `node:${pageId}`]);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return part && JSON.parse(part.value).descendants?.header?.children?.[0]?.id === "adr248-header-note";
      } finally {
        db.close();
      }
    }, { projectId, pageId }, { timeout: 20_000 });
    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page, { settleMs: 0 });
    const refreshed = await page.evaluate(async ({ projectId, pageId }) => {
      const { resolveCanonicalDocument } = await import("/src/resolvers/canonical/index.ts");
      const doc = window.__canonical_STORE__.getState().getDocument(projectId);
      const page = doc.children.find((node) => node.id === pageId);
      const resolved = resolveCanonicalDocument(doc).find((node) => node.id === pageId);
      return { ref: page?.ref ?? null, headerChild: page?.descendants?.header?.children?.[0]?.id ?? null, readerHeaderNote: JSON.stringify(resolved).includes("Header note") };
    }, { projectId, pageId });
    assert.equal(refreshed.headerChild, "adr248-header-note");
    assert.equal(refreshed.readerHeaderNote, true);
    output.pageBinding.persistedAndRefreshed = refreshed;
    const environment = await page.evaluate(async () => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      theme: document.documentElement.dataset.theme ?? "default-light",
      font: getComputedStyle(document.body).fontFamily,
      fontLoadStatus: await document.fonts.ready.then(() => document.fonts.status),
    }));
    const report = {
      head,
      runtime: "old Builder isolated command planners and resolver in live dev execution",
      executionBuildIdentity: `dev-source:${sourceHash.digest("hex")}:index:${servedIndexSha256}`,
      buildIndexSha256: hash(readFileSync(resolve(root, "apps/builder/dist/index.html"))),
      scenario,
      scenarioHash: hash(JSON.stringify(scenario)),
      runtimeEnvironment: environment,
      oldOutput: output,
      errors,
    };
    const outAt = process.argv.indexOf("--out");
    if (outAt < 0 || !process.argv[outAt + 1]) throw new Error("--out path required");
    writeFileSync(resolve(process.argv[outAt + 1]), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(JSON.stringify({ scenarioHash: report.scenarioHash, environment, errors, output: { collection: output.collection.reader?.type, group: output.group.reader?.type, table: output.table.reader?.type } }) + "\n");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
