import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { migrateCheckboxRadioItemsStructure } from "../checkboxRadioItemsMigration";

/** 최소 CanonicalNode 빌더 (props 빈 객체, children 옵션) */
function node(
  type: string,
  id: string,
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    type,
    id,
    props: {},
    ...(children ? { children } : {}),
  } as CanonicalNode;
}

function doc(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children } as CompositionDocument;
}

function findNode(
  nodes: readonly CanonicalNode[],
  predicate: (n: CanonicalNode) => boolean,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (predicate(n)) return n;
    const found = findNode(n.children ?? [], predicate);
    if (found) return found;
  }
  return undefined;
}

function countNodes(
  nodes: readonly CanonicalNode[],
  predicate: (n: CanonicalNode) => boolean,
): number {
  let count = 0;
  for (const n of nodes) {
    if (predicate(n)) count++;
    count += countNodes(n.children ?? [], predicate);
  }
  return count;
}

describe("migrateCheckboxRadioItemsStructure", () => {
  it("CheckboxGroup > CheckboxItems > Checkbox 3단을 2단으로 승격한다", () => {
    const input = doc([
      node("frame", "page-1", [
        node("CheckboxGroup", "cg-1", [
          node("Label", "lbl-1"),
          node("CheckboxItems", "ci-1", [
            node("Checkbox", "cb-1", [node("Label", "cb-1-lbl")]),
            node("Checkbox", "cb-2", [node("Label", "cb-2-lbl")]),
          ]),
        ]),
      ]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);

    // CheckboxItems 중간 노드 제거됨
    expect(countNodes(result.children, (n) => n.type === "CheckboxItems")).toBe(
      0,
    );

    // Checkbox 2개가 CheckboxGroup 직속으로 승격
    const cg = findNode(result.children, (n) => n.id === "cg-1");
    expect(cg).toBeDefined();
    const cgChildTypes = (cg!.children ?? []).map((c) => c.type);
    expect(cgChildTypes).toEqual(["Label", "Checkbox", "Checkbox"]);

    // 자식 Checkbox 의 자식(Label)은 보존
    const cb1 = findNode(result.children, (n) => n.id === "cb-1");
    expect(cb1?.children?.map((c) => c.id)).toEqual(["cb-1-lbl"]);
  });

  it("RadioGroup > RadioItems > Radio 3단을 2단으로 승격한다", () => {
    const input = doc([
      node("frame", "page-1", [
        node("RadioGroup", "rg-1", [
          node("Label", "lbl-1"),
          node("RadioItems", "ri-1", [
            node("Radio", "r-1"),
            node("Radio", "r-2"),
          ]),
        ]),
      ]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);

    expect(countNodes(result.children, (n) => n.type === "RadioItems")).toBe(0);
    const rg = findNode(result.children, (n) => n.id === "rg-1");
    expect((rg!.children ?? []).map((c) => c.type)).toEqual([
      "Label",
      "Radio",
      "Radio",
    ]);
  });

  it("CheckboxItems 위치에 자식을 그대로 펼쳐 순서를 보존한다", () => {
    // Label, CheckboxItems(중간), 그리고 가상의 후행 노드 순서 보존 확인
    const input = doc([
      node("CheckboxGroup", "cg-1", [
        node("Label", "lbl"),
        node("CheckboxItems", "ci", [
          node("Checkbox", "a"),
          node("Checkbox", "b"),
        ]),
        node("Text", "trailing"),
      ]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);
    const cg = findNode(result.children, (n) => n.id === "cg-1");
    expect((cg!.children ?? []).map((c) => c.id)).toEqual([
      "lbl",
      "a",
      "b",
      "trailing",
    ]);
  });

  it("이미 2단 구조면 동일 참조를 반환한다 (멱등)", () => {
    const input = doc([
      node("CheckboxGroup", "cg-1", [
        node("Label", "lbl"),
        node("Checkbox", "cb-1"),
        node("Checkbox", "cb-2"),
      ]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);
    expect(result).toBe(input);
  });

  it("migration 결과를 재실행해도 변하지 않는다 (멱등 2회)", () => {
    const input = doc([
      node("RadioGroup", "rg-1", [
        node("RadioItems", "ri", [node("Radio", "r-1")]),
      ]),
    ]);

    const once = migrateCheckboxRadioItemsStructure(input);
    const twice = migrateCheckboxRadioItemsStructure(once);
    expect(twice).toBe(once);
  });

  it("CheckboxGroup 부모가 아닌 곳의 동명 노드는 건드리지 않는다", () => {
    // 부모가 frame 인 CheckboxItems(비정상 위치)는 부모 type 불일치로 strip 안 됨
    const input = doc([
      node("frame", "f-1", [node("CheckboxItems", "stray", [])]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);
    // 부모가 CheckboxGroup 이 아니므로 보존 (오인 strip 방지)
    expect(countNodes(result.children, (n) => n.type === "CheckboxItems")).toBe(
      1,
    );
    expect(result).toBe(input);
  });

  it("빈 CheckboxItems(자식 0개)는 흔적 없이 제거된다", () => {
    const input = doc([
      node("CheckboxGroup", "cg-1", [
        node("Label", "lbl"),
        node("CheckboxItems", "ci", []),
      ]),
    ]);

    const result = migrateCheckboxRadioItemsStructure(input);
    const cg = findNode(result.children, (n) => n.id === "cg-1");
    expect((cg!.children ?? []).map((c) => c.type)).toEqual(["Label"]);
  });
});
