/**
 * @fileoverview ADR-110 Phase 1+2 — Variables Snapshot/Resolve Adapter
 *
 * ADR-022 TokenRef/CSS 변수 체계 ↔ canonical document `variables` 필드 양방향 변환.
 *
 * - **Phase 1 (read-only)**: `snapshotVariablesFromTokens()` + `readCanonicalVariables()`
 *   — `tokenResolver.ts` 가 여전히 런타임 SSOT, document 직렬화만 수행
 * - **Phase 2 ts-3.2 (resolver)**: `resolveCanonicalVariable(ref, doc)` —
 *   doc.variables 에서 ref 를 lookup 하여 resolved 값 반환. 같은 theme 의
 *   resolve 결과로 빌드된 doc 이라면 `tokenResolver.ts::resolveToken(ref, theme)`
 *   과 **동일 값** 반환 (Gate G-B 조건).
 *
 * **Read-only 원칙 (Phase 1)**:
 * - canonical document → tokenResolver 쓰기 금지
 * - 런타임 변수 resolve 는 여전히 `tokenResolver.ts` 가 SSOT
 * - `snapshotVariablesFromTokens()` 는 call-time 직렬화 — subscribe 기반 아님
 *   (ADR-110 R4 대응: stale snapshot 방지)
 *
 * **Resolver contract (Phase 2)**:
 * - `resolveCanonicalVariable("{category.name}", doc)` → `doc.variables[key].value`
 * - theme 정보는 doc 에 내장 (snapshot 시점 결정) — caller 가 별도 주입 불필요
 * - doc.variables 미존재 시 undefined 반환 (BC)
 *
 * **VariablesSnapshot 설계 (ADR-110 R3)**:
 * - `source: "spec-token" | "user-defined"` 구분자로 출처 명시
 * - user-defined variable authoring UI 는 후속 Phase 로 이관
 */

import type {
  CompositionDocument,
  VariablesSnapshot,
  VariablesSnapshotEntry,
} from "@composition/shared";

// Re-export for convenience (adapter 소비자가 별도 import 불필요)
export type {
  VariablesSnapshot,
  VariablesSnapshotEntry,
} from "@composition/shared";

// ─────────────────────────────────────────────
// ResolvedTokenMap — adapter DI 계약
// ─────────────────────────────────────────────

/**
 * adapter 가 필요로 하는 resolved token 최소 인터페이스.
 *
 * `tokenResolver.ts` 의 resolve 결과를 평탄화한 map.
 * 키: token 이름 (예: "color.accent", "color.base" 등)
 * 값: resolved 결과 (string = 색상값, number = 수치)
 *
 * 실제 `tokenResolver.ts` 의 resolve 파이프라인은 변경하지 않는다 (ADR-021/022 비파괴).
 */
export type ResolvedTokenMap = Record<string, string | number | boolean>;

// ─────────────────────────────────────────────
// Core adapter functions
// ─────────────────────────────────────────────

/**
 * Spec TokenRef resolve 결과 → `VariablesSnapshot` 직렬화.
 *
 * call-time 직렬화 (subscribe 기반 아님) — stale snapshot 방지 (ADR-110 R4).
 * `legacyToCanonical()` 호출 시 전달된 `getVariables()` 콜백에서 호출됨.
 *
 * @param resolvedTokens - tokenResolver.ts 의 resolve 결과 평탄화 map
 * @returns VariablesSnapshot — canonical document variables 필드에 주입할 snapshot
 */
export function snapshotVariablesFromTokens(
  resolvedTokens: ResolvedTokenMap,
): VariablesSnapshot {
  const snapshot: VariablesSnapshot = {};

  for (const [key, value] of Object.entries(resolvedTokens)) {
    let type: VariablesSnapshotEntry["type"];

    if (typeof value === "string") {
      type = "color"; // Spec TokenRef resolve 결과는 기본적으로 색상값
    } else if (typeof value === "number") {
      type = "number";
    } else if (typeof value === "boolean") {
      type = "boolean";
    } else {
      // 예외 케이스: 직렬화 불가 값은 스킵
      continue;
    }

    snapshot[key] = {
      type,
      value,
      source: "spec-token", // ADR-110 R3: Spec TokenRef 출처 명시
    };
  }

  return snapshot;
}

/**
 * 사용자 정의 변수 map → `VariablesSnapshot` 직렬화.
 *
 * Phase 1: user-defined variable authoring UI 미구현. 향후 사용 예약.
 * 이미 `VariableDefinition` 형태로 저장된 사용자 변수를 `VariablesSnapshot` 으로 변환.
 *
 * @param userVars - 사용자 정의 변수 map (`VariableDefinition` 구조와 동일)
 * @returns VariablesSnapshot (source: "user-defined" 로 마킹)
 */
export function snapshotUserDefinedVariables(
  userVars: Record<
    string,
    {
      type: "color" | "number" | "string" | "boolean";
      value: string | number | boolean;
    }
  >,
): VariablesSnapshot {
  const snapshot: VariablesSnapshot = {};

  for (const [key, def] of Object.entries(userVars)) {
    snapshot[key] = {
      type: def.type,
      value: def.value,
      source: "user-defined", // ADR-110 R3: 사용자 정의 변수 출처 명시
    };
  }

  return snapshot;
}

/**
 * canonical document 에서 `variables` 필드를 `VariablesSnapshot` 으로 읽기.
 *
 * Phase 2 write-through 이전: read-only accessor.
 * `variables` 필드가 없으면 `undefined` 반환.
 *
 * Phase 2 에서는 `resolveCanonicalVariable(ref, document)` 함수가 추가되어
 * `tokenResolver.ts` 결과와 동일 값 반환 검증이 가능해진다 (Gate G-B 조건).
 *
 * @param doc - canonical CompositionDocument
 * @returns VariablesSnapshot 또는 undefined (variables 필드 없음)
 */
export function readCanonicalVariables(
  doc: CompositionDocument,
): VariablesSnapshot | undefined {
  return doc.variables ?? undefined;
}

// ─────────────────────────────────────────────
// Phase 2 ts-3.2 — Resolver
// ─────────────────────────────────────────────

/**
 * Spec TokenRef pattern: `{category.name}` (예: `{color.accent}`).
 *
 * `tokenResolver.ts::resolveToken` 의 정규식과 동일 — name 부분에 `.` 포함 가능
 * (예: `{color.accent-hover}`, `{color.layer-1}`).
 */
const TOKEN_REF_PATTERN = /^\{(\w+)\.(.+)\}$/;

/**
 * canonical document `variables` 에서 TokenRef 의 resolved 값을 lookup (Phase 2 ts-3.2).
 *
 * **Contract (Gate G-B)**: 같은 theme 의 resolve 결과로 빌드된 doc 이라면,
 * `resolveCanonicalVariable(ref, doc)` 와 `tokenResolver.ts::resolveToken(ref, theme)`
 * 은 **동일 값** 반환.
 *
 * **doc.variables 키 형식**: `${category}.${name}` (snapshotVariablesFromTokens 가
 * input map 의 key 를 그대로 사용 — caller 책임으로 ResolvedTokenMap 직렬화 시
 * 같은 형식 유지 필요).
 *
 * **theme 처리**: doc 빌드 시점의 theme 결과가 그대로 저장됨 — caller 별도 주입
 * 불필요. theme 전환 시 새 doc 빌드 필요 (Phase 2 ts-3.5 monitoring 단계 고민).
 *
 * @param ref - TokenRef (예: `"{color.accent}"`) — string literal 도 허용
 * @param doc - canonical CompositionDocument (variables 필드 보유)
 * @returns resolved 값 또는 undefined (ref 형식 invalid / doc.variables 미존재 / key 미매칭)
 *
 * @example
 * ```ts
 * const tokens: ResolvedTokenMap = { "color.accent": "#0070f3" };
 * const doc: CompositionDocument = {
 *   version: "composition-1.0",
 *   variables: snapshotVariablesFromTokens(tokens),
 *   children: [],
 * };
 * resolveCanonicalVariable("{color.accent}", doc); // → "#0070f3"
 * resolveCanonicalVariable("{color.unknown}", doc); // → undefined
 * resolveCanonicalVariable("invalid", doc); // → undefined
 * ```
 */
export function resolveCanonicalVariable(
  ref: string,
  doc: CompositionDocument,
): string | number | boolean | undefined {
  const match = ref.match(TOKEN_REF_PATTERN);
  if (!match) return undefined;

  const [, category, name] = match;
  const key = `${category}.${name}`;

  return doc.variables?.[key]?.value;
}
