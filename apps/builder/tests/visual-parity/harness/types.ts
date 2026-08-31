/**
 * ADR-198 Phase 1 — 파일럿 케이스 / 결과 계약 (test-only)
 *
 * 여기 있는 타입은 전부 테스트 전용이다. 저장되는 스키마도, 런타임 계약도 아니다
 * (breakdown §1.3 schema orthogonality). 이름은 바뀔 수 있지만 아래 불변식은 고정이다:
 *
 * - `skiaDocument` / `previewDocument` 같은 leg 별 문서 필드는 **없다** (HC2).
 * - region 은 화면 좌표가 아니라 **canonical node id** 로 소속을 정한다.
 * - mask 는 유한 사각형이고 프레임 전체를 덮을 수 없다.
 * - 예산은 비율과 진폭을 **둘 다** 갖는다 (HC6 — Phase 0 §2.4 실측 근거).
 */

import type { CompositionDocument } from "@composition/shared";

export type RegionKind =
  | "geometry"
  | "non-text"
  /** AA / clip 경계 밴드 — SW↔GL 과 Skia↔Chromium 양쪽에서 발산하는 자리 */
  | "edge"
  | "text"
  | "raster";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualParityRegion {
  id: string;
  /** 이 region 에 속한 canonical node id — 스크린샷 좌표가 아니다 */
  nodeIds: string[];
  kind: RegionKind;
  /** 비율 상한 (다른 픽셀 수 / 전체) */
  maxDiffRatio?: number;
  /** 진폭 상한 (0-255). ratio 와 **AND** 로 판정 — 둘 다 넘어야 실패 */
  maxByte?: number;
  /** 유한 사각형만. 프레임 전체를 덮는 mask 는 금지 */
  mask?: Rect[];
  reason?: string;
  owner?: string;
  /** ISO 날짜. 지난 예외는 ratchet 테스트가 실패시킨다 */
  reviewBy?: string;
}

export interface VisualParityCase {
  id: string;
  document: CompositionDocument;
  pageId: string;
  viewport: { width: number; height: number; dpr: 1 };
  theme: "light" | "dark";
  regions: VisualParityRegion[];
  /**
   * 아티보드 컨테이너 노드 id — **비교 대상이 아니라 비교의 기준틀**이다.
   *
   * Skia 는 이 노드를 그리지 않는다 (아티보드 자체가 surface 라 `treeBoundsMap`
   * 에 상자가 없다). Preview 는 DOM 이 컨테이너 엘리먼트를 필요로 해서
   * `<div data-element-id>` 로 낸다. 둘은 **같은 시각 결과를 내는 서로 다른 표현**
   * 이고, ssot-hierarchy 의 대칭 정의("구현 방법이 아니라 시각 결과의 동일성")상
   * identity 비교에서 제외하는 것이 옳다.
   *
   * 대신 아티보드의 **시각 속성**(배경·크기)은 다른 데서 반드시 덮여야 한다 —
   * §3.6 normalization 의 artboard crop + 배경 처리. 여기서 빼는 것은 노드
   * identity 축뿐이고, 아티보드가 안 보이게 되는 게 아니다.
   */
  artboardNodeId: string;
  /**
   * 두 leg 모두 이 id 들을, 이 순서로 내야 한다 (G1 identity).
   * `artboardNodeId` 는 포함하지 않는다.
   */
  expectedNodeIds: string[];
}

/** 핀 고정된 환경. 두 leg 이 같은 값을 보고해야 한다 (HC4). */
export interface EnvironmentManifest {
  canvasKitVersion: string;
  /** Skia leg 은 `"sw"` 여야 한다. 그 외는 `PARITY-ENV` */
  surfaceBackend: "sw" | "gl" | "unknown";
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  theme: "light" | "dark";
  locale: string;
  colorScheme: string;
  reducedMotion: boolean;
}

/** 한 leg 의 산출물. 픽셀 비교 전에 identity 가 먼저 판정된다. */
export interface LegResult {
  legId: "skia" | "preview";
  fixtureChecksum: string;
  environmentChecksum: string;
  /** 렌더 순서대로의 canonical node id */
  nodeOrder: string[];
  /** 아티보드 상대 좌표 */
  geometry: Record<string, Rect>;
  /** 정규화 RGBA (없으면 PNG 만 확보된 상태) */
  pixels?: Uint8Array;
  png?: Uint8Array;
  /** 칠해진 노드 수 — liveness 판정 입력 (HC11) */
  paintedNodeCount: number;
  consoleErrors: string[];
}

/** 닫힌 실패 코드 집합 (HC9). 여기 없는 코드는 ledger ratchet 이 거부한다. */
export const PARITY_CODES = [
  "PARITY-ENV",
  "PARITY-LIVE",
  "PARITY-L0-IDENTITY",
  "PARITY-L1-GEOMETRY",
  "PARITY-L2-STYLE",
  "PARITY-L3-PIXEL",
  "PARITY-L4-TEXT",
  "PARITY-RESOURCE",
] as const;

export type ParityCode = (typeof PARITY_CODES)[number];

export interface ParityFailure {
  code: ParityCode;
  /** 어느 layer 에서 갈렸는지 */
  layer: "env" | "live" | "L0" | "L1" | "L2" | "L3" | "L4" | "resource";
  /** 처음 갈린 노드/필드/region */
  first: string;
  detail: string;
}

export type ParityVerdict =
  { ok: true } | { ok: false; failures: ParityFailure[] };
