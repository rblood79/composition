import { describe, expect, it } from "vitest";

import {
  createNumberFieldDefinition,
  createSearchFieldDefinition,
} from "../../factories/definitions/FormComponents";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
} from "../../factories/definitions/DateColorComponents";
import { getPropagationRules } from "../propagationRegistry";

/**
 * `size` propagation 의 `childPath` 가 **실제 factory 트리와 일치**하는지 구조 검증 (2026-07-14).
 *
 * **버그 계열 (사용자 적발 → 전수 확장)**: factory 가 자식 구조를 중첩으로 바꿨는데
 * (`X > SelectTrigger > {SelectValue, SelectIcon}`) propagation 규칙만 **옛 평면 경로**
 * (`childPath: "SelectIcon"`)로 남아 매칭에 실패했다.
 *
 * 매칭 실패의 증상이 **조용하다**는 게 위험하다:
 *  - 자식이 자기 `size` 를 안 갖고 있으면 Skia delegation(`props.size ?? delegated`)이
 *    부모 값을 대신 써서 **우연히 정상**으로 보인다 (DateInput 사례).
 *  - 자식 store 에 **stale `size`** 가 남아 있으면 그게 앞자리라 **부모를 영원히 가린다**
 *    (SelectIcon 사례 — 아이콘이 md 에서 안 변함).
 *
 * 그래서 "화면상 멀쩡해 보임" 은 근거가 못 되고, **경로 자체를 트리에 대고 확인**해야 한다.
 *
 * 검증: 각 컴포넌트의 `size` 규칙 childPath 를 factory 트리에서 실제로 따라가 본다.
 * 하나라도 해소 안 되면 실패 — 규칙이 트리와 어긋난 것.
 */

const CONTEXT = {
  parentElement: null,
  elements: [],
} as unknown as Parameters<typeof createNumberFieldDefinition>[0];

interface DefNode {
  type: string;
  children?: DefNode[];
}

/** factory definition → `{type, children}` 트리 (parent 노드 기준). */
function factoryTree(
  build: (ctx: typeof CONTEXT) => { parent: DefNode; children?: DefNode[] },
): DefNode {
  const def = build(CONTEXT);
  return { type: def.parent.type, children: def.children ?? [] };
}

/**
 * childPath(문자열=직계, 배열=중첩)를 트리에서 따라가 **매칭되는 모든 노드**를 반환.
 *
 * `find` 가 아니라 `filter` 인 것이 중요하다 — 실제 엔진(`propagationEngine.resolveChildPath`)도
 * 같은 type 의 형제를 **전부** 갱신한다. SearchField(search+clear) / NumberField(minus+plus) 는
 * SelectTrigger 아래 SelectIcon 이 **2개**라, first-match 로 보면 나머지 하나를 놓친 것처럼 오판한다.
 */
function resolvePathAll(root: DefNode, path: string | string[]): DefNode[] {
  const steps = Array.isArray(path) ? path : [path];
  let cursors: DefNode[] = [root];
  for (const step of steps) {
    cursors = cursors.flatMap(
      (c) => c.children?.filter((ch) => ch.type === step) ?? [],
    );
    if (cursors.length === 0) return [];
  }
  return cursors;
}

/** 트리에 존재하는 모든 자손 type (경로 검증 실패 시 진단용). */
function allDescendantTypes(node: DefNode, acc: string[] = []): string[] {
  for (const c of node.children ?? []) {
    acc.push(c.type);
    allDescendantTypes(c, acc);
  }
  return acc;
}

const TARGETS = [
  { type: "DatePicker", build: createDatePickerDefinition },
  { type: "DateRangePicker", build: createDateRangePickerDefinition },
  { type: "SearchField", build: createSearchFieldDefinition },
  { type: "NumberField", build: createNumberFieldDefinition },
] as const;

/**
 * size 를 시각에 반영하는 trigger 계열 자식 — 여기에 전파가 안 닿으면 stale size 가 남는다.
 * (Label 은 별도 delegation 경로가 있어 제외 — 본 계약의 대상은 trigger 서브트리.)
 */
const SIZE_BEARING_CHILDREN = [
  "SelectTrigger",
  "SelectValue",
  "SelectIcon",
  "DateInput",
] as const;

describe("size propagation childPath 가 factory 트리와 일치", () => {
  /**
   * **불변식**: factory 트리에 존재하는 size-bearing 자식은 **실제로 해소되는** size 규칙으로
   * 전부 덮여야 한다.
   *
   * 규칙 하나하나의 해소 여부를 보지 않고 **자식 커버리지**를 보는 이유: 트리에 없는 type 을
   * 가리키는 dead rule(예: DateRangePicker 의 `RangeCalendar` — factory 는 `Calendar` 를 만든다)
   * 은 무해하므로 실패로 볼 게 아니다. 정작 위험한 건 **자식이 트리에 있는데 아무 규칙도 못
   * 닿는** 경우 — 그러면 자식의 stale size 가 부모를 계속 가린다
   * (Skia 는 `props.size ?? delegated` 라 자기 size 가 앞자리).
   */
  it.each(TARGETS)(
    "$type — 트리의 size-bearing 자식이 해소 가능한 size 규칙으로 전부 덮인다",
    ({ type, build }) => {
      const tree = factoryTree(
        build as unknown as (ctx: typeof CONTEXT) => {
          parent: DefNode;
          children?: DefNode[];
        },
      );
      const sizeRules = (getPropagationRules(type) ?? []).filter(
        (r) => r.parentProp === "size",
      );
      expect(sizeRules.length, `${type} size 규칙 존재`).toBeGreaterThan(0);

      // 트리에서 **실제로 해소되는** 규칙이 도달한 노드만 covered 로 친다
      // (형제 동일 type 은 엔진과 동일하게 전부 포함).
      const covered = new Set<DefNode>();
      for (const rule of sizeRules) {
        for (const node of resolvePathAll(
          tree,
          rule.childPath as string | string[],
        )) {
          covered.add(node);
        }
      }

      // 트리에 존재하는 size-bearing 자식 중 아무 규칙도 못 닿은 것.
      const uncovered: string[] = [];
      const walk = (node: DefNode) => {
        for (const child of node.children ?? []) {
          if (
            (SIZE_BEARING_CHILDREN as readonly string[]).includes(child.type) &&
            !covered.has(child)
          ) {
            uncovered.push(child.type);
          }
          walk(child);
        }
      };
      walk(tree);

      expect(
        uncovered,
        `${type} size 전파가 못 닿는 자식 (실제 자손: ${[
          ...new Set(allDescendantTypes(tree)),
        ].join(", ")})`,
      ).toEqual([]);
    },
  );
});
