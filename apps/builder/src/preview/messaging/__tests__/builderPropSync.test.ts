import { describe, expect, it } from "vitest";

import {
  BUILDER_SYNCED_PREVIEW_PROPS,
  pickBuilderSyncedProps,
} from "../builderPropSync";

/**
 * Preview → builder store 역전파 allowlist 회귀 게이트 (2026-07-14).
 *
 * 버그: Preview 의 updateElementProps 는 Preview runtime store 전용이라 builder store
 *   (= Skia 렌더 source) 로 올라가지 않았다 → Preview 에서 Disclosure header 를 클릭해 접어도
 *   Skia 는 펼친 채 남아 CSS↔Skia 발산.
 *
 * 수정: 문서 prop 을 ELEMENT_PROPS_CHANGED 메시지로 builder 에 역전파. 단 **allowlist** 로
 *   좁힌다 — 순수 런타임 상태(hover/focus 등)까지 올려보내면 무의미한 문서 편집 + undo 히스토리
 *   + DB write 가 쌓인다.
 */

describe("BUILDER_SYNCED_PREVIEW_PROPS", () => {
  it("isExpanded 포함 (Disclosure 확장 — Skia 가 소비하는 문서 prop)", () => {
    expect(BUILDER_SYNCED_PREVIEW_PROPS.has("isExpanded")).toBe(true);
  });

  it("순수 런타임/시각 상태는 미포함 (문서 편집 오염 차단)", () => {
    for (const key of ["isHovered", "isFocused", "isPressed", "style"]) {
      expect(BUILDER_SYNCED_PREVIEW_PROPS.has(key)).toBe(false);
    }
  });
});

describe("pickBuilderSyncedProps", () => {
  it("allowlist prop 만 추린다", () => {
    expect(
      pickBuilderSyncedProps({ isExpanded: false, isHovered: true }),
    ).toEqual({ isExpanded: false });
  });

  it("false 값도 보존 (접힘을 역전파해야 Skia 가 숨긴다)", () => {
    expect(pickBuilderSyncedProps({ isExpanded: false })).toEqual({
      isExpanded: false,
    });
  });

  it("allowlist 밖 prop 만 있으면 null (메시지 미발송)", () => {
    expect(pickBuilderSyncedProps({ isHovered: true })).toBeNull();
  });

  it("빈 patch / nullish 는 null", () => {
    expect(pickBuilderSyncedProps({})).toBeNull();
    expect(pickBuilderSyncedProps(null)).toBeNull();
    expect(pickBuilderSyncedProps(undefined)).toBeNull();
  });
});
