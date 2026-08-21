import { describe, expect, it } from "vitest";

import { LAYOUT_AFFECTING_PROP_KEYS } from "../../../../stores/utils/layoutInvalidation";
import { createPageLayoutSignature } from "../layoutCache";
import type { CanvasLayoutNode } from "../../layout/layoutNode";

/**
 * Select/ComboBox 표시값의 무효화 체인 (2026-08-22).
 *
 * 표시 텍스트가 owner 의 selectedKey/selectedValue/inputValue 에서 파생되므로(자식
 * SelectValue 로 주입) 텍스트 폭이 바뀐다 = **레이아웃 prop** 이다. layout-engine.md 의
 * 2계층 계약대로 **둘 다** 필요하고, 하나만 등재하면 증상이 서로 다르다:
 *
 * - layer A(`LAYOUT_AFFECTING_PROP_KEYS`) 누락 → layoutVersion 이 안 올라 재계산 자체가 없음
 * - layer B(`LAYOUT_PROP_KEYS` 시그니처) 누락 → 재계산은 돌지만 시그니처 동일 → 캐시 히트로
 *   이전 표시가 남음 (새로고침 후에만 반영)
 *
 * layer B 는 배열을 직접 import 하지 않고 `createPageLayoutSignature` 결과가 실제로
 * 달라지는지로 본다 — 배열에 넣어도 시그니처가 그 키를 안 읽으면 의미가 없기 때문
 * (`LAYOUT_PROP_KEYS` 는 `props[key]` 만 읽는다 — style 키를 넣으면 항상 undefined).
 */

const DISPLAY_KEYS = ["selectedKey", "selectedValue", "inputValue"] as const;

function makeSelect(props: Record<string, unknown>): CanvasLayoutNode {
  return {
    id: "sel-1",
    type: "Select",
    props: { placeholder: "선택", ...props },
  } as unknown as CanvasLayoutNode;
}

const signatureOf = (props: Record<string, unknown>) =>
  createPageLayoutSignature(null, [makeSelect(props)]);

describe("Select 표시값 무효화 — 2계층 모두", () => {
  it("layer A: 세 키가 layoutVersion 을 올린다", () => {
    for (const key of DISPLAY_KEYS) {
      expect(LAYOUT_AFFECTING_PROP_KEYS.has(key)).toBe(true);
    }
  });

  it("layer B: 세 키가 페이지 레이아웃 시그니처를 바꾼다", () => {
    const base = signatureOf({});
    expect(signatureOf({ selectedKey: "opt-1" })).not.toBe(base);
    expect(signatureOf({ selectedValue: "us-west-2" })).not.toBe(base);
    expect(signatureOf({ inputValue: "직접 입력" })).not.toBe(base);
  });

  it("layer B: 선택이 바뀌면 시그니처도 바뀐다 (동일값은 그대로)", () => {
    const a = signatureOf({ selectedKey: "opt-1", selectedValue: "a" });
    const b = signatureOf({ selectedKey: "opt-2", selectedValue: "b" });
    expect(a).not.toBe(b);
    expect(signatureOf({ selectedKey: "opt-1", selectedValue: "a" })).toBe(a);
  });
});
