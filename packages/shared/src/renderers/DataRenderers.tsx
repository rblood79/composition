/**
 * Data Component Renderers
 *
 * DataTable 은 비시각적 컴포넌트다 — 화면에 아무것도 그리지 않는다.
 */

import type React from "react";
import type { PreviewElement } from "../types";
import type { ReactNode } from "react";
import { Chart } from "../components/Chart";

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

/**
 * Chart 렌더러 (ADR-194) — legacy `rendererMap` 경로.
 *
 * cutover 경로(CanonicalNodeRenderer → `INTERNAL_RENDERERS["chart"]`)와 **같은 shared
 * `Chart` 컴포넌트** 를 렌더한다. 두 경로가 다른 컴포넌트를 그리면 진입로마다 차트가
 * 달라지는데, 그 차이는 팔레트 드롭이 아니라 문서 로드 경로에서만 드러난다.
 */
export function renderChart(element: PreviewElement): ReactNode {
  const props = element.props as Record<string, unknown>;
  return (
    <Chart
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      chartType={props.chartType as never}
      dimension={props.dimension as string | undefined}
      metric={props.metric as string | undefined}
      color={props.color as string | undefined}
      orientation={props.orientation as never}
      stackType={props.stackType as never}
      showAxis={props.showAxis as boolean | undefined}
      showGrid={props.showGrid as boolean | undefined}
      showLegend={props.showLegend as boolean | undefined}
      legendPosition={props.legendPosition as never}
      variant={props.variant as string | undefined}
      size={props.size as never}
      data={props.data as never}
      aria-label={props["aria-label"] as string | undefined}
      className={props.className as string | undefined}
      style={props.style as React.CSSProperties | undefined}
    />
  );
}
