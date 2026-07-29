import { describe, expect, it } from "vitest";
import { resolveCameraStableVisibility } from "./cameraStableVisibility";
import type { SceneStructureCore } from "./sceneSnapshotTypes";

/**
 * ADR-173 Phase 2 — 무효화 사유 분리는 **재계산 게이트**로 구현한다.
 *
 * 가시 집합이 바뀌면 하류 5곳(layout publish / rendererInput / 스트림 캐시 키 /
 * surface 무효화 2종)이 한꺼번에 격상된다. 그 5곳이 전부 이 한 값의 하류라서,
 * 여기서 한 번 멈추면 전부 멈춘다 (design §2-3 A).
 *
 * 게이트의 판정 축은 `SceneStructureCore` identity 하나다:
 * - core 가 그대로 = 카메라만 변한 것 → 얼려도 된다
 * - core 가 바뀌었다 = 편집/레이아웃 → **얼리면 안 된다** (Hard Constraint 2, R1)
 */

/**
 * 게이트가 보는 것은 core 의 **identity** 와 `resolveSceneVisibility` 가 읽는
 * 두 필드(allPageFrames / pageSnapshots) 뿐이라 최소 core 로 충분하다.
 * 편집은 "새 core 객체" 로 대표된다 — 실제 파이프라인에서도 core 는 useMemo
 * 산출물이라 입력이 바뀌면 새 객체가 된다.
 */
function makeCore(pageIds: string[]): SceneStructureCore {
  const allPageFrames = pageIds.map((id, i) => ({
    elementCount: 0,
    height: 844,
    id,
    title: id,
    width: 390,
    x: i * 470,
    y: 0,
  }));
  const pageSnapshots = new Map(
    pageIds.map((id) => [
      id,
      { contentVersion: 1, pageId: id, positionVersion: 1 },
    ]),
  );
  return {
    document: { allPageFrames },
    pageSnapshots,
  } as unknown as SceneStructureCore;
}

const CAMERA_A = {
  containerSize: { height: 800, width: 1000 },
  panOffset: { x: 0, y: 0 },
  zoom: 1,
};
// 페이지 3장이 화면 밖으로 나갈 만큼 이동한 카메라
const CAMERA_B = {
  containerSize: { height: 800, width: 1000 },
  panOffset: { x: -3000, y: 0 },
  zoom: 1,
};

const PAGES = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"];

describe("ADR-173 Phase 2 — 카메라 유발 재계산 게이트", () => {
  it("게이트가 열려 있으면 카메라 변경이 그대로 반영된다 (현행 동작)", () => {
    const core = makeCore(PAGES);
    const first = resolveCameraStableVisibility(null, core, CAMERA_A, false);
    const second = resolveCameraStableVisibility(
      first.cache,
      core,
      CAMERA_B,
      false,
    );

    expect(second.result.key).not.toBe(first.result.key);
  });

  it("게이트가 닫혀 있으면 카메라만 바뀐 프레임은 **같은 identity** 를 돌려준다", () => {
    const core = makeCore(PAGES);
    const first = resolveCameraStableVisibility(null, core, CAMERA_A, true);
    const frozen = resolveCameraStableVisibility(
      first.cache,
      core,
      CAMERA_B,
      true,
    );

    // 값이 같은 게 아니라 **객체가 같아야** 한다 — 하류 useMemo 가 identity 로 건다.
    expect(frozen.result).toBe(first.result);
  });

  it("게이트가 닫혀 있어도 core 가 바뀌면 즉시 재계산한다 (편집 즉시성 — HC2/R1)", () => {
    const core = makeCore(PAGES);
    const first = resolveCameraStableVisibility(null, core, CAMERA_A, true);

    // 편집 = core identity 변경 (여기서는 새 core 객체로 대표)
    const editedCore = makeCore(PAGES);
    const afterEdit = resolveCameraStableVisibility(
      first.cache,
      editedCore,
      CAMERA_A,
      true,
    );

    expect(afterEdit.result).not.toBe(first.result);
    expect(afterEdit.cache?.core).toBe(editedCore);
  });

  it("게이트가 열리면 얼어 있던 카메라가 따라잡는다", () => {
    const core = makeCore(PAGES);
    const first = resolveCameraStableVisibility(null, core, CAMERA_A, true);
    const frozen = resolveCameraStableVisibility(
      first.cache,
      core,
      CAMERA_B,
      true,
    );
    const released = resolveCameraStableVisibility(
      frozen.cache,
      core,
      CAMERA_B,
      false,
    );

    expect(released.result).not.toBe(first.result);
    expect(released.result.key).not.toBe(first.result.key);
  });

  it("캐시가 비어 있으면 게이트가 닫혀 있어도 계산한다 (첫 프레임)", () => {
    const core = makeCore(PAGES);
    const first = resolveCameraStableVisibility(null, core, CAMERA_A, true);

    expect(first.result.visiblePageIds.size).toBeGreaterThan(0);
    expect(first.cache?.core).toBe(core);
  });
});
