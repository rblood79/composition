/**
 * Select Items SSOT — Stored 모델 (ADR-073 P1)
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * ADR-100 Phase 1 (098-a 슬롯): composition 내부 식별자 "SelectItem" 은
 * RAC 공식 `ListBoxItem` 의 alias 로 간주한다. runtime DOM 은 이미
 * `<ListBoxItem>` 으로 렌더 (Select factory 내부 RAC composition). 저장
 * 식별자 rename 은 BC HIGH (모든 Select 프로젝트 migration) 회피 위해 미수행 —
 * composition 고유 type 유지 + RSP 공식 alias 명시로 문서 정합 보강.
 *
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId` 필드와 Stored/Runtime 분리
 * (`RuntimeSelectItem` / `toRuntimeSelectItem`) 은 제거됐다 — event-id 채널이
 * 발화 경로 없는 dead seam 이었고 (preview `resolveActionId` 상시 undefined),
 * RAC/RSP 어휘상 Select 는 per-item action 이 없다 (선택 = `onSelectionChange`).
 * 렌더러(SelectionRenderers)는 Stored 모델을 직접 소비한다.
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 */
export interface StoredSelectItem {
  id: string;
  label: string;
  value?: string;
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
}
