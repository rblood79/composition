import type { CompositionDocument } from "@composition/shared";
import {
  TOOLBAR_ORIGIN_ID,
  ensureToolbarTemplateOrigins,
} from "./toolbar/toolbarTemplateOrigins";
import {
  FORM_ORIGIN_ID,
  ensureFormTemplateOrigins,
} from "./form/formTemplateOrigins";

/**
 * ADR-912 R-5 (HC#5 "조합 = 데이터"): reusable composite 레지스트리.
 *
 * 종전에는 조합 컴포넌트마다 `createXxxDefinition`(factory 코드)이 조합 트리를 하드코딩
 * 생성했다. R-5 는 그 트리를 Components page 의 reusable origin 문서 1벌로 옮기고, palette-add
 * 는 본 레지스트리(데이터)만 보고 `type:"ref"` instance 를 만든다.
 *
 * **신규 조합 추가 = origin 문서 + 본 맵 1줄 (factory 코드 변경 0).** 이것이 HC#5 의 증명이며,
 * `useElementCreator` 가 COMPLEX/simple 분기에 앞서 본 맵을 조회한다.
 *
 * 현재 멤버: Toolbar (R-5 첫 proof slice, 1단 조합) + Form (R-5 둘째 proof, 2단 중첩 조합).
 * 후속 조합은 origin 모듈 + 본 맵 entry 추가만으로 합류한다.
 */
export const REUSABLE_COMPOSITE_ORIGINS: Readonly<Record<string, string>> = {
  Toolbar: TOOLBAR_ORIGIN_ID,
  Form: FORM_ORIGIN_ID,
};

/** `type` 이 reusable composite (origin ref 로 생성) 인지 여부. */
export function isReusableCompositeType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(REUSABLE_COMPOSITE_ORIGINS, type);
}

/** `type` 의 reusable origin id (아니면 null). */
export function getReusableCompositeOriginId(type: string): string | null {
  return REUSABLE_COMPOSITE_ORIGINS[type] ?? null;
}

/**
 * 모든 reusable composite origin 을 Components page body 에 보장한다 (멱등).
 *
 * 신규 프로젝트 생성 + hydration 진입점에서 호출한다. 각 origin 모듈의 `ensureXxx` 를 순차
 * 적용 — 멤버 추가 시 본 함수에 ensure 호출 1줄만 더한다.
 */
export function ensureReusableCompositeOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let next = document;
  next = ensureToolbarTemplateOrigins(next);
  next = ensureFormTemplateOrigins(next);
  return next;
}
