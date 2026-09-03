import { describe, expect, it } from "vitest";

import {
  FIELD_ERROR_CHILD_SELECTOR,
  resolveDelegatedChildFontSize,
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
  buildPropagationUpdates,
  resolvePropagatedProps,
} from "./propagationEngine";
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
