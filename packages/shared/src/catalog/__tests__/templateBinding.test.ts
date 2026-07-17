/**
 * ADR-148 Phase 2 — 템플릿 바인딩 치환 엔진 계약 (R2 대응).
 *
 * 핵심 계약:
 * - propsSchema 방어적 판독 (shape 어긋나면 null → gate off)
 * - 바인딩 값은 schema 키 한정 (root props 무관 키가 placeholder 오염 금지)
 * - full-match `"{key}"` 는 값 원형 유지 / partial 은 문자열 보간
 * - 미보유 키 placeholder 원형 보존 (ListBox row-data 바인딩 공존)
 */
import { describe, expect, it } from "vitest";

import {
  extractTemplateBindingKeys,
  readPropsSchema,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInProps,
} from "../templateBinding";
import type { PropsSchema } from "../types";

const SCHEMA: PropsSchema = {
  label: { kind: "string", label: "Label", default: "Button" },
  icon: { kind: "icon", label: "Icon", default: "star" },
  variant: { kind: "variant", label: "Variant", default: "primary" },
};

describe("readPropsSchema", () => {
  it("metadata.propsSchema 를 판독한다", () => {
    const node = { metadata: { propsSchema: SCHEMA } };
    expect(readPropsSchema(node)).toEqual(SCHEMA);
  });

  it("metadata 부재 / schema 아님 / contract kind 누락이면 null", () => {
    expect(readPropsSchema(undefined)).toBeNull();
    expect(readPropsSchema({ metadata: {} })).toBeNull();
    expect(readPropsSchema({ metadata: { propsSchema: "x" } })).toBeNull();
    expect(
      readPropsSchema({ metadata: { propsSchema: { label: {} } } }),
    ).toBeNull();
  });
});

describe("resolveTemplateBindingValues", () => {
  it("root props 우선, 없으면 contract.default", () => {
    expect(resolveTemplateBindingValues(SCHEMA, { label: "Save" })).toEqual({
      label: "Save",
      icon: "star",
      variant: "primary",
    });
  });

  it("schema 밖 root props 키는 바인딩에 포함하지 않는다", () => {
    const bindings = resolveTemplateBindingValues(SCHEMA, {
      description: "row-data 키",
    });
    expect(bindings).not.toHaveProperty("description");
  });

  it("root props 도 default 도 없는 키는 누락된다 (placeholder 보존 신호)", () => {
    const schema: PropsSchema = {
      label: { kind: "string", label: "Label" },
    };
    expect(resolveTemplateBindingValues(schema, {})).toEqual({});
  });
});

describe("extractTemplateBindingKeys", () => {
  it("props string 값 + children 재귀에서 placeholder 키를 수집한다", () => {
    const origin = {
      props: { variant: "primary" },
      children: [
        { props: { iconName: "{icon}" } },
        { props: { children: "{label}" }, children: [] },
      ],
    };
    expect(extractTemplateBindingKeys(origin)).toEqual(
      new Set(["icon", "label"]),
    );
  });

  it("placeholder 없는 노드는 빈 Set", () => {
    expect(extractTemplateBindingKeys({ props: { children: "text" } })).toEqual(
      new Set(),
    );
  });
});

describe("substituteTemplateBindingsInProps", () => {
  it("full-match placeholder 는 바인딩 값 원형 유지 (타입 보존)", () => {
    const out = substituteTemplateBindingsInProps(
      { children: "{label}", disabled: "{flag}" },
      { label: "Save", flag: true },
    );
    expect(out).toEqual({ children: "Save", disabled: true });
  });

  it("partial placeholder 는 문자열 보간", () => {
    const out = substituteTemplateBindingsInProps(
      { children: "{label} 버튼" },
      { label: "Save" },
    );
    expect(out).toEqual({ children: "Save 버튼" });
  });

  it("미보유 키 placeholder 는 원형 보존 (row-data 바인딩 공존)", () => {
    const props = { children: "{label}", description: "{description}" };
    const out = substituteTemplateBindingsInProps(props, { label: "Save" });
    expect(out).toEqual({ children: "Save", description: "{description}" });
  });

  it("변경이 없으면 동일 참조 반환 (memo 안정성)", () => {
    const props = { children: "plain", style: { width: 10 } };
    expect(substituteTemplateBindingsInProps(props, { label: "x" })).toBe(
      props,
    );
  });
});
