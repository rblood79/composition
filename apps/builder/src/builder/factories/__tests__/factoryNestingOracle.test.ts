/**
 * 팩토리 트리 ↔ 중첩 규칙 오라클.
 *
 * `RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES` 는 손으로 쓴 표라 틀릴 수
 * 있다. composition 이 실제로 만드는 합성 트리 (`definitions/*.ts` 의 `create*Definition`
 * 전부) 는 이 규칙을 **전부 통과**해야 한다 — 통과하지 못하면 표가 틀린 것이지 팩토리가
 * 틀린 게 아니다 (팩토리는 RAC 계약을 이미 따르고 있다). 표를 고친다.
 *
 * store 를 거치지 않으려고 `ComponentFactory.createComplexComponent` 대신 definition
 * 함수를 직접 부른다 (그쪽은 `addElementsToStore` → runner bridge 가 필요하다).
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  collectSubtreeNestingViolations,
  RAC_SUBPART_OWNER_TYPES,
  type NestingTreeNode,
} from "@composition/shared";

import * as DataComponents from "../definitions/DataComponents";
import * as DateColorComponents from "../definitions/DateColorComponents";
import * as DisplayComponents from "../definitions/DisplayComponents";
import * as FormComponents from "../definitions/FormComponents";
import * as GroupComponents from "../definitions/GroupComponents";
import * as LayoutComponents from "../definitions/LayoutComponents";
import * as NavigationComponents from "../definitions/NavigationComponents";
import * as OverlayComponents from "../definitions/OverlayComponents";
import * as SelectionComponents from "../definitions/SelectionComponents";
import * as TableComponents from "../definitions/TableComponents";
import type {
  ChildDefinition,
  ComponentCreationContext,
  ComponentDefinition,
} from "../types";

type DefinitionCreator = (
  context: ComponentCreationContext,
) => ComponentDefinition;

const MODULES: Record<string, Record<string, unknown>> = {
  DataComponents,
  DateColorComponents,
  DisplayComponents,
  FormComponents,
  GroupComponents,
  LayoutComponents,
  NavigationComponents,
  OverlayComponents,
  SelectionComponents,
  TableComponents,
};

const creators: Array<[string, DefinitionCreator]> = Object.entries(
  MODULES,
).flatMap(([moduleName, mod]) =>
  Object.entries(mod)
    .filter(
      (entry): entry is [string, DefinitionCreator] =>
        /^create[A-Za-z]+Definition$/.test(entry[0]) &&
        typeof entry[1] === "function",
    )
    .map(
      ([name, fn]) =>
        [`${moduleName}.${name}`, fn] as [string, DefinitionCreator],
    ),
);

const EMPTY_DOC: CompositionDocument = {
  version: "composition-1.0",
  children: [],
};

function makeContext(): ComponentCreationContext {
  return {
    parentElement: null,
    pageId: "page-1",
    elements: [],
    layoutId: null,
    doc: EMPTY_DOC,
  };
}

function toTree(definition: ComponentDefinition): NestingTreeNode {
  const walk = (child: ChildDefinition): NestingTreeNode => ({
    type: child.type,
    children: (child.children ?? []).map(walk),
  });
  return {
    type: definition.parent.type,
    children: definition.children.map(walk),
  };
}

describe("factory nesting oracle", () => {
  it("definition 생성기를 하나 이상 찾는다", () => {
    expect(creators.length).toBeGreaterThan(0);
  });

  it.each(creators)("%s 트리는 중첩 규칙을 전부 통과한다", (_name, create) => {
    const definition = create(makeContext());
    const tree = toTree(definition);
    // sub-part 생성기 (Radio · Tab …) 는 소유자 안에서만 뜻이 있으므로 소유자에 붙여
    // 검사한다 — 트리 **내부** 정합이 오라클의 대상이고, 어디에 떨어뜨릴 수 있는지는
    // drop·paste 경로의 guard 가 따로 본다.
    const owners = RAC_SUBPART_OWNER_TYPES[tree.type];
    const attachTo = owners ? [owners[0], "frame", "body"] : ["frame", "body"];
    const violations = collectSubtreeNestingViolations(tree, attachTo);
    expect(violations).toEqual([]);
  });
});
