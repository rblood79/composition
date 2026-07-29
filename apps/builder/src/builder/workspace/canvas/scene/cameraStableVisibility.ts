import { resolveSceneVisibility } from "./buildSceneSnapshot";
import type {
  SceneStructureCore,
  SceneVisibilityCamera,
  SceneVisibilityResult,
} from "./sceneSnapshotTypes";

/**
 * ADR-173 Phase 2 — 카메라 유발 가시 집합 재계산 게이트.
 *
 * 가시 집합이 바뀌면 하류가 한꺼번에 격상된다 — layout publish, `rendererInput`
 * 재생성(→ 커맨드 스트림 캐시 통째 무효화 + content 무효화), 스트림 캐시의
 * `pagePosVersion` 키, surface 무효화 2종. 다섯 지점이 전부 이 값 하나의
 * 하류라서, 여기서 멈추면 전부 멈춘다 (design §2-3 A).
 *
 * 판정 축은 **`SceneStructureCore` identity 하나**다:
 * - core 가 그대로면 달라진 것은 카메라뿐 → 얼려도 화면 내용은 blit 이 나른다
 * - core 가 바뀌었으면 편집/레이아웃이므로 **얼리지 않는다** (Hard Constraint 2)
 *
 * 그래서 무효화 사유의 카메라/콘텐츠 분리를 위해 `visibleContentVersion` 을
 * 축별로 쪼갤 필요가 없다 — 쪼개지 않으므로 ADR-136 sceneVersion signature
 * 입력 목록도 무변경이다 (Hard Constraint 4).
 */
export interface CameraStableVisibilityCache {
  core: SceneStructureCore;
  result: SceneVisibilityResult;
}

export interface CameraStableVisibilityOutcome {
  cache: CameraStableVisibilityCache;
  /** 이 프레임에서 실제로 재계산했는가 (dev 진단·테스트용) */
  recomputed: boolean;
  result: SceneVisibilityResult;
}

/**
 * @param cache   직전 프레임의 산출물 (첫 프레임이면 null)
 * @param frozen  카메라 제스처가 진행 중이라 카메라 유발 갱신을 미룰지 여부
 */
export function resolveCameraStableVisibility(
  cache: CameraStableVisibilityCache | null,
  core: SceneStructureCore,
  camera: SceneVisibilityCamera,
  frozen: boolean,
): CameraStableVisibilityOutcome {
  if (frozen && cache && cache.core === core) {
    // 카메라만 변했다 — 직전 결과의 **identity 를 그대로** 돌려준다.
    // 값이 같은 새 객체를 만들면 하류 useMemo 가 전부 miss 해 이연이 무의미해진다.
    return { cache, recomputed: false, result: cache.result };
  }

  const result = resolveSceneVisibility(core, camera);
  return {
    cache: { core, result },
    recomputed: true,
    result,
  };
}
