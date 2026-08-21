import { describe, expect, it } from "vitest";

import {
  createNumberFieldDefinition,
  createSearchFieldDefinition,
  createTextAreaDefinition,
  createTextFieldDefinition,
} from "../../factories/definitions/FormComponents";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
} from "../../factories/definitions/DateColorComponents";
import {
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
} from "../../factories/definitions/NavigationComponents";
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
  // 2026-07-15 사용자 적발 — Disclosure 는 **size 규칙이 아예 0건**이었다 (아래 주석 참조).
  { type: "Disclosure", build: createDisclosureDefinition },
  // 2026-07-15 후속 적발 — DisclosureGroup 도 동일 부재. 여기는 **3단 중첩**
  //   (Group > Disclosure > {Header, Content}) 이라 childPath 가 배열이어야 한다.
  { type: "DisclosureGroup", build: createDisclosureGroupDefinition },
  // 2026-08-21 적발 — TextArea 는 `Input` 규칙이 **통째로 없었다**(형제 TextField 에는 있다).
  //   DOM 은 CSS 자손 셀렉터로 부모 size 가 내려가 정상으로 보였고, 캔버스(Skia)만 자식이
  //   catalog 기본값(md)에 고정됐다 — 한쪽만 어긋나 눈에 잘 안 띄던 형태.
  { type: "TextArea", build: createTextAreaDefinition },
  { type: "TextField", build: createTextFieldDefinition },
] as const;

/**
 * size 를 시각에 반영하는 자식 — 여기에 전파가 안 닿으면 자식이 defaultSize(md)에 고정된다.
 * (Label 은 별도 delegation 경로가 있어 제외 — 본 계약의 대상은 trigger/컨테이너 서브트리.)
 *
 * **DisclosureHeader / DisclosureContent 추가 (2026-07-15, 사용자 보고: "Disclosure size 변경 시
 * DisclosureHeader 변경 안 됨(css, skia), DisclosureContent(css만 변경)")**:
 * Disclosure 는 propagation 규칙이 **하나도 등록돼 있지 않았다** — 옛 경로 stale 이 아니라 **부재**.
 * 규칙 부재는 두 경로를 동시에 끊는다:
 *  1. Inspector 전파(`buildPropagationUpdates`) → 자식 store 에 size 가 안 써짐.
 *  2. **Skia delegation** — `resolveParentDelegatedSize` 가 `getParentTagsForChild()`(propagation
 *     **역인덱스**)로 부모를 찾는다. 규칙이 없으면 역인덱스도 비어 delegation 이 `null` →
 *     자식이 catalog `defaultSize`(md)로 고정. 두 자식 다 catalog 에 sm/md/lg sizes 가 있는데도
 *     Skia 가 md 만 그린 이유가 이것이다.
 * (DOM 은 별개 축 — `renderDisclosure` 가 wrapper self-compose 로 헤더를 직접 그려서 canonical
 *  자식 노드가 독립 렌더되지 않는다. Content 만 CSS `font-size` **상속**으로 우연히 반응했다.)
 *
 * **Disclosure 추가 (2026-07-15 후속, DisclosureGroup 적발)**: 그룹 관점에선 `Disclosure` 자신이
 * size-bearing 자식이다 — factory 가 자식 Disclosure 에 `size` 를 안 주므로 store 값이 `null` 이고,
 * 그룹 규칙이 없으면 delegation 도 없어 catalog `defaultSize`(md) 로 고정된다. 그룹 size 를 lg 로
 * 바꿔도 자식 Disclosure/Header/Content 가 md 에 머무는 원인.
 */
const SIZE_BEARING_CHILDREN = [
  // field 패밀리의 입력 상자. 2026-08-21 추가 — TextArea 결손을 잡는 축.
  "Input",
  "SelectTrigger",
  "SelectValue",
  "SelectIcon",
  "DateInput",
  "Disclosure",
  "DisclosureHeader",
  "DisclosureContent",
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
