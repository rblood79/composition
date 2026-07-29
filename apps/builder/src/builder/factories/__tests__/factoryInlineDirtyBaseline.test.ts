// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { ComponentCreationContext, ComponentDefinition } from "../types";
import { computeDirtyStyleProps } from "../../panels/styles/hooks/useResetStyles";
import { getDefaultProps } from "../../../types/builder/unified.types";
import {
  createDialogDefinition,
  createPopoverDefinition,
  createTooltipDefinition,
} from "../definitions/OverlayComponents";
import {
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
  createPaginationDefinition,
} from "../definitions/NavigationComponents";
import {
  CARD_ORIGIN_ID,
  ensureCardTemplateOrigins,
} from "../../components/card/cardTemplateOrigins";
import {
  FORM_ORIGIN_ID,
  ensureFormTemplateOrigins,
} from "../../components/form/formTemplateOrigins";

/**
 * ADR-171 Phase 4 (R7) — factory 인라인 ↔ Inspector dirty baseline 쌍방 계약.
 *
 * `useResetStyles` 의 baseline 은 `getDefaultProps(type).style`(= `createDefault*Props`)이고,
 * 그 표는 factory definition 의 인라인을 **손으로 미러**한 것이다. 두 표는 서로를 모르므로
 * 한쪽만 고치면 조용히 어긋난다 — 양방향으로 회귀 이력이 있다:
 *
 *   - 인라인만 추가 → 미러 누락 → 갓 만든 요소가 "수정 N" (`useResetStyles.ts:292` 정정)
 *   - 인라인만 제거 → 미러 잔존 → reset 목적지가 없는 값을 가리킴 (ADR-171 R7)
 *
 * 그래서 두 방향을 각각 단언한다:
 *   ① 인라인 ⊆ baseline — 갓 만든 요소의 dirty 가 0 (= "수정 N" 뱃지 0)
 *   ② baseline ⊆ 인라인 — 미러가 factory 가 넣지 않는 layout 키를 주장하지 않음
 *
 * ②의 대상은 **layout 축 키**로 한정한다. `createDefault*Props` 에는 factory 미러가 아니라
 * "CSS base 값" 을 담은 항목도 있고(Popover `borderWidth:"1px"` · Disclosure `width:"100%"`),
 * 그건 인라인 대응물이 없는 것이 정상이다.
 */

const LAYOUT_MIRROR_KEYS = [
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "alignContent",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

const ctx: ComponentCreationContext = {
  parentElement: null,
  pageId: "page-1",
  elements: [],
  layoutId: null,
  doc: { pages: [], nodes: {} } as unknown as CompositionDocument,
};

/**
 * ADR-171 Phase 4 가 인라인을 만진 6종. 각 종이 왜 대상인지는 design breakdown §Phase 4 참조
 * (요약: 두 소비자가 모두 같은 값을 자기 채널로 갖는 키만 제거했다).
 */
const CASES: Array<{
  type: string;
  create: (c: ComponentCreationContext) => ComponentDefinition;
}> = [
  { type: "Popover", create: createPopoverDefinition },
  { type: "Tooltip", create: createTooltipDefinition },
  { type: "Dialog", create: createDialogDefinition },
  { type: "Disclosure", create: createDisclosureDefinition },
  { type: "DisclosureGroup", create: createDisclosureGroupDefinition },
  { type: "Pagination", create: createPaginationDefinition },
];

/**
 * ADR-171 Phase 6 — reusable composite origin 축.
 *
 * Card/Form 은 factory definition 이 아니라 **origin 템플릿**(ADR-148 Phase 3 / ADR-912 R-5)이
 * 인라인의 거처다. 미러(`createDefault{Card,Form}Props`)와의 쌍방 계약은 factory 축과 동일하고,
 * 실제로 `createDefaultFormProps` 주석이 "origin 의 루트 style 미러" 라고 스스로 밝히고 있다.
 * 채널만 다르므로 origin 루트를 읽어 같은 두 방향을 단언한다.
 */
const ORIGIN_CASES: Array<{
  type: string;
  originId: string;
  ensure: (doc: CompositionDocument) => CompositionDocument;
}> = [
  {
    type: "Card",
    originId: CARD_ORIGIN_ID,
    ensure: ensureCardTemplateOrigins,
  },
  {
    type: "Form",
    originId: FORM_ORIGIN_ID,
    ensure: ensureFormTemplateOrigins,
  },
];

function emptyDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" }],
      },
    ],
  } as unknown as CompositionDocument;
}

function findOriginRoot(
  nodes: readonly { id: string; children?: readonly unknown[] }[],
  id: string,
): { props?: Record<string, unknown> } | undefined {
  for (const node of nodes) {
    if (node.id === id) return node as { props?: Record<string, unknown> };
    const child = findOriginRoot(
      (node.children ?? []) as { id: string; children?: readonly unknown[] }[],
      id,
    );
    if (child) return child;
  }
  return undefined;
}

describe("ADR-171 Phase 4 (R7) — factory 인라인 ↔ dirty baseline", () => {
  for (const { type, create } of CASES) {
    it(`${type} — 갓 만든 요소의 dirty style 이 0 (① 인라인 ⊆ baseline)`, () => {
      const def = create(ctx);
      expect(
        computeDirtyStyleProps({
          type: def.parent.type,
          props: def.parent.props as Record<string, unknown>,
        }),
      ).toEqual([]);
    });

    it(`${type} — baseline 이 factory 미주입 layout 키를 주장하지 않음 (② baseline ⊆ 인라인)`, () => {
      const def = create(ctx);
      const inline = (def.parent.props?.style ?? {}) as Record<string, unknown>;
      const mirror = (getDefaultProps(type)?.style ?? {}) as Record<
        string,
        unknown
      >;
      const stale = LAYOUT_MIRROR_KEYS.filter(
        (k) => mirror[k] !== undefined && inline[k] === undefined,
      );
      expect(stale).toEqual([]);
    });
  }
});

describe("ADR-171 Phase 6 — origin 템플릿 인라인 ↔ dirty baseline", () => {
  for (const { type, originId, ensure } of ORIGIN_CASES) {
    it(`${type} — origin 인스턴스의 dirty style 이 0 (① 인라인 ⊆ baseline)`, () => {
      const doc = ensure(emptyDocument());
      const origin = findOriginRoot(
        doc.children as unknown as {
          id: string;
          children?: readonly unknown[];
        }[],
        originId,
      );
      expect(origin).toBeDefined();
      expect(
        computeDirtyStyleProps({
          type,
          props: (origin?.props ?? {}) as Record<string, unknown>,
        }),
      ).toEqual([]);
    });

    it(`${type} — baseline 이 origin 미주입 layout 키를 주장하지 않음 (② baseline ⊆ 인라인)`, () => {
      const doc = ensure(emptyDocument());
      const origin = findOriginRoot(
        doc.children as unknown as {
          id: string;
          children?: readonly unknown[];
        }[],
        originId,
      );
      const inline = (origin?.props?.style ?? {}) as Record<string, unknown>;
      const mirror = (getDefaultProps(type)?.style ?? {}) as Record<
        string,
        unknown
      >;
      const stale = LAYOUT_MIRROR_KEYS.filter(
        (k) => mirror[k] !== undefined && inline[k] === undefined,
      );
      expect(stale).toEqual([]);
    });
  }
});
