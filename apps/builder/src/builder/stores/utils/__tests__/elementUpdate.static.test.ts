import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementUpdate canonical-only read contract", () => {
  it("does not expose the zero-caller batchUpdateElements legacy action", async () => {
    const [actionSource, storeSource] = await Promise.all([
      readFile(resolve(__dirname, "../elementUpdate.ts"), "utf-8"),
      readFile(resolve(__dirname, "../../elements.ts"), "utf-8"),
    ]);

    for (const source of [actionSource, storeSource]) {
      expect(source).not.toContain("createBatchUpdateElementsAction");
      expect(source).not.toContain("BatchElementUpdate");
      expect(source).not.toContain("batchUpdateElements");
    }
  });

  it("single props update avoids full Element projection on the hot path", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );
    const action = source.slice(
      source.indexOf("export const createUpdateElementPropsAction"),
      source.indexOf("export const createUpdateElementAction"),
    );

    expect(action).toContain("getFirstProjectableNodeById(elementId)");
    expect(action).toContain("updateCanonicalNodePropsPrimary(");
    expect(action).not.toContain("getElementUpdateSourceElements()");
    expect(action).not.toContain("findElementForUpdate(");
    expect(action).not.toContain("buildElementUpdateLookup(");
    expect(action).not.toContain("buildElementUpdateChildrenByParent(");
    expect(action).not.toContain("syncUpdatedElementToCanonical(");
  });

  it("full element update uses the canonical target and incremental derived caches on its normal path", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );
    const action = source.slice(
      source.indexOf("export const createUpdateElementAction"),
      source.indexOf("export const createBatchUpdateElementPropsAction"),
    );

    expect(action).toContain("getFirstProjectableNodeById(elementId)");
    expect(action).toContain("createDerivedElementUpdate(");
    expect(action).toContain("updateCanonicalNodeFromElementPrimary(");
    expect(action).toContain("getProjectableChildrenByParent()");
    expect(action).not.toContain("getElementUpdateSourceElements()");
    expect(action).not.toContain("findElementForUpdate(");
    expect(action).not.toContain("findIndex(");
    expect(action).not.toContain("buildElementUpdateChildrenByParent(");
  });

  it("batch props update avoids full Element projection on the hot path", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );
    const action = source.slice(
      source.indexOf("export const createBatchUpdateElementPropsAction"),
    );

    expect(action).toContain("updateCanonicalNodePropsBatchPrimary(");
    expect(action).not.toContain("getElementUpdateSourceElements()");
    expect(action).not.toContain("buildElementUpdateLookup(");
    expect(action).not.toContain("buildElementUpdateChildrenByParent(");
    expect(action).not.toContain("syncUpdatedElementsToCanonical(");
  });

  it("uses only active canonical elements for mutation reads", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function buildElementUpdateLookup");
    expect(source).toContain(
      "sourceElements = getActiveCanonicalDocumentElements() ?? EMPTY_ELEMENTS",
    );
    expect(source).toContain("canonicalNodeToElement(");
    expect(source).toContain("getElementArrayIndex(sourceElements");
    expect(source).not.toContain("function getElementUpdateSourceElements");
    expect(source).not.toContain("function findElementForUpdate");
    expect(source).not.toContain("function buildElementUpdateChildrenByParent");
    expect(source).not.toContain("const { elements: legacyElements } = state");
    expect(source).toContain("buildElementUpdateLookup(sourceElements)");
    expect(source).not.toContain("buildElementUpdateLookup(state.elements)");

    const staleCurrentStateChildMap = [
      "currentState",
      ["children", "Map"].join(""),
    ].join(".");
    expect(source).not.toContain(staleCurrentStateChildMap);
    expect(source).toContain("function createDerivedPropsUpdate(");
    expect(source).toContain("new Map(state.elementsMap)");
    const staleHelper = ["get", "Element", "By", "Id"].join("");
    expect(source).not.toContain(staleHelper);
  });

  it("keeps update lookup and children cache contracts behind local aliases", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain("type ElementUpdateLookup");
    expect(source).toContain(
      'childrenByParent: ReadonlyMap<string, readonly Pick<Element, "id">[]>',
    );
    expect(source).not.toContain(
      "function buildElementUpdateLookup(elements: Element[]): Map<string, Element>",
    );
    expect(source).not.toContain(
      "const updatedElementMap = new Map<string, Element>();",
    );
    expect(source).not.toContain(
      "const elementsMap = new Map<string, Element>();",
    );
  });

  it("applies canonical mutations before updating the derived store cache", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    const propsSyncIndex = source.indexOf(
      "const canonicalResult = updateCanonicalNodePropsPrimary(",
    );
    const propsStoreIndex = source.indexOf(
      "elements: derivedUpdate.elements,\n        elementsMap: derivedUpdate.elementsMap,",
      propsSyncIndex,
    );
    expect(propsSyncIndex).toBeGreaterThanOrEqual(0);
    expect(propsStoreIndex).toBeGreaterThanOrEqual(0);
    expect(propsSyncIndex).toBeLessThan(propsStoreIndex);

    const elementActionIndex = source.indexOf(
      "export const createUpdateElementAction",
    );
    const elementSyncIndex = source.indexOf(
      "updateCanonicalNodeFromElementPrimary(derivedUpdate.element);",
      elementActionIndex,
    );
    const elementStoreIndex = source.indexOf(
      "elements: derivedUpdate.elements,\n        elementsMap: derivedUpdate.elementsMap,",
      elementSyncIndex,
    );
    expect(elementSyncIndex).toBeGreaterThanOrEqual(0);
    expect(elementStoreIndex).toBeGreaterThanOrEqual(0);
    expect(elementSyncIndex).toBeLessThan(elementStoreIndex);

    const batchPropsActionIndex = source.indexOf(
      "export const createBatchUpdateElementPropsAction",
    );
    const batchPropsHistoryIndex = source.indexOf(
      "historyManager.addEntry({",
      batchPropsActionIndex,
    );
    const batchPropsSyncIndex = source.indexOf(
      "const canonicalResult = updateCanonicalNodePropsBatchPrimary(",
      batchPropsActionIndex,
    );
    const batchPropsStoreIndex = source.indexOf(
      "elements: derivedUpdate.elements,\n        elementsMap: derivedUpdate.elementsMap,",
      batchPropsSyncIndex,
    );
    expect(batchPropsHistoryIndex).toBeGreaterThanOrEqual(0);
    expect(batchPropsSyncIndex).toBeGreaterThanOrEqual(0);
    expect(batchPropsStoreIndex).toBeGreaterThanOrEqual(0);
    expect(batchPropsHistoryIndex).toBeLessThan(batchPropsSyncIndex);
    expect(batchPropsSyncIndex).toBeLessThan(batchPropsStoreIndex);
  });
});

describe("elementUpdate responsive layout-invalidation contract (ADR-168)", () => {
  it("treats a responsive-only update as layout-affecting", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    // `responsive` 는 props 축이 아니라 top-level 필드다. props 키 검사만 하면
    // responsive-only write 가 layout 무영향으로 판정돼 layoutVersion 이 오르지 않고,
    // resolve 재계산·preview `@media` 재발행이 건너뛰어진다 (프리셋 적용 후 preview 가
    // 새로고침 전까지 이전 프리셋 규칙을 보여준 실측 결함).
    expect(source).toContain(
      'const hasResponsiveChange = "responsive" in sanitizedUpdates;',
    );

    const actionIndex = source.indexOf(
      "export const createUpdateElementAction",
    );
    const layoutChangeIndex = source.indexOf(
      "const isLayoutChange =",
      actionIndex,
    );
    expect(layoutChangeIndex).toBeGreaterThan(actionIndex);

    // isLayoutChange 가 responsive 항을 **먼저** 포함해야 한다 (props 부재 시 short-circuit)
    const expr = source.slice(layoutChangeIndex, layoutChangeIndex + 240);
    expect(expr).toContain("hasResponsiveChange ||");

    // layoutVersion bump 이 isLayoutChange 분기 안에 있음을 확인 (bump 누락 회귀 차단)
    const bumpIndex = source.indexOf(
      "layoutVersion: latestState.layoutVersion + 1",
      layoutChangeIndex,
    );
    expect(bumpIndex).toBeGreaterThan(layoutChangeIndex);
  });
});
