import { describe, expect, it } from "vitest";

import {
  FIELD_ERROR_CHILD_SELECTOR,
  hasDelegatedChild,
  isDelegatedSubpartChild,
  resolveDelegatedSubpartOwnerType,
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
      // patch 는 **바꾸는 키만** (round 3 fe2m1 — 현재 style 을 복사해 오면 sanitizePropsPatch 가
      //   fill 파생 키를 지운다). 보존 책임은 소비처: store 는 mergeStyle, factory 는 깊은 병합.
      expect(updates[0].props.style, `${type} style patch`).toEqual({
        display: "block",
      });
      expect(updates[0].mergeStyle, `${type} mergeStyle`).toBe(true);

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

  it("Skia — FieldError text 는 delegation 글자 크기와 root 상속 줄 높이를 쓴다 (옛 문서의 인라인 fontSize·lineHeight 를 delegation 이 이긴다 — DOM 에 인라인 채널 없음)", () => {
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

      // 인라인 lineHeight (Typography 패널로 실제 작성 가능) 도 같은 소유권 — DOM 은 root 1.5 를
      //   상속하고 자식의 인라인 줄 높이를 읽을 채널이 없다 (round 3 fe2h1).
      const inlineLh = makeFe({
        display: "block",
        fontSize: 12,
        lineHeight: 10,
      });
      const inlineLhText = textOf(
        buildSpecNodeData({
          element: inlineLh,
          layout,
          theme: "light",
          elementsMap: new Map([
            [parent.id, parent],
            [inlineLh.id, inlineLh],
          ]),
        }),
      );
      expect(inlineLhText?.lineHeight, `${type} inline lineHeight 무시`).toBe(
        resolveInheritedLineHeight(expected),
      );
    }
  });

  it("read-only sub-part (잔여 1, 판정 A) — delegation 이 잡히는 parent 아래 FieldError 는 인라인 color·margin·padding·width 를 Skia 가 통째로 무시한다 (투영 display 만 남는다)", () => {
    const layout = { x: 0, y: 0, width: 200, height: 21 } as ComputedLayout;
    for (const { type } of FIELD_DEFS) {
      expect(hasDelegatedChild(type, FIELD_ERROR_CHILD_SELECTOR), type).toBe(
        true,
      );
      const parent = {
        id: `${type}-rp`,
        type,
        parent_id: null,
        props: { label: "Name", isInvalid: true, errorMessage: "required" },
      } as unknown as CanvasSceneNode;
      const makeFe = (style: Record<string, unknown>) =>
        ({
          id: `${type}-rfe`,
          type: "FieldError",
          parent_id: parent.id,
          props: { children: "required", style },
        }) as unknown as CanvasSceneNode;
      const build = (fe: CanvasSceneNode) =>
        buildSpecNodeData({
          element: fe,
          layout,
          theme: "light",
          elementsMap: new Map([
            [parent.id, parent],
            [fe.id, fe],
          ]),
        });
      const clean = build(makeFe({ display: "block" }));
      const junk = build(
        makeFe({
          display: "block",
          color: "rgb(1, 2, 3)",
          marginTop: 30,
          padding: 9,
          width: 50,
          fontSize: 12,
          lineHeight: 10,
        }),
      );
      expect(JSON.stringify(junk), `${type} 인라인 무시`).toBe(
        JSON.stringify(clean),
      );
    }
    // delegation 이 없는 parent 아래에서는 sub-part 가 아니다 — 술어 false, 인라인은 그대로 (범위 밖)
    expect(hasDelegatedChild("Button", FIELD_ERROR_CHILD_SELECTOR)).toBe(false);
    expect(hasDelegatedChild("Form", FIELD_ERROR_CHILD_SELECTOR)).toBe(false);
  });

  it("read-only sub-part 확장 (판정 A × 2) — Label · Input · DateInput 도 delegation parent 아래에서는 인라인을 Skia 가 통째로 무시한다", () => {
    const layout = { x: 0, y: 0, width: 200, height: 30 } as ComputedLayout;
    const cases: Array<[string, string]> = [
      ["Label", "TextField"],
      ["Label", "TextArea"],
      ["Label", "NumberField"],
      ["Label", "DateField"],
      ["Label", "TimeField"],
      ["Input", "TextField"],
      ["Input", "TextArea"],
      ["DateInput", "DateField"],
      ["DateInput", "TimeField"],
    ];
    for (const [childType, parentType] of cases) {
      expect(
        isDelegatedSubpartChild(childType, parentType),
        `${childType} < ${parentType}`,
      ).toBe(true);
      const parent = {
        id: `${parentType}-sp2`,
        type: parentType,
        parent_id: null,
        props: { label: "Name", size: "md" },
      } as unknown as CanvasSceneNode;
      const make = (style: Record<string, unknown>) =>
        ({
          id: `${parentType}-${childType}-sp2`,
          type: childType,
          parent_id: parent.id,
          props: {
            ...(childType === "Label" ? { children: "Name" } : {}),
            style,
          },
        }) as unknown as CanvasSceneNode;
      const build = (el: CanvasSceneNode) =>
        buildSpecNodeData({
          element: el,
          layout,
          theme: "light",
          elementsMap: new Map([
            [parent.id, parent],
            [el.id, el],
          ]),
        });
      const clean = build(make({}));
      const junk = build(
        make({
          color: "rgb(1, 2, 3)",
          fontSize: 30,
          fontWeight: 900,
          marginTop: 30,
          padding: 9,
          width: 50,
          lineHeight: 10,
        }),
      );
      expect(
        JSON.stringify(junk),
        `${childType} < ${parentType} 인라인 무시`,
      ).toBe(JSON.stringify(clean));
    }
    // 범위 밖: delegation 없는 parent · 래퍼 안의 SelectValue (placeholder 텍스트 축을 DOM 이 읽는다)
    expect(isDelegatedSubpartChild("Label", "Button")).toBe(false);
    expect(
      isDelegatedSubpartChild("SelectValue", "SelectTrigger", "Select"),
    ).toBe(false);
    expect(isDelegatedSubpartChild("SelectTrigger", "Button")).toBe(false);
  });

  it("read-only sub-part 확장 (판정 A × 2, 2026-09-03 후반) — SelectTrigger 래퍼 · 그룹 Label · 래퍼 아래 DateInput 도 Skia 가 인라인을 통째로 무시하고 owner 는 field 다", () => {
    const layout = { x: 0, y: 0, width: 200, height: 30 } as ComputedLayout;
    // [child, parent, grandparent?, 기대 owner]
    const cases: Array<[string, string, string | undefined, string]> = [
      ["SelectTrigger", "NumberField", undefined, "NumberField"],
      ["SelectTrigger", "Select", undefined, "Select"],
      ["SelectTrigger", "ComboBox", undefined, "ComboBox"],
      ["SelectTrigger", "SearchField", undefined, "SearchField"],
      ["SelectTrigger", "DatePicker", undefined, "DatePicker"],
      ["SelectTrigger", "DateRangePicker", undefined, "DateRangePicker"],
      ["Label", "CheckboxGroup", undefined, "CheckboxGroup"],
      ["Label", "RadioGroup", undefined, "RadioGroup"],
      ["Label", "Meter", undefined, "Meter"],
      ["Label", "ProgressBar", undefined, "ProgressBar"],
      ["Label", "Slider", undefined, "Slider"],
      ["DateInput", "SelectTrigger", "DatePicker", "DatePicker"],
      ["DateInput", "SelectTrigger", "DateRangePicker", "DateRangePicker"],
    ];
    for (const [childType, parentType, grandType, owner] of cases) {
      expect(
        resolveDelegatedSubpartOwnerType(childType, parentType, grandType),
        `${childType} < ${parentType}${grandType ? ` < ${grandType}` : ""}`,
      ).toBe(owner);
      const grand = grandType
        ? ({
            id: `${grandType}-sp3`,
            type: grandType,
            parent_id: null,
            props: { label: "Name", size: "md" },
          } as unknown as CanvasSceneNode)
        : undefined;
      const parent = {
        id: `${parentType}-sp3`,
        type: parentType,
        parent_id: grand?.id ?? null,
        props: grand ? {} : { label: "Name", size: "md" },
      } as unknown as CanvasSceneNode;
      const make = (style: Record<string, unknown>) =>
        ({
          id: `${parentType}-${childType}-sp3`,
          type: childType,
          parent_id: parent.id,
          props: {
            ...(childType === "Label" ? { children: "Name" } : {}),
            style,
          },
        }) as unknown as CanvasSceneNode;
      const build = (el: CanvasSceneNode) =>
        buildSpecNodeData({
          element: el,
          layout,
          theme: "light",
          elementsMap: new Map(
            [grand, parent, el]
              .filter((n): n is CanvasSceneNode => !!n)
              .map((n) => [n.id, n] as const),
          ),
        });
      const clean = build(make({}));
      const junk = build(
        make({
          color: "rgb(1, 2, 3)",
          fontSize: 30,
          fontWeight: 900,
          marginTop: 30,
          padding: 9,
          width: 50,
          lineHeight: 10,
          backgroundColor: "rgb(4, 5, 6)",
          borderRadius: 40,
        }),
      );
      expect(
        JSON.stringify(junk),
        `${childType} < ${parentType} 인라인 무시`,
      ).toBe(JSON.stringify(clean));
    }
    // 조부모 hop 은 SelectTrigger 래퍼에서만 — 다른 중간 노드는 판정하지 않는다
    expect(
      resolveDelegatedSubpartOwnerType("DateInput", "frame", "DatePicker"),
    ).toBeNull();
    expect(
      resolveDelegatedSubpartOwnerType("Label", "SelectTrigger", "Select"),
    ).toBeNull();
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
        {
          elementId: fe.id,
          props: { style: { display: "block" } },
          mergeStyle: true,
        },
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
