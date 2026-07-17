import type { CompositionDocument } from "@composition/shared";
import {
  getReusableEntries,
  getReusableEntry,
  getReusableOriginId as getCatalogReusableOriginId,
} from "@composition/shared";
import {
  TOOLBAR_ORIGIN_ID,
  ensureToolbarTemplateOrigins,
} from "./toolbar/toolbarTemplateOrigins";
import {
  FORM_ORIGIN_ID,
  ensureFormTemplateOrigins,
} from "./form/formTemplateOrigins";

/**
 * ADR-912 R-5 (HC#5 "조합 = 데이터") → **ADR-148 Phase 1 (catalog 파생 대체)**.
 *
 * 종전에는 본 모듈의 `REUSABLE_COMPOSITE_ORIGINS` 하드코딩 맵이 별도 레지스트리였다.
 * ADR-148 Phase 1 이 등록 SSOT 를 catalog `kind:"reusable"` entry 로 단일화하여
 * "1 컴포넌트 = 1 등록" 을 reusable 축까지 완성 — 본 모듈은 catalog 파생 re-export +
 * **origin seed(ensurer) 매핑**만 보유한다.
 *
 * **신규 조합 추가 = origin seed 모듈 1개 + catalog reusable entry 1개** (factory 코드
 * 변경 0 — ADR-912 HC#5 / ADR-148 HC#2). entry ↔ ensurer 누락은
 * `componentRegistrationContract.test.ts` 불변식이 강제한다.
 */

/**
 * reusableId → origin seed(멱등 repair) 매핑. catalog 는 id 를 알고, 문서 리터럴과
 * 멱등 repair 는 seed 모듈이 담는다 (설계도 I4). key 는 catalog entry 의 `reusableId`.
 */
export const REUSABLE_ORIGIN_ENSURERS: Readonly<
  Record<string, (document: CompositionDocument) => CompositionDocument>
> = {
  [TOOLBAR_ORIGIN_ID]: ensureToolbarTemplateOrigins,
  [FORM_ORIGIN_ID]: ensureFormTemplateOrigins,
};

/** `type` 이 reusable composite (origin ref 로 생성) 인지 여부 — catalog 파생. */
export function isReusableCompositeType(type: string): boolean {
  return getReusableEntry(type) !== undefined;
}

/** `type` 의 reusable origin id (아니면 null) — catalog 파생. */
export function getReusableCompositeOriginId(type: string): string | null {
  return getCatalogReusableOriginId(type);
}

/**
 * 모든 reusable composite origin 을 Components page body 에 보장한다 (멱등).
 *
 * 신규 프로젝트 생성 + hydration 진입점에서 호출한다. catalog 의 reusable entry 를
 * 순회하며 reusableId 별 ensurer 를 적용 — entry 추가 시 seed 모듈 + `REUSABLE_ORIGIN_ENSURERS`
 * 1줄이면 자동 합류한다. ensurer 부재 entry 는 조용히 건너뛰지 않고 개발 중 즉시
 * 드러나도록 test 불변식이 차단한다 (여기서는 방어적 skip — bootstrap 경로 안전 우선).
 */
export function ensureReusableCompositeOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let next = document;
  for (const entry of getReusableEntries()) {
    const ensure = REUSABLE_ORIGIN_ENSURERS[entry.reusableId];
    if (ensure) next = ensure(next);
  }
  return next;
}
