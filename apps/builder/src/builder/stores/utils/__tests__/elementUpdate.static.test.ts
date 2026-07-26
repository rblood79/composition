import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementUpdate canonical read fallback contract", () => {
  it("uses active canonical elements before bootstrap store elements for mutation reads", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function getElementUpdateSourceElements");
    expect(source).toContain("function buildElementUpdateLookup");
    expect(source).toContain("function buildElementUpdateChildrenByParent");
    expect(source).toContain(
      "return getActiveCanonicalDocumentElements() ?? legacyElements",
    );
    expect(source).toContain("buildElementUpdateLookup(sourceElements)");
    expect(source).toContain(
      "buildElementUpdateChildrenByParent(sourceElements)",
    );
    expect(source).not.toContain("buildElementUpdateLookup(state.elements)");
    expect(source).not.toContain(
      "buildElementUpdateChildrenByParent(state.elements)",
    );

    const staleStateElementMap = ["state", ["elements", "Map"].join("")].join(
      ".",
    );
    const staleCurrentStateElementMap = [
      "currentState",
      ["elements", "Map"].join(""),
    ].join(".");
    const staleCurrentStateChildMap = [
      "currentState",
      ["children", "Map"].join(""),
    ].join(".");
    expect(source).not.toContain(staleStateElementMap);
    expect(source).not.toContain(staleCurrentStateElementMap);
    expect(source).not.toContain(staleCurrentStateChildMap);
    const staleHelper = ["get", "Element", "By", "Id"].join("");
    expect(source).not.toContain(staleHelper);
  });

  it("keeps update lookup and children cache contracts behind local aliases", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain("type ElementUpdateLookup");
    expect(source).toContain("type ElementUpdateChildrenByParent");
    expect(source).toContain(
      'childrenByParent: ReadonlyMap<string, readonly Pick<Element, "id">[]>',
    );
    expect(source).not.toContain(
      "function buildElementUpdateLookup(elements: Element[]): Map<string, Element>",
    );
    expect(source).not.toContain("): Map<string, Element[]> {");
    expect(source).not.toContain(
      "const updatedElementMap = new Map<string, Element>();",
    );
    expect(source).not.toContain(
      "const elementsMap = new Map<string, Element>();",
    );
    expect(source).not.toContain(
      "const newChildrenMap = new Map<string, Element[]>();",
    );
  });

  it("applies canonical mutations before updating the derived store cache", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    const propsSyncIndex = source.indexOf(
      "syncUpdatedElementToCanonical(updatedElement);",
    );
    const propsStoreIndex = source.indexOf(
      "elements: updatedElements,\n          elementsMap,",
    );
    expect(propsSyncIndex).toBeGreaterThanOrEqual(0);
    expect(propsStoreIndex).toBeGreaterThanOrEqual(0);
    expect(propsSyncIndex).toBeLessThan(propsStoreIndex);

    const elementSyncIndex = source.indexOf(
      "syncUpdatedElementToCanonical(latestUpdatedElement, sanitizedUpdates);",
    );
    const elementStoreIndex = source.indexOf(
      "elements: latestUpdatedElements,\n          selectedElementProps: latestSelectedElementProps,",
      elementSyncIndex,
    );
    expect(elementSyncIndex).toBeGreaterThanOrEqual(0);
    expect(elementStoreIndex).toBeGreaterThanOrEqual(0);
    expect(elementSyncIndex).toBeLessThan(elementStoreIndex);

    const batchPropsSyncIndex = source.indexOf(
      "syncUpdatedElementsToCanonical(updatedElementsForPersistence);",
    );
    const batchPropsStoreIndex = source.indexOf(
      "elements: updatedElements,\n        elementsMap: nextElementsMap,",
      batchPropsSyncIndex,
    );
    expect(batchPropsSyncIndex).toBeGreaterThanOrEqual(0);
    expect(batchPropsStoreIndex).toBeGreaterThanOrEqual(0);
    expect(batchPropsSyncIndex).toBeLessThan(batchPropsStoreIndex);

    const batchElementsSyncIndex = source.indexOf(
      "syncUpdatedElementsToCanonical(updatedElementsForPersistence, validUpdates);",
    );
    const batchElementsStoreIndex = source.indexOf(
      "elements: updatedElements,\n      selectedElementProps: selectedProps,",
      batchElementsSyncIndex,
    );
    expect(batchElementsSyncIndex).toBeGreaterThanOrEqual(0);
    expect(batchElementsStoreIndex).toBeGreaterThanOrEqual(0);
    expect(batchElementsSyncIndex).toBeLessThan(batchElementsStoreIndex);
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
      "layoutVersion: state.layoutVersion + 1",
      layoutChangeIndex,
    );
    expect(bumpIndex).toBeGreaterThan(layoutChangeIndex);
  });
});
