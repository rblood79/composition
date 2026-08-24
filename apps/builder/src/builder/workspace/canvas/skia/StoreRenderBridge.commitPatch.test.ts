// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { EditorMutationDescriptor } from "../../../presentation/editorPresentationTypes";
import { StoreRenderBridge } from "./StoreRenderBridge";
import {
  getCachedCommandStream,
  invalidateCommandStreamCache,
} from "./renderCommands";
import { clearSkiaRegistry, getRegistryVersion } from "./useSkiaNode";

const PAGE_ID = "page-1";
const BODY_ID = "commit-body";
const FIRST_ID = "commit-first";
const SECOND_ID = "commit-second";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Frame",
    page_id: PAGE_ID,
    parent_id: null,
    order_num: 0,
    props: { style: { backgroundColor: "#ffffff" } },
    deleted: false,
    ...overrides,
  } as CanvasSceneNode;
}

interface Scene {
  readonly childrenMap: Map<string, CanvasSceneNode[]>;
  readonly elementsMap: Map<string, CanvasSceneNode>;
  readonly layoutMap: Map<string, ComputedLayout>;
}

function buildScene(): Scene {
  const body = makeElement(BODY_ID, { type: "body" });
  const first = makeElement(FIRST_ID, { parent_id: BODY_ID });
  const second = makeElement(SECOND_ID, { parent_id: BODY_ID });

  return {
    childrenMap: new Map([[BODY_ID, [first, second]]]),
    elementsMap: new Map([
      [BODY_ID, body],
      [FIRST_ID, first],
      [SECOND_ID, second],
    ]),
    layoutMap: new Map<string, ComputedLayout>([
      [BODY_ID, { x: 0, y: 0, width: 800, height: 600 } as ComputedLayout],
      [FIRST_ID, { x: 10, y: 20, width: 120, height: 60 } as ComputedLayout],
      [SECOND_ID, { x: 10, y: 100, width: 120, height: 60 } as ComputedLayout],
    ]),
  };
}

function styleDescriptor(nodeId: string): EditorMutationDescriptor {
  return {
    patch: { backgroundColor: "#123456" },
    target: { kind: "canonical-node", nodeId },
    type: "style.patch",
  };
}

/**
 * commit lane 을 splice 가능한 상태로 만든다.
 *
 * 1) pending 없는 sync → fullRebuild 로 registry 를 채우고 prevElementsMap 을 건다.
 * 2) 그 registry 로 command stream 캐시를 seed — `applyPendingCommitPatch` 의
 *    `current` 스냅샷이 된다.
 *
 * 이후 같은 elementsMap 참조로 다시 sync 하면 changed id 가 비어 incrementalSync
 * 를 건너뛰고 곧장 dirty-root splice 로 들어간다.
 */
function primeBridge(scene: Scene): StoreRenderBridge {
  const bridge = new StoreRenderBridge();
  bridge.sync(
    scene.elementsMap,
    scene.layoutMap,
    "light",
    scene.childrenMap,
    0,
    false,
    0,
  );
  getCachedCommandStream(
    [BODY_ID],
    scene.childrenMap,
    scene.layoutMap,
    { [BODY_ID]: { x: 0, y: 0 } },
    getRegistryVersion(),
    0,
    0,
    0,
    { presentationRevision: 0, baseCanonicalRevision: 0 },
  );
  return bridge;
}

describe("StoreRenderBridge ADR-189 commit patch — 다중 dirty root", () => {
  beforeEach(() => {
    clearSkiaRegistry();
    invalidateCommandStreamCache();
  });
  afterEach(() => {
    clearSkiaRegistry();
    invalidateCommandStreamCache();
  });

  it("단일 dirty root commit 을 splice 한다", () => {
    const scene = buildScene();
    const bridge = primeBridge(scene);

    bridge.queueCommitPatch([styleDescriptor(FIRST_ID)], 1);
    const result = bridge.sync(
      scene.elementsMap,
      scene.layoutMap,
      "light",
      scene.childrenMap,
      0,
      false,
      0,
    );

    expect(result.commandStreamPatched).toBe(true);
    expect(result.commandStreamInvalidated).toBe(false);
  });

  it("같은 페이지의 형제 두 개를 한 commit 으로 splice 한다", () => {
    const scene = buildScene();
    const bridge = primeBridge(scene);

    bridge.queueCommitPatch(
      [styleDescriptor(FIRST_ID), styleDescriptor(SECOND_ID)],
      1,
    );
    const result = bridge.sync(
      scene.elementsMap,
      scene.layoutMap,
      "light",
      scene.childrenMap,
      0,
      false,
      0,
    );

    // 두 root 는 rootKey(`page:page-1`)를 공유한다. commit 하나에 revision 하나를
    // 재사용하면 첫 root 가 기록한 값 탓에 둘째 root 가 자기 자신을 stale 로
    // 판정해 commit 전체가 full rebuild 로 떨어진다.
    expect(result.commandStreamPatched).toBe(true);
    expect(result.commandStreamInvalidated).toBe(false);
  });
});
