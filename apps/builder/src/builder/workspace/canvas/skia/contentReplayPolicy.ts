/**
 * ADR-173 Phase 5 — content Picture replay 판정 (순수 로직).
 *
 * 재래스터 1회 비용의 지배 축은 GPU 래스터(flush.content mean 6.4ms)가 아니라
 * **커맨드 재기록**(`executeRenderCommands` 의 JS→WASM walk — 줌 오실레이션
 * 실측 mean 46.8ms / p95 90.9ms)이다. 커맨드는 (stream, cullingBounds, fontMgr)
 * 의 순수 함수이고 카메라는 canvas CTM 에만 있으므로, scene 좌표로 SkPicture 에
 * 1회 기록해 두면 카메라 유발 재래스터는 native `drawPicture` replay 로 대체된다
 * — 새 zoom 으로의 래스터화는 replay 시 CTM 이 수행하므로 품질이 walk 와 같다.
 *
 * 판정이 기대는 불변식: 커맨드 스트림을 바꾸는 모든 경로는 `invalidateContent()`
 * (→ reason "invalidate") 또는 registryVersion (→ reason "registry") 를 거친다
 * (ADR-173 Phase 0 — 격상 지점 5곳 전부 sceneVisibility/rendererInput 하류).
 * 따라서 카메라 유발 사유의 프레임에서 스트림은 불변이다 — 기존 snapshot blit
 * 캐시와 동일한 무효화 계약의 상속이다.
 */

/**
 * 카메라 유발 재래스터 사유 — 콘텐츠(커맨드 스트림)는 불변이고 래스터만 다시
 * 필요한 프레임. `SkiaRenderer.classifyFrame` 의 reason 문자열과 1:1.
 *
 * - `zoom-refresh` / `coverage-refresh`: 제스처 중 기하 조건 재래스터
 * - `cleanup`: 모션 종료 200ms 후 최종 품질 정리 — replay 출력은 walk 와 동일
 * - `no-snapshot`: 스냅샷 부재 복구 — 콘텐츠는 불변
 */
const CAMERA_DRIVEN_RASTER_REASONS: ReadonlySet<string> = new Set([
  "zoom-refresh",
  "coverage-refresh",
  "cleanup",
  "no-snapshot",
]);

export function isCameraDrivenRasterReason(reason: string | null): boolean {
  return reason !== null && CAMERA_DRIVEN_RASTER_REASONS.has(reason);
}

/** record 된 content Picture 의 유효성 키 */
export interface ContentPictureKey {
  /** record 시점의 scene-space 커버리지 (padded culling bounds) */
  bounds: DOMRect;
  /** record 시점의 콘텐츠 세대 — classify "registry" 경로의 belt-and-braces */
  registryVersion: number;
}

export type ContentPaintPath =
  /** 캐시된 Picture 를 native replay — walk 생략 */
  | "replay"
  /** walk 를 PictureRecorder 경유로 1회 수행해 Picture 를 채우고 replay 로 소비 */
  | "record-replay"
  /** 콘텐츠 변경 — 종전 walk 직행 (Picture 폐기, 편집 경로 비용 무변) */
  | "walk";

/**
 * record 커버리지가 이번 프레임의 요구 영역을 완전히 덮는지 판정한다.
 *
 * zoom-in 은 요구 영역(visible + padding/zoom)이 축소되므로 항상 덮인다.
 * pan/zoom-out 으로 요구 영역이 record 범위를 벗어나면 재기록이 필요하다 —
 * `canBlitWithCameraTransform` 의 픽셀 커버리지 판정과 같은 형태의 scene 판.
 */
export function contentPictureCovers(
  recorded: DOMRect,
  required: DOMRect,
  epsilonScenePx = 0.01,
): boolean {
  return (
    recorded.x <= required.x + epsilonScenePx &&
    recorded.y <= required.y + epsilonScenePx &&
    recorded.x + recorded.width >=
      required.x + required.width - epsilonScenePx &&
    recorded.y + recorded.height >=
      required.y + required.height - epsilonScenePx
  );
}

export function resolveContentPaintPath(
  reason: string | null,
  key: ContentPictureKey | null,
  registryVersion: number,
  requiredBounds: DOMRect,
): ContentPaintPath {
  if (!isCameraDrivenRasterReason(reason)) return "walk";
  if (
    key &&
    key.registryVersion === registryVersion &&
    contentPictureCovers(key.bounds, requiredBounds)
  ) {
    return "replay";
  }
  return "record-replay";
}
