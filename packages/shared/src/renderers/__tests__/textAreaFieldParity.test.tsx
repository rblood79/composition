/**
 * design-data 감사 §1-3 (2026-08-22) — TextArea ↔ TextField 형제 비대칭.
 *
 * **결손의 형태가 특이하다**: `renderTextArea` 는 `errorMessage` / `necessityIndicator` 를
 * 처음부터 shared `TextArea` 로 넘기고 있었고 컴포넌트도 그것을 FieldError /
 * `renderNecessityIndicator` 로 소비했다 — **binding accepts 에만 없어서** 패널에서 값을
 * 넣을 방법이 없었다. 소비는 살아 있는데 편집 표면이 끊긴, §1-1 "표면 단절" 과 같은 축.
 * 입력 힌트 5종은 반대로 accepts·renderer 양쪽이 없었다 (ADR-915 P1.5-b 가
 * TextField/SearchField 만 채택).
 *
 * 그래서 이 테스트는 **선언과 소비를 같이** 잠근다 — accepts 만 보면 "패널에 뜨지만 아무
 * 일도 안 일어나는" dead prop 을 통과시키고, renderer 만 보면 편집 표면 회귀를 놓친다.
 *
 * `value` 는 여기 없다. 표시 채널(캔버스 Input 텍스트)이 따로 필요해 별도 단계 소관이다.
 */

import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

import { getPrimitiveBinding } from "../../catalog/bindings";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderTextArea, renderTextField } from "../FormRenderers";

/** ADR-915 P1.5-b 입력 힌트 — `<textarea>` 로 그대로 전달되는 HTML attr. */
const INPUT_HINTS = [
  "autoComplete",
  "autoCorrect",
  "inputMode",
  "enterKeyHint",
  "spellCheck",
] as const;

/** TextField 가 가졌고 TextArea 에는 없던 것 (감사 §1-3 / §2-B). */
const PARITY_KEYS = [
  "errorMessage",
  "necessityIndicator",
  ...INPUT_HINTS,
] as const;

const acceptsOf = (type: string) =>
  getPrimitiveBinding(type)?.props?.accepts ?? {};

function makeContext(element: PreviewElement): RenderContext {
  return {
    elements: [element],
    elementsById: new Map([[element.id, element]]),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

function rootProps(node: unknown): Record<string, unknown> {
  expect(isValidElement(node)).toBe(true);
  return (node as { props: Record<string, unknown> }).props;
}

const HINT_PROPS = {
  autoComplete: "off",
  autoCorrect: "off",
  inputMode: "text",
  enterKeyHint: "send",
  spellCheck: "false",
} as const;

describe("TextArea ↔ TextField 편집 표면 parity (감사 §1-3)", () => {
  it("TextField 에만 있던 7 키가 TextArea accepts 에도 선언된다", () => {
    const textArea = acceptsOf("TextArea");
    const textField = acceptsOf("TextField");

    for (const key of PARITY_KEYS) {
      // 선례가 살아 있어야 parity 주장 자체가 성립한다.
      expect(textField[key], `TextField accepts.${key} (선례)`).toBeDefined();
      expect(textArea[key], `TextArea accepts.${key}`).toBeDefined();
    }
  });

  it("enum 키는 TextField 와 같은 옵션 집합을 쓴다 (어휘 분기 방지)", () => {
    const textArea = acceptsOf("TextArea");
    const textField = acceptsOf("TextField");

    for (const key of ["necessityIndicator", ...INPUT_HINTS] as const) {
      const ta = textArea[key] as { kind?: string; options?: unknown[] };
      const tf = textField[key] as { kind?: string; options?: unknown[] };
      expect(ta.kind, `${key} kind`).toBe(tf.kind);
      expect(ta.options, `${key} options`).toEqual(tf.options);
    }
  });

  it("renderTextArea 가 입력 힌트 5종을 실제로 전달한다", () => {
    const el: PreviewElement = {
      id: "ta-1",
      type: "TextArea",
      props: { ...HINT_PROPS },
    };
    const props = rootProps(renderTextArea(el, makeContext(el)));

    for (const key of INPUT_HINTS) {
      expect(props[key], `renderTextArea ${key}`).toBe(HINT_PROPS[key]);
    }
  });

  it("입력 힌트 미지정 시에는 attr 을 만들지 않는다 (undefined 통과)", () => {
    const el: PreviewElement = { id: "ta-2", type: "TextArea", props: {} };
    const props = rootProps(renderTextArea(el, makeContext(el)));

    for (const key of INPUT_HINTS) {
      expect(props[key], `renderTextArea ${key} (미지정)`).toBeUndefined();
    }
  });

  it("errorMessage / necessityIndicator 는 선언 전부터 소비되고 있었다", () => {
    const el: PreviewElement = {
      id: "ta-3",
      type: "TextArea",
      props: {
        label: "메모",
        errorMessage: "필수 항목입니다",
        necessityIndicator: "label",
        isRequired: true,
        isInvalid: true,
      },
    };
    const props = rootProps(renderTextArea(el, makeContext(el)));

    expect(props.errorMessage).toBe("필수 항목입니다");
    expect(props.necessityIndicator).toBe("label");
  });

  it("TextField 는 같은 값을 같은 자리로 넘긴다 (형제 대칭 확인)", () => {
    const props = {
      ...HINT_PROPS,
      errorMessage: "필수 항목입니다",
      necessityIndicator: "label",
    };
    const tf: PreviewElement = { id: "tf-1", type: "TextField", props };
    const ta: PreviewElement = { id: "ta-4", type: "TextArea", props };

    const tfProps = rootProps(renderTextField(tf, makeContext(tf)));
    const taProps = rootProps(renderTextArea(ta, makeContext(ta)));

    for (const key of PARITY_KEYS) {
      expect(taProps[key], `${key} 형제 대칭`).toBe(tfProps[key]);
    }
  });
});
