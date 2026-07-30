import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Page } from "../../../../types/core/store.types";
import { rebuildPageIndex } from "../../../stores/utils/elementIndexer";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { buildPageLayoutPublisherInput } from "../renderers/rendererInput";
import {
  getCachedCommandStream,
  invalidateCommandStreamCache,
} from "../skia/renderCommands";
import { clearSkiaRegistry, registerSkiaNode } from "../skia/useSkiaNode";
import {
  buildSceneStructureCore,
  composeSceneStructureSnapshot,
  resolveSceneVisibility,
} from "./buildSceneSnapshot";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { createPageLayoutSignature } from "./layoutCache";
import type { SceneStructureCore } from "./sceneSnapshotTypes";

/**
 * ADR-172 Phase 5 §6-3 — 팬 프레임 파생 비용 **스케일 회귀**.
 *
 * Hard Constraint 1 은 "팬 프레임당 파생 비용이 요소 수에 비례하지 않는다" 다.
 * 그것을 **시간이 아니라 작업량**으로 단언한다 — 벽시계 측정은 CI 머신 편차로
 * flaky 하고, 회귀의 형태(= 요소 배열을 다시 순회하는가)를 가리키지도 못한다.
 *
 * 계측은 요소 객체를 Proxy 로 감싸 **프로퍼티 접근 횟수**를 세는 것이다. 팬
 * 프레임(카메라만 바뀌는 프레임)에서 그 수가 **0** 이어야 하고, 0 은 요소 수와
 * 무관한 유일한 값이므로 N=1,000 / 5,000 두 규모에서 같은 값이 나온다. 어느
 * 지점이든 O(N) 파생이 되살아나면 접근이 잡혀 FAIL 한다.
 *
 * 계측 자체가 고장나 항상 0 이 나오는 경우와 구분하기 위해 **대조군**을 둔다
 * (`createPageLayoutSignature` 1회 = 요소 수 비례 작업 → 접근 N 이상).
 *
 * 대상 4지점 (ADR §Context 의 P-1~P-4):
 *
 * | 지점 | 팬 프레임 계약                                     | 본 테스트의 단언              |
 * | ---- | -------------------------------------------------- | ----------------------------- |
 * | P-1  | `layoutInputKey` memo hit → 시그니처 재조립 0      | 요소 접근 0 + sceneVersion 불변 |
 * | P-2  | `buildSceneStructureCore` 재호출 0 (카메라 무관)   | core identity 재사용 + 접근 0 |
 * | P-3  | publisher input 이 카메라와 무관                   | 필드 identity 불변            |
 * | P-4  | 커맨드 스트림 캐시 hit → childrenMap builder 미호출 | builder 호출 1회 (첫 프레임)  |
 */

const SCALES = [1_000, 5_000] as const;

/** 팬 프레임 수 — 실제 rAF 팬 1초(120Hz) 분량 */
const PAN_FRAMES = 60;

const CONTAINER = { height: 900, width: 1200 };
const PAGE_SIZE = { height: 600, width: 800 };

/**
 * 페이지 3개를 x 축으로 벌려 둔다 — 2개는 뷰포트(+margin 512) 안, 1개는 밖.
 * visibility 단계가 실제로 판정을 하되, 아래 팬 델타(총 30px)로는 집합이
 * 바뀌지 않는 배치다. 집합이 바뀌면 재발행이 **정상**이라 이 테스트의 정의역이
 * 아니다 (그 경로는 G3 가 담당).
 */
const PAGE_POSITIONS: Record<string, { x: number; y: number }> = {
  "page-1": { x: 0, y: 0 },
  "page-2": { x: 900, y: 0 },
  "page-3": { x: 4_000, y: 0 },
};

const PAGES: Page[] = Object.keys(PAGE_POSITIONS).map((id) => ({
  id,
  project_id: "project-1",
  slug: id,
  title: id,
}));

function makeNode(
  id: string,
  type: string,
  pageId: string,
  parentId: string | null,
): CanvasSceneNode {
  return {
    id,
    type,
    parentId,
    parent_id: parentId,
    pageId,
    page_id: pageId,
    layoutId: null,
    props: { text: id },
    sourceNode: { id, type },
  } as unknown as CanvasSceneNode;
}

interface Instrumented {
  core: SceneStructureCore;
  elements: CanvasSceneNode[];
  /** 계측 리셋 후 누적된 요소 프로퍼티 접근 횟수 */
  touches: () => number;
  resetTouches: () => void;
}

/**
 * N 개 요소를 3 페이지에 나눠 담고, 각 요소를 접근 계측 Proxy 로 감싼다.
 * `core` 는 팬 **이전**에 1회 만들어진 상태 — 라이브의 `BuilderCanvas` core
 * useMemo 가 카메라 deps 를 갖지 않아 팬 중 재실행되지 않는 것과 같다.
 */
function buildInstrumentedScene(elementCount: number): Instrumented {
  let touchCount = 0;
  const onTouch = (): void => {
    touchCount += 1;
  };

  const raw: CanvasSceneNode[] = [];
  for (const page of PAGES) {
    raw.push(makeNode(`${page.id}-body`, "body", page.id, null));
  }
  const perPage = Math.ceil(elementCount / PAGES.length);
  for (const page of PAGES) {
    for (let index = 0; index < perPage; index += 1) {
      raw.push(
        makeNode(`${page.id}-el-${index}`, "Text", page.id, `${page.id}-body`),
      );
    }
  }

  const elements = raw.map(
    (node) =>
      new Proxy(node, {
        get(target, prop, receiver) {
          onTouch();
          return Reflect.get(target, prop, receiver) as unknown;
        },
      }) as CanvasSceneNode,
  );

  const elementsMap = new Map(elements.map((element) => [element.id, element]));
  const pageIndex = rebuildPageIndex(elements, elementsMap);

  const core = buildSceneStructureCore({
    currentPageId: "page-1",
    elements,
    elementsMap,
    layoutVersion: 1,
    pageHeight: PAGE_SIZE.height,
    pageIndex,
    pagePositions: PAGE_POSITIONS,
    pagePositionsVersion: 1,
    pageWidth: PAGE_SIZE.width,
    pages: PAGES,
    source: "canonical",
  });

  return {
    core,
    elements,
    touches: () => touchCount,
    resetTouches: () => {
      touchCount = 0;
    },
  };
}

/** 팬 프레임의 카메라 — 총 이동 30px 로 visible set 을 바꾸지 않는다. */
function cameraAtFrame(frame: number) {
  return {
    containerSize: CONTAINER,
    panOffset: { x: -frame * 0.5, y: -frame * 0.25 },
    zoom: 1,
  };
}

interface PanResult {
  touches: number;
  sceneVersionsAreStable: boolean;
  visibilityKeysAreStable: boolean;
  pageSnapshotsIdentityStable: boolean;
}

/** 팬 프레임을 그대로 돌린다 — 카메라만 바뀌고 core 는 재사용된다. */
function runPan(scene: Instrumented): PanResult {
  const baselineVisibility = resolveSceneVisibility(
    scene.core,
    cameraAtFrame(0),
  );
  const baseline = composeSceneStructureSnapshot(
    scene.core,
    baselineVisibility,
  );

  scene.resetTouches();

  let sceneVersionsAreStable = true;
  let visibilityKeysAreStable = true;
  let pageSnapshotsIdentityStable = true;

  for (let frame = 1; frame <= PAN_FRAMES; frame += 1) {
    const visibility = resolveSceneVisibility(scene.core, cameraAtFrame(frame));
    const snapshot = composeSceneStructureSnapshot(scene.core, visibility);

    if (visibility.key !== baselineVisibility.key) {
      visibilityKeysAreStable = false;
    }
    if (snapshot.sceneVersion !== baseline.sceneVersion) {
      sceneVersionsAreStable = false;
    }
    if (snapshot.pageSnapshots !== baseline.pageSnapshots) {
      pageSnapshotsIdentityStable = false;
    }
  }

  return {
    touches: scene.touches(),
    sceneVersionsAreStable,
    visibilityKeysAreStable,
    pageSnapshotsIdentityStable,
  };
}

describe.each(SCALES)(
  "ADR-172 Phase 5 §6-3 — 팬 프레임 파생 비용 스케일 회귀 (N=%i)",
  (elementCount) => {
    let scene: Instrumented;

    beforeEach(() => {
      scene = buildInstrumentedScene(elementCount);
    });

    it("팬 프레임은 요소를 한 번도 읽지 않는다 (P-1·P-2 재계산 0)", () => {
      expect(runPan(scene).touches).toBe(0);
    });

    it("팬 프레임에서 sceneVersion·visibility key 가 불변이다 (재발행 트리거 0)", () => {
      const result = runPan(scene);
      expect(result.visibilityKeysAreStable).toBe(true);
      expect(result.sceneVersionsAreStable).toBe(true);
    });

    it("팬 프레임에서 pageSnapshots identity 가 유지된다 (P-3 하류 입력 안정)", () => {
      expect(runPan(scene).pageSnapshotsIdentityStable).toBe(true);

      // publisher input 은 카메라를 받지 않으므로 팬 전후 값이 같아야 한다.
      const before = buildPageLayoutPublisherInput({
        dirtyElementIds: new Set(),
        elementById: new Map(),
        pageHeight: PAGE_SIZE.height,
        pageId: "page-1",
        pagePositionVersion: 1,
        pageWidth: PAGE_SIZE.width,
        sceneSnapshot: composeSceneStructureSnapshot(
          scene.core,
          resolveSceneVisibility(scene.core, cameraAtFrame(0)),
        ),
        wasmLayoutReady: true,
      });
      const after = buildPageLayoutPublisherInput({
        dirtyElementIds: new Set(),
        elementById: new Map(),
        pageHeight: PAGE_SIZE.height,
        pageId: "page-1",
        pagePositionVersion: 1,
        pageWidth: PAGE_SIZE.width,
        sceneSnapshot: composeSceneStructureSnapshot(
          scene.core,
          resolveSceneVisibility(scene.core, cameraAtFrame(PAN_FRAMES)),
        ),
        wasmLayoutReady: true,
      });

      expect(before).not.toBeNull();
      expect(after?.bodyElement).toBe(before?.bodyElement);
      expect(after?.pageElements).toBe(before?.pageElements);
      expect(after?.depthMap).toBe(before?.depthMap);
      expect(after?.projectionVersion).toBe(before?.projectionVersion);
    });

    it("계측 sanity — 요소 수에 비례하는 작업은 실제로 잡힌다 (대조군)", () => {
      const bodyElement = scene.core.pageSnapshots.get("page-1")?.bodyElement;
      const pageElements =
        scene.core.pageSnapshots.get("page-1")?.pageElements ?? [];

      scene.resetTouches();
      createPageLayoutSignature(bodyElement ?? null, pageElements);

      // 요소당 최소 1회는 읽는다 — 0 이면 계측이 죽은 것이므로 위 단언이 무의미하다.
      expect(scene.touches()).toBeGreaterThanOrEqual(pageElements.length);
    });
  },
);

describe.each(SCALES)(
  "ADR-172 Phase 5 §6-3 — 팬 프레임 커맨드 childrenMap 재구축 (P-4, N=%i)",
  (elementCount) => {
    let buildCount = 0;
    let layoutMap: Map<string, ComputedLayout>;
    let childIds: string[];

    const call = () =>
      getCachedCommandStream(
        ["root"],
        () => {
          buildCount += 1;
          return new Map<string, CanvasSceneNode[]>([
            [
              "root",
              childIds.map((id) => makeNode(id, "Text", "page-1", "root")),
            ],
          ]);
        },
        layoutMap,
        { "page-1": { x: 0, y: 0 } },
        1,
        1,
        1,
        1,
      );

    beforeEach(() => {
      clearSkiaRegistry();
      invalidateCommandStreamCache();
      buildCount = 0;
      childIds = Array.from(
        { length: elementCount },
        (_, index) => `child-${index}`,
      );
      layoutMap = new Map<string, ComputedLayout>([
        ["root", { x: 0, y: 0, width: 100, height: 100, elementId: "root" }],
      ]);
      registerSkiaNode("root", {
        elementId: "root",
        height: 100,
        type: "container",
        visible: true,
        width: 100,
        x: 0,
        y: 0,
      });
      for (const id of childIds) {
        layoutMap.set(id, {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          elementId: id,
        });
        registerSkiaNode(id, {
          elementId: id,
          height: 10,
          type: "container",
          visible: true,
          width: 10,
          x: 0,
          y: 0,
        });
      }
    });

    afterEach(() => {
      invalidateCommandStreamCache();
      clearSkiaRegistry();
    });

    it("팬 프레임에서 childrenMap builder 가 다시 호출되지 않는다", () => {
      const first = call();
      expect(buildCount).toBe(1);

      for (let frame = 1; frame <= PAN_FRAMES; frame += 1) {
        const next = call();
        expect(next.childrenMap).toBe(first.childrenMap);
      }

      // 요소 수와 무관하게 1 — 비례하면 PAN_FRAMES 만큼 늘어난다.
      expect(buildCount).toBe(1);
    });
  },
);

describe("ADR-172 Phase 5 §6-3 — 규모 간 작업량 동일성", () => {
  it("N 이 5배가 되어도 팬 프레임 작업량이 그대로다", () => {
    const results = SCALES.map((elementCount) => {
      const scene = buildInstrumentedScene(elementCount);
      const { touches } = runPan(scene);
      // 대조군으로 계측이 살아 있는지 같은 씬에서 확인한다.
      const pageElements =
        scene.core.pageSnapshots.get("page-1")?.pageElements ?? [];
      scene.resetTouches();
      createPageLayoutSignature(null, pageElements);
      return { elementCount, touches, controlTouches: scene.touches() };
    });

    const [small, large] = results;

    // 팬 작업량은 규모와 무관하게 동일해야 한다 (요소 수에 비례하면 FAIL).
    expect(small.touches).toBe(large.touches);

    // 반대로 비례 작업(대조군)은 규모를 따라 실제로 늘어난다 — 계측 유효성 증거.
    expect(large.controlTouches).toBeGreaterThan(small.controlTouches);
  });
});
