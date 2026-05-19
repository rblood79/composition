/**
 * @fileoverview ADR-110 Phase 1+2 / ADR-143 — Token Snapshot/Resolve Adapter
 *
 * ADR-022 TokenRef/CSS 변수 체계 ↔ canonical document `tokens` 필드 양방향 변환.
 * (ADR-143: canonical `variables` → `tokens` 정명 — D3 시각 design token SSOT.
 * 런타임 `variables` store(`authToken` 등 앱 상태)와 도메인 분리.)
 *
 * - **snapshot**: `snapshotTokensFromResolved()` + `snapshotUserDefinedTokens()`
 *   — `tokenResolver.ts` 가 여전히 런타임 SSOT, document 직렬화만 수행
 * - **read**: `readCanonicalTokens(doc)` — canonical document `tokens` 필드 accessor
 * - **resolve**: `resolveCanonicalToken(ref, doc)` — `doc.tokens` 에서 ref 를 lookup
 *   하여 resolved 값 반환. 같은 theme 의 resolve 결과로 빌드된 doc 이라면
 *   `tokenResolver.ts::resolveToken(ref, theme)` 과 **동일 값** 반환 (Gate G-B 조건).
 *
 * **Read-only 원칙**:
 * - canonical document → tokenResolver 쓰기 금지
 * - 런타임 token resolve 는 여전히 `tokenResolver.ts` 가 SSOT
 * - snapshot 함수는 call-time 직렬화 — subscribe 기반 아님
 *   (ADR-110 R4 대응: stale snapshot 방지)
 *
 * **Resolver contract**:
 * - `resolveCanonicalToken("{category.name}", doc)` → `doc.tokens[key].value`
 * - theme 정보는 doc 에 내장 (snapshot 시점 결정) — caller 가 별도 주입 불필요
 * - `doc.tokens` 미존재 시 undefined 반환 (BC)
 *
 * **TokensSnapshot 설계 (ADR-110 R3)**:
 * - `source: "spec-token" | "user-defined"` 구분자로 출처 명시
 * - user-defined token authoring UI 는 후속 Phase 로 이관
 */

import type {
  CompositionDocument,
  TokensSnapshot,
  TokensSnapshotEntry,
} from "@composition/shared";

// Re-export for convenience (adapter 소비자가 별도 import 불필요)
export type { TokensSnapshot, TokensSnapshotEntry } from "@composition/shared";

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
 * Spec TokenRef resolve 결과 → `TokensSnapshot` 직렬화.
 *
 * call-time 직렬화 (subscribe 기반 아님) — stale snapshot 방지 (ADR-110 R4).
 * `legacyToCanonical()` 호출 시 전달된 `getTokens()` 콜백에서 호출됨.
 *
 * @param resolvedTokens - tokenResolver.ts 의 resolve 결과 평탄화 map
 * @returns TokensSnapshot — canonical document `tokens` 필드에 주입할 snapshot
 */
export function snapshotTokensFromResolved(
  resolvedTokens: ResolvedTokenMap,
): TokensSnapshot {
  const snapshot: TokensSnapshot = {};

  for (const [key, value] of Object.entries(resolvedTokens)) {
    let type: TokensSnapshotEntry["type"];

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
 * 사용자 정의 토큰 map → `TokensSnapshot` 직렬화.
 *
 * user-defined token authoring UI 는 후속 Phase 로 이관. 향후 사용 예약.
 * 이미 `TokenDefinition` 형태로 저장된 사용자 토큰을 `TokensSnapshot` 으로 변환.
 *
 * @param userTokens - 사용자 정의 토큰 map (`TokenDefinition` 구조와 동일)
 * @returns TokensSnapshot (source: "user-defined" 로 마킹)
 */
export function snapshotUserDefinedTokens(
  userTokens: Record<
    string,
    {
      type: "color" | "number" | "string" | "boolean";
      value: string | number | boolean;
    }
  >,
): TokensSnapshot {
  const snapshot: TokensSnapshot = {};

  for (const [key, def] of Object.entries(userTokens)) {
    snapshot[key] = {
      type: def.type,
      value: def.value,
      source: "user-defined", // ADR-110 R3: 사용자 정의 토큰 출처 명시
    };
  }

  return snapshot;
}

/**
 * canonical document 에서 `tokens` 필드를 `TokensSnapshot` 으로 읽기.
 *
 * read-only accessor. `tokens` 필드가 없으면 `undefined` 반환.
 *
 * @param doc - canonical CompositionDocument
 * @returns TokensSnapshot 또는 undefined (tokens 필드 없음)
 */
export function readCanonicalTokens(
  doc: CompositionDocument,
): TokensSnapshot | undefined {
  return doc.tokens ?? undefined;
}

// ─────────────────────────────────────────────
// Resolver
// ─────────────────────────────────────────────

/**
 * Spec TokenRef pattern: `{category.name}` (예: `{color.accent}`).
 *
 * `tokenResolver.ts::resolveToken` 의 정규식과 동일 — name 부분에 `.` 포함 가능
 * (예: `{color.accent-hover}`, `{color.layer-1}`).
 */
const TOKEN_REF_PATTERN = /^\{(\w+)\.(.+)\}$/;

/**
 * canonical document `tokens` 에서 TokenRef 의 resolved 값을 lookup.
 *
 * **Contract (Gate G-B)**: 같은 theme 의 resolve 결과로 빌드된 doc 이라면,
 * `resolveCanonicalToken(ref, doc)` 와 `tokenResolver.ts::resolveToken(ref, theme)`
 * 은 **동일 값** 반환.
 *
 * **doc.tokens 키 형식**: `${category}.${name}` (`snapshotTokensFromResolved` 가
 * input map 의 key 를 그대로 사용 — caller 책임으로 ResolvedTokenMap 직렬화 시
 * 같은 형식 유지 필요).
 *
 * **theme 처리**: doc 빌드 시점의 theme 결과가 그대로 저장됨 — caller 별도 주입
 * 불필요. theme 전환 시 새 doc 빌드 필요.
 *
 * @param ref - TokenRef (예: `"{color.accent}"`) — string literal 도 허용
 * @param doc - canonical CompositionDocument (`tokens` 필드 보유)
 * @returns resolved 값 또는 undefined (ref 형식 invalid / doc.tokens 미존재 / key 미매칭)
 *
 * @example
 * ```ts
 * const tokens: ResolvedTokenMap = { "color.accent": "#0070f3" };
 * const doc: CompositionDocument = {
 *   version: "composition-1.0",
 *   tokens: snapshotTokensFromResolved(tokens),
 *   children: [],
 * };
 * resolveCanonicalToken("{color.accent}", doc); // → "#0070f3"
 * resolveCanonicalToken("{color.unknown}", doc); // → undefined
 * resolveCanonicalToken("invalid", doc); // → undefined
 * ```
 */
export function resolveCanonicalToken(
  ref: string,
  doc: CompositionDocument,
): string | number | boolean | undefined {
  const match = ref.match(TOKEN_REF_PATTERN);
  if (!match) return undefined;

  const [, category, name] = match;
  const key = `${category}.${name}`;

  return doc.tokens?.[key]?.value;
}
