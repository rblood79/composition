/**
 * ADR-059 v2 Pre-Phase 0-D: Delegation Prefix SSOT 검증
 *
 * 모든 Spec의 `composition.delegation[].prefix` 를 대상으로 build-time 계약을 검증한다.
 *
 * 규칙:
 *  R1. prefix 형식: 소문자 kebab-case (`^[a-z][a-z0-9-]*[a-z0-9]$`)
 *  R2. prefix 전역 유일성: (specName, childSelector) 튜플 기준 다른 위치에서 동일 prefix 재사용 금지
 *  R3. prefix 선언 시 `variables` 내 모든 CSS 변수 키가 `--{prefix}-*` 로 시작해야 함
 *
 * prefix 가 생략된 delegation (direct-property 방식) 은 검증 대상에서 제외.
 *
 * 실패 시 `ValidationError` 목록을 throw — 호출자가 `process.exit(1)` 로 빌드 차단.
 */

import type { ComponentSpec, DelegationSpec } from "../types/spec.types";

export interface PrefixViolation {
  rule: "R1" | "R2" | "R3";
  specName: string;
  childSelector: string;
  prefix?: string;
  detail: string;
}

const PREFIX_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/;

export function validateDelegationPrefixes(
  specs: ReadonlyArray<ComponentSpec<unknown>>,
): PrefixViolation[] {
  const violations: PrefixViolation[] = [];
  const prefixOwners = new Map<
    string,
    { specName: string; childSelector: string }
  >();

  for (const spec of specs) {
    const delegations: DelegationSpec[] | undefined =
      spec.composition?.delegation;
    if (!delegations) continue;

    for (const del of delegations) {
      const { prefix, childSelector, variables } = del;
      if (!prefix) continue;

      // R1: 형식
      if (!PREFIX_RE.test(prefix)) {
        violations.push({
          rule: "R1",
          specName: spec.name,
          childSelector,
          prefix,
          detail: `prefix "${prefix}" 형식 위반 — 소문자 kebab-case 필요 (예: "tf-input")`,
        });
        continue; // 형식 위반 시 후속 규칙 스킵
      }

      // R2: 전역 유일성
      const existing = prefixOwners.get(prefix);
      if (existing) {
        violations.push({
          rule: "R2",
          specName: spec.name,
          childSelector,
          prefix,
          detail: `prefix "${prefix}" 중복 선언 — 이미 ${existing.specName}:${existing.childSelector} 에서 사용 중`,
        });
      } else {
        prefixOwners.set(prefix, {
          specName: spec.name,
          childSelector,
        });
      }

      // R3: 변수 키 네임스페이스
      // ADR-059 v2 0-C: "auto" 는 deriver 가 prefix 를 강제 주입하므로 검증 대상 제외
      const expectedPrefix = `--${prefix}-`;
      const badKeys: string[] = [];
      if (variables !== "auto") {
        for (const sizeBucket of Object.values(variables ?? {})) {
          for (const key of Object.keys(sizeBucket)) {
            if (!key.startsWith(expectedPrefix)) {
              badKeys.push(key);
            }
          }
        }
      }
      if (badKeys.length > 0) {
        const uniq = Array.from(new Set(badKeys)).slice(0, 5);
        violations.push({
          rule: "R3",
          specName: spec.name,
          childSelector,
          prefix,
          detail: `prefix "${prefix}" 네임스페이스(${expectedPrefix}*) 위반 키: ${uniq.join(", ")}${badKeys.length > uniq.length ? " …" : ""}`,
        });
      }
    }
  }

  return violations;
}

export function formatViolations(violations: PrefixViolation[]): string {
  if (violations.length === 0) return "";
  const lines = [
    `❌ Delegation prefix 위반 ${violations.length}건 (ADR-059 v2 0-D):`,
  ];
  for (const v of violations) {
    lines.push(
      `  [${v.rule}] ${v.specName} / ${v.childSelector}${v.prefix ? ` (prefix: ${v.prefix})` : ""}\n       ${v.detail}`,
    );
  }
  return lines.join("\n");
}
