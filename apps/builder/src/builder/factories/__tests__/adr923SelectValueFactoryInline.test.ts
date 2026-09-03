import { describe, expect, it } from "vitest";
import { resolveSubpartStyleOwnerType } from "@composition/shared";

import type { CanvasLayoutNode } from "../../workspace/canvas/layout/layoutNode";
import { projectReadOnlySubpartStyle } from "../../workspace/canvas/layout/engines/readOnlySubpart";
import { createSearchFieldDefinition } from "../definitions/FormComponents";
import {
  createComboBoxDefinition,
  createSelectDefinition,
} from "../definitions/SelectionComponents";
import type { ComponentCreationContext, ComponentDefinition } from "../types";

/**
 * ADR-923 Phase 5 후속 착수 6 (2026-09-04) — **SelectValue factory 인라인 중복 제거**.
 *
 * 착수 4 (판정 A) 로 SelectValue 의 **style 축은 parent 소유** 가 됐다: DOM 렌더러는 자식의
 * `children`/`placeholder` 만 읽고 style 은 읽지 않으며, Canvas read 경로는 자식 인라인을 투영값으로
 * 바꿔 버린다 (`projectReadOnlySubpartStyle` 이 `display` 외 전부 버린다). 그래서 factory 가 심던
 * `{ flex: 1, textAlign: "left" }` 는 **두 표면 어디에도 닿지 않는 값**이었다 — 구조값 (flex 1 ·
 * minWidth 0 · fontSize · nowrap/ellipsis) 은 implicitStyles selecttrigger 분기의 read-through 주입이
 * 유일 채널이다.
 *
 * 이 게이트는 "지웠다" 가 아니라 **"지운 것이 닿지 않는 값이었다"** 를 술어로 고정한다 — 누가 다시
 * 심으면 그 값이 어디로도 가지 않는다는 사실이 RED 로 드러난다.
 *
 * 범위 밖 (기록): NumberField 의 SelectValue 는 owner 목록에 없어 인라인이 Canvas 에 그대로 실린다
 * (DOM `renderNumberField` 는 자식을 안 읽는다 — 같은 비대칭). owner 확장은 D3 경계 재판정이라
 * 사용자 결정 사항.
 */
const ctx = {
  parentElement: null,
  pageId: "page-test",
  elements: [],
  layoutId: null,
  doc: undefined,
} as unknown as ComponentCreationContext;

const CASES: Array<{ owner: string; def: ComponentDefinition }> = [
  { owner: "Select", def: createSelectDefinition(ctx) },
  { owner: "ComboBox", def: createComboBoxDefinition(ctx) },
  { owner: "SearchField", def: createSearchFieldDefinition(ctx) },
];

function selectValueChild(def: ComponentDefinition): Record<string, unknown> {
  const trigger = def.children?.find((c) => c.type === "SelectTrigger");
  expect(
    trigger,
    `${def.type}: factory 에 SelectTrigger 자식 없음`,
  ).toBeDefined();
  const value = (
    trigger as { children?: Array<{ type: string; props: unknown }> }
  ).children?.find((c) => c.type === "SelectValue");
  expect(
    value,
    `${def.type}: SelectTrigger 아래 SelectValue 없음`,
  ).toBeDefined();
  return (value as { props: Record<string, unknown> }).props;
}

describe("ADR-923 — SelectValue factory 인라인 (style 축 parent 소유)", () => {
  it("factory 는 SelectValue 에 style 을 심지 않는다", () => {
    for (const { owner, def } of CASES) {
      const props = selectValueChild(def);
      expect(
        props.style,
        `${owner} > SelectValue 의 factory style`,
      ).toBeUndefined();
      // 텍스트 축은 자식이 정본 — placeholder 는 그대로 남아야 한다.
      expect(
        typeof props.placeholder,
        `${owner} > SelectValue 의 placeholder`,
      ).toBe("string");
    }
  });

  it("심어도 Canvas 투영이 style 을 버린다 (지운 값이 닿지 않는 값이었다는 근거)", () => {
    for (const { owner } of CASES) {
      expect(
        resolveSubpartStyleOwnerType("SelectValue", "SelectTrigger", owner),
        `${owner} > SelectTrigger > SelectValue 의 style owner`,
      ).toBe(owner);

      const junk = {
        id: "sv-1",
        type: "SelectValue",
        props: { style: { flex: 1, textAlign: "left", fontSize: 30 } },
      } as unknown as CanvasLayoutNode;
      const projected = projectReadOnlySubpartStyle(
        junk,
        { id: "own", type: owner, props: {} } as unknown as CanvasLayoutNode,
        "SelectTrigger",
      );
      expect(projected, `${owner} > SelectValue 투영 style`).toEqual({});
    }
  });
});
