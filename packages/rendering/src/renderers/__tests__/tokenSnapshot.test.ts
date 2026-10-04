/**
 * ADR-081 Gate G1: primitives resolved-value snapshot.
 *
 * spacing / radius / typography primitives 의 token resolved 숫자값 전체를
 * snapshot 으로 고정하여 값 drift 를 build-time 에 감지.
 *
 * 기존 `CSSGenerator.snapshot.test.ts` 의 vitest snapshot 패턴 재사용.
 * 새 test runner 도입 없음. `.snap` 파일은 CI 에서 자동 업데이트 금지 — 사람이
 * 리뷰하고 커밋 (ADR-081 Hard Constraint 5).
 *
 * 소비자 경로 drift 는 `apps/builder/.../tokenConsumerDrift.test.ts` (G2) 에서
 * 본 snapshot 과 cross-reference 한다.
 *
 * scope: spacing/radius/typography (G1 통과 조건). colors/shadows 는 theme 분기
 * 및 용도 차이로 향후 확장 대상 (Addendum).
 */

import { describe, expect, it } from "vitest";
import { resolveToken } from "../utils/tokenResolver";
import { spacing } from "../../primitives/spacing";
import { radius } from "../../primitives/radius";
import { typography } from "../../primitives/typography";
import type { TokenRef } from "../../types/token.types";

describe("ADR-081 G1 — primitives resolved-value snapshot", () => {
  it("spacing tokens resolved values", () => {
    const resolved = Object.fromEntries(
      Object.keys(spacing).map((name) => [
        name,
        resolveToken(`{spacing.${name}}` as TokenRef),
      ]),
    );
    expect(resolved).toMatchSnapshot();
  });

  it("radius tokens resolved values", () => {
    const resolved = Object.fromEntries(
      Object.keys(radius).map((name) => [
        name,
        resolveToken(`{radius.${name}}` as TokenRef),
      ]),
    );
    expect(resolved).toMatchSnapshot();
  });

  it("typography tokens resolved values (fontSize + line-height)", () => {
    const resolved = Object.fromEntries(
      Object.keys(typography).map((name) => [
        name,
        resolveToken(`{typography.${name}}` as TokenRef),
      ]),
    );
    expect(resolved).toMatchSnapshot();
  });
});
