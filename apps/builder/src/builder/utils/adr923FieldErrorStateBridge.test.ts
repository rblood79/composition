import { describe, expect, it } from "vitest";

import {
  FIELD_ERROR_CHILD_SELECTOR,
  resolveDelegatedChildFontSize,
  resolveInheritedLineHeight,
} from "@composition/shared";

import {
  LAYOUT_AFFECTING_PROP_KEYS,
  LAYOUT_PROP_KEYS,
} from "../presentation/invalidation/editorMutationEffectRegistry";
import {
  createDateFieldDefinition,
  createTimeFieldDefinition,
} from "../factories/definitions/DateColorComponents";
import {
  createNumberFieldDefinition,
  createTextAreaDefinition,
  createTextFieldDefinition,
} from "../factories/definitions/FormComponents";
import type {
  ComponentCreationContext,
  ComponentDefinition,
} from "../factories/types";
import {
  applyFactoryPropagation,
  buildPropagationUpdates,
  resolvePropagatedProps,
} from "./propagationEngine";
import { buildSpecNodeData } from "../workspace/canvas/skia/buildSpecNodeData";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import { getPropagationRules } from "./propagationRegistry";

/**
 * ADR-923 Phase 5 후속 — FieldError 상태 투영의 **propagation 다리** (r16m1 label 축과 같은 registry 경로).
 *
 * DOM (`<FieldError>{errorMessage}</FieldError>`, RAC 는 `isInvalid` 일 때만 렌더) 과 같은 답을 Canvas 가
 * 내려면 parent top-level `isInvalid` / `errorMessage` 가 FieldError 자식의 `style.display` / `children`
 * 으로 흘러야 한다. 세 소비 경로 — Inspector 쓰기 (`buildPropagationUpdates`) · layout read-time fallback
 * (`resolvePropagatedProps`, `fullTreeLayout`) · Skia (`applyParentPropagationProps`) — 가 전부 이 registry
 * 를 읽으므로 규칙 하나가 세 표면을 덮는다.
 *
 * 5-심볼 무효화 체인 (layout-engine.md): parent 키 자체가 layoutVersion 트리거 (계층 A) 와 캐시 시그니처
 * (계층 B) 에 등재돼야 Inspector 가 아닌 writer 가 parent 만 바꿔도 재계산·캐시 무효화가 된다.
 */
const ctx = {
  parentElement: null,
  pageId: "page-test",
  elements: [],
  layoutId: null,
  doc: undefined,
} as unknown as ComponentCreationContext;

const FIELD_DEFS: Array<{ type: string; def: ComponentDefinition }> = [
  { type: "TextField", def: createTextFieldDefinition(ctx) },
  { type: "TextArea", def: createTextAreaDefinition(ctx) },
  { type: "NumberField", def: createNumberFieldDefinition(ctx) },
  { type: "DateField", def: createDateFieldDefinition(ctx) },
  { type: "TimeField", def: createTimeFieldDefinition(ctx) },
];

type PropagationNode = {
  id: string;
  type: string;
  parent_id?: string | null;
  props: Record<string, unknown>;
};

function fieldErrorProps(def: ComponentDefinition): Record<string, unknown> {
  const fe = def.children?.find((c) => c.type === "FieldError");
  if (!fe) throw new Error(`${def.type}: factory 에 FieldError 자식 없음`);
  return fe.props as Record<string, unknown>;
}

describe("ADR-923 Phase 5 후속 — FieldError 상태 투영 propagation 다리", () => {
  it("factory 전제 — 5 field 는 FieldError 자식을 children:'' + display:none 으로 만든다 (parent 상태가 덮어야 할 기본값)", () => {
    for (const { type, def } of FIELD_DEFS) {
      const props = fieldErrorProps(def);
      expect(props.children, `${type} children`).toBe("");
      expect(
        (props.style as Record<string, unknown>).display,
        `${type} display`,
      ).toBe("none");
    }
  });

  it("read-time — parent {isInvalid:true, errorMessage} → FieldError {children, style.display:block} (자식 style 의 다른 키는 보존 대상)", () => {
    for (const { type, def } of FIELD_DEFS) {
      const child = fieldErrorProps(def);
      const patch = resolvePropagatedProps(
        type,
        { isInvalid: true, errorMessage: "required" },
        "FieldError",
        child,
      );
      expect(patch, `${type} patch`).not.toBeNull();
      expect(patch!.children, `${type} children`).toBe("required");
      expect(
        (patch!.style as Record<string, unknown>).display,
        `${type} display`,
      ).toBe("block");
    }
  });

  it("read-time — isInvalid:false 는 display:none, isInvalid 키 부재는 display 를 건드리지 않는다 (factory none 유지) · errorMessage 부재는 children 을 건드리지 않는다", () => {
    for (const { type, def } of FIELD_DEFS) {
      const child = fieldErrorProps(def);
      const off = resolvePropagatedProps(
        type,
        { isInvalid: false, errorMessage: "required" },
        "FieldError",
        child,
      );
      expect(
        (off?.style as Record<string, unknown> | undefined)?.display,
        `${type} isInvalid:false display`,
      ).toBe("none");
      expect(off?.children, `${type} isInvalid:false children`).toBe(
        "required",
      );

      const absent = resolvePropagatedProps(
        type,
        { label: "Name" },
        "FieldError",
        child,
      );
      expect(
        (absent?.style as Record<string, unknown> | undefined)?.display,
        `${type} absent display`,
      ).toBeUndefined();
      expect(absent?.children, `${type} absent children`).toBeUndefined();
    }
  });

  it("factory 전제 — FieldError 자식에 인라인 fontSize 를 두지 않는다 (D3 = parent rule delegation)", () => {
    // r2 feh1: 인라인 12 는 TextField/TextArea 의 DOM 값 (delegation 14) 과 갈렸고, resolver 를
    //   우회해 catalog 를 무력화했다. 저작 시점에 크기를 박지 않는 것이 유일한 차단이다.
    for (const { type, def } of FIELD_DEFS) {
      const style = fieldErrorProps(def).style as Record<string, unknown>;
      expect(style.fontSize, `${type} 인라인 fontSize`).toBeUndefined();
    }
  });

  it("propagation 쓰기 — 자식의 기존 style 키를 보존한다 (부분 patch 가 style 전체를 갈아치우지 않는다)", () => {
    // r2 feh2: store 쓰기 (`batchUpdateElementProps`) 는 props 최상위 얕은 병합이라, patch.style 이
    //   부분 객체면 자식의 fontSize/color/width 가 통째로 사라졌다.
    for (const { type } of FIELD_DEFS) {
      const parent: PropagationNode = {
        id: `${type}-p2`,
        type,
        props: { label: "Name" },
      };
      const authored = {
        display: "none",
        fontSize: 13,
        color: "rgb(1, 2, 3)",
      };
      const fe: PropagationNode = {
        id: `${type}-fe2`,
        type: "FieldError",
        props: { children: "", style: { ...authored } },
      };
      const updates = buildPropagationUpdates(
        parent,
        { isInvalid: true },
        getPropagationRules(type)!,
        new Map([[parent.id, [fe]]]),
        new Map([
          [parent.id, parent],
          [fe.id, fe],
        ]),
      );
      expect(updates.length, `${type} updates`).toBe(1);
      expect(updates[0].props.style, `${type} style`).toEqual({
        ...authored,
        display: "block",
      });

      // factory 초기 전파도 같은 경로 (`applyFactoryPropagation` → buildPropagationUpdates)
      const factoryParent: PropagationNode = {
        ...parent,
        props: { ...parent.props, isInvalid: true },
      };
      const factoryChild: PropagationNode = { ...fe, parent_id: parent.id };
      const [patched] = applyFactoryPropagation(factoryParent, [factoryChild]);
      expect(patched.props.style, `${type} factory style`).toEqual({
        ...authored,
        display: "block",
      });
    }
  });

  it("Skia — FieldError text 는 delegation 글자 크기와 root 상속 줄 높이를 쓴다 (옛 문서의 인라인 fontSize 도 delegation 이 이긴다 — DOM 에 인라인 채널 없음)", () => {
    // r2 feh3 / fem1: catalog FieldError rule 의 lineHeight (md 16) 는 활성 CSS bundle 이 소비하지
    //   않는다 — DOM 은 `:root { line-height: 1.5 }` 를 상속한다 (browser gate 실측 14→21 · 12→18).
    const layout = { x: 0, y: 0, width: 200, height: 21 } as ComputedLayout;
    const textOf = (
      node: ReturnType<typeof buildSpecNodeData>,
    ): { fontSize: number; lineHeight?: number } | undefined => {
      const walk = (
        n: NonNullable<ReturnType<typeof buildSpecNodeData>> | undefined,
      ): { fontSize: number; lineHeight?: number } | undefined => {
        if (!n) return undefined;
        if (n.text?.content) return n.text;
        for (const c of n.children ?? []) {
          const found = walk(c);
          if (found) return found;
        }
        return undefined;
      };
      return walk(node ?? undefined);
    };

    for (const { type } of FIELD_DEFS) {
      const expected = resolveDelegatedChildFontSize(
        type,
        FIELD_ERROR_CHILD_SELECTOR,
      )!;
      const parent = {
        id: `${type}-sp`,
        type,
        parent_id: null,
        props: { label: "Name", isInvalid: true, errorMessage: "required" },
      } as unknown as CanvasSceneNode;
      const makeFe = (style: Record<string, unknown>) =>
        ({
          id: `${type}-sfe`,
          type: "FieldError",
          parent_id: parent.id,
          props: { children: "", style },
        }) as unknown as CanvasSceneNode;

      const delegated = makeFe({ display: "block" });
      const delegatedText = textOf(
        buildSpecNodeData({
          element: delegated,
          layout,
          theme: "light",
          elementsMap: new Map([
            [parent.id, parent],
            [delegated.id, delegated],
          ]),
        }),
      );
      expect(delegatedText?.fontSize, `${type} delegated fontSize`).toBe(
        expected,
      );
      expect(delegatedText?.lineHeight, `${type} delegated lineHeight`).toBe(
        resolveInheritedLineHeight(expected),
      );

      // 저장된 옛 문서의 인라인 크기 (factory 가 심던 12) — publish 는 RAC 자체 FieldError 를 그려
      //   자식의 인라인 style 을 읽을 채널이 없다 (live 실측: 인라인 12 를 줘도 DOM 은 14/21). 그래서
      //   delegation 이 인라인을 이겨야 옛 문서가 Canvas 18 · DOM 21 로 갈리지 않는다 (r2 feh1).
      const inline = makeFe({ display: "block", fontSize: 12 });
      const inlineText = textOf(
        buildSpecNodeData({
          element: inline,
          layout,
          theme: "light",
          elementsMap: new Map([
            [parent.id, parent],
            [inline.id, inline],
          ]),
        }),
      );
      expect(inlineText?.fontSize, `${type} inline fontSize`).toBe(expected);
      expect(inlineText?.lineHeight, `${type} inline lineHeight`).toBe(
        resolveInheritedLineHeight(expected),
      );
    }
  });

  it("Inspector 쓰기 — parent 변경 {isInvalid} / {errorMessage} 가 FieldError 자식 store 업데이트로 나온다", () => {
    for (const { type, def } of FIELD_DEFS) {
      const parent = { id: `${type}-p`, type, props: { label: "Name" } };
      const fe = {
        id: `${type}-fe`,
        type: "FieldError",
        props: fieldErrorProps(def),
      };
      const childrenMap = new Map([[parent.id, [fe]]]);
      const elementsMap = new Map([
        [parent.id, parent],
        [fe.id, fe],
      ]);
      const rules = getPropagationRules(type);
      expect(rules, `${type} rules`).toBeTruthy();

      const onInvalid = buildPropagationUpdates(
        parent,
        { isInvalid: true },
        rules!,
        childrenMap,
        elementsMap,
      );
      expect(onInvalid, `${type} isInvalid`).toEqual([
        { elementId: fe.id, props: { style: { display: "block" } } },
      ]);

      const onMessage = buildPropagationUpdates(
        parent,
        { errorMessage: "required" },
        rules!,
        childrenMap,
        elementsMap,
      );
      expect(onMessage, `${type} errorMessage`).toEqual([
        { elementId: fe.id, props: { children: "required" } },
      ]);
    }
  });

  it("글자 크기 — parent rule delegation (.react-aria-FieldError hint 변수) 이 정본: TextField/TextArea md 14 · NumberField/DateField/TimeField md 12 (DOM computed 와 같은 값)", () => {
    const expected: Record<string, number> = {
      TextField: 14,
      TextArea: 14,
      NumberField: 12,
      DateField: 12,
      TimeField: 12,
    };
    for (const { type } of FIELD_DEFS) {
      expect(
        resolveDelegatedChildFontSize(type, FIELD_ERROR_CHILD_SELECTOR, "md"),
        `${type} md`,
      ).toBe(expected[type]);
      expect(
        resolveDelegatedChildFontSize(type, FIELD_ERROR_CHILD_SELECTOR),
        `${type} size 부재 → defaultSize`,
      ).toBe(expected[type]);
    }
    // size 별로 갈린다 (TextField xs = text-2xs 10 · lg = text-base 16)
    expect(
      resolveDelegatedChildFontSize(
        "TextField",
        FIELD_ERROR_CHILD_SELECTOR,
        "xs",
      ),
    ).toBe(10);
    expect(
      resolveDelegatedChildFontSize(
        "TextField",
        FIELD_ERROR_CHILD_SELECTOR,
        "lg",
      ),
    ).toBe(16);
    // delegation 항목이 없는 parent 는 undefined (호출자가 자기 기본으로)
    expect(
      resolveDelegatedChildFontSize("Button", FIELD_ERROR_CHILD_SELECTOR, "md"),
    ).toBeUndefined();
  });

  it("5-심볼 체인 — isInvalid · errorMessage 가 layoutVersion 트리거 (A) 와 캐시 시그니처 props 축 (B) 양쪽에 등재", () => {
    for (const key of ["isInvalid", "errorMessage"]) {
      expect(LAYOUT_AFFECTING_PROP_KEYS.has(key), `A ${key}`).toBe(true);
      expect(LAYOUT_PROP_KEYS.includes(key), `B ${key}`).toBe(true);
    }
  });
});
