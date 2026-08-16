/**
 * Data Component Renderers
 *
 * DataTable 은 비시각적 컴포넌트다 — 화면에 아무것도 그리지 않는다.
 */

import type { PreviewElement } from "../types";
import type { ReactNode } from "react";

/**
 * DataTable 렌더러 — 렌더 산출물 없음.
 *
 * **2026-08-17 — 데이터 로드 책임이 빠졌다.** 종전에는 `DataTableComponent` 가
 * `dataBinding` 을 fetch 해서 `context.setDataState` 로 Runtime Store 에 실었지만,
 * ADR-132 가 sink 를 `collections.runtimeData` 로 옮긴 뒤 그 배선이 끊긴 채
 * 남아 있었다 — provider 0건이라 `setDataState` 는 항상 undefined 였고,
 * 요청은 나가는데 응답은 버려지고 `✅ DataTable loaded (N items)` 로그만 찍혔다
 * (`refreshInterval` 지정 시 타이머로 무한 반복). 화면·데이터 어느 쪽에도
 * 결과가 닿지 않으므로 fetch 자체를 걷어냈다.
 *
 * 컬렉션 데이터는 Builder 의 DataTable 패널이 `collections` 로 postMessage 하고
 * 소비는 `useCollectionData` 단일 진입점이 담당한다 (ADR-132). 이 컴포넌트를
 * 데이터 경로로 되살리려면 그 sink 로 배선하는 별도 결정이 필요하다.
 *
 * 컴포넌트 타입 자체는 팔레트 surface 로 유지된다 (`metadata.ts` / factory
 * `createDataTableDefinition` / `entryUniverseContract` 계약).
 */
export function renderDataTable(_element: PreviewElement): ReactNode {
  return null;
}
