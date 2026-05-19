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

/**
 * resolved 값의 런타임 타입 → `TokensSnapshotEntry.type` 추론.
 * 직렬화 불가 값(undefined / object 등)은 `null` 반환 (caller 가 스킵).
 */
function inferTokenType(value: unknown): TokensSnapshotEntry["type"] | null {
  if (typeof value === "string") return "color";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return null;
}

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
    const type = inferTokenType(value);
    if (type === null) continue; // 직렬화 불가 값은 스킵

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

// ─────────────────────────────────────────────
// ADR-143 Phase 3 — 토큰 델타 저장 / merge
// ─────────────────────────────────────────────

/**
 * spec-token override 델타 + user-defined token 만 추출한 `TokensSnapshot` 빌드.
 *
 * ADR-143 §3-2: `CompositionDocument.tokens` 는 토큰 전체 세트가 아니라
 * **델타만** 저장한다 — 문서 비대화(Hard Constraint 3) 차단.
 *
 * - spec-token: `seedTokens`(`primitives/` 기본값)와 **다른 값** 만 저장 (override 델타).
 *   seed 와 동일한 값(미커스터마이즈)은 제외 → 미커스터마이즈 프로젝트는 빈 객체에 근접.
 * - user-defined: 항상 저장 (seed 에 없는 신규 토큰).
 *
 * `mergeTokensSnapshot()` 의 역연산. spec 기본 토큰은 런타임 seed 로 복원되므로
 * 문서에 중복 저장하지 않는다.
 *
 * @param args.resolvedTokens - 현재 프로젝트의 spec-token resolve 결과 (override 반영)
 * @param args.seedTokens - `primitives/` 기본 토큰 resolve 결과 (델타 비교 기준)
 * @param args.userDefinedTokens - 사용자 정의 신규 토큰 (선택)
 * @returns 델타 TokensSnapshot
 */
export function buildTokensSnapshot(args: {
  resolvedTokens: ResolvedTokenMap;
  seedTokens: ResolvedTokenMap;
  userDefinedTokens?: Record<
    string,
    { type: TokensSnapshotEntry["type"]; value: string | number | boolean }
  >;
}): TokensSnapshot {
  const { resolvedTokens, seedTokens, userDefinedTokens } = args;
  const snapshot: TokensSnapshot = {};

  // spec-token: seed 와 다른 값(override)만 저장
  for (const [key, value] of Object.entries(resolvedTokens)) {
    if (seedTokens[key] === value) continue; // 기본값과 동일 → 델타 아님
    const type = inferTokenType(value);
    if (type === null) continue;
    snapshot[key] = { type, value, source: "spec-token" };
  }

  // user-defined: 전부 저장 (seed 에 없는 신규 토큰)
  for (const [key, def] of Object.entries(userDefinedTokens ?? {})) {
    snapshot[key] = {
      type: def.type,
      value: def.value,
      source: "user-defined",
    };
  }

  return snapshot;
}

/**
 * `primitives/` seed + 문서 `tokens` 델타 → 완전한 `TokensSnapshot` 으로 merge.
 *
 * ADR-143 §3-2 merge 순서: `primitives/` seed → 문서 `tokens` 델타 override.
 * `buildTokensSnapshot()` 의 역연산 — 런타임에서 완전한 토큰 세트 복원.
 *
 * @param seedTokens - `primitives/` 기본 토큰 resolve 결과
 * @param delta - 문서 `tokens` 필드 (델타) — undefined 면 seed 만 반환
 * @returns seed + 델타 override 가 합쳐진 완전한 TokensSnapshot
 */
export function mergeTokensSnapshot(
  seedTokens: ResolvedTokenMap,
  delta: TokensSnapshot | undefined,
): TokensSnapshot {
  const merged: TokensSnapshot = {};

  // seed 전부 (spec-token)
  for (const [key, value] of Object.entries(seedTokens)) {
    const type = inferTokenType(value);
    if (type === null) continue;
    merged[key] = { type, value, source: "spec-token" };
  }

  // 문서 델타 override (spec-token override + user-defined)
  for (const [key, entry] of Object.entries(delta ?? {})) {
    merged[key] = entry;
  }

  return merged;
}
