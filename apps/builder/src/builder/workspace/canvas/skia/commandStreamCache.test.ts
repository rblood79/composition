import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import {
  getCachedCommandStream,
  invalidateCommandStreamCache,
} from "./renderCommands";

/**
 * ADR-172 Phase 1.5 — `commandChildrenMap` 은 커맨드 스트림 캐시와 **같은 엔트리**에
 * 동봉된다. 그 계약 4가지를 고정한다:
 *
 * 1. miss 프레임에서만 builder 가 호출된다 (blit 프레임은 5중 키가 그대로라 hit)
 * 2. hit 프레임은 **같은 identity** 의 childrenMap 을 돌려준다
 * 3. 5중 키 중 하나라도 바뀌면 builder 가 다시 호출된다 (stale 반환 금지)
 * 4. `invalidateCommandStreamCache()` 는 스트림과 childrenMap 을 **함께** 버린다
 *
 * 별도 캐시 키를 신설하면 두 값의 무효화 시점이 갈려 스트림과 childrenMap 이
 * 서로 다른 세대가 된다 — 그래서 키는 하나다.
 */

const LAYOUT: ComputedLayout = { x: 0, y: 0, width: 100, height: 100 };

function makeNode(id: string): CanvasSceneNode {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
  } as CanvasSceneNode;
}

function registerNode(id: string): void {
  registerSkiaNode(id, {
    elementId: id,
    height: 100,
    type: "container",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
  });
}

interface CallArgs {
  registryVersion: number;
  pagePosVersion: number;
  framePosVersion: number;
  layoutVersion: number;
  rootElementIds: string[];
}

const BASE: CallArgs = {
  registryVersion: 1,
  pagePosVersion: 1,
  framePosVersion: 1,
  layoutVersion: 1,
  rootElementIds: ["root"],
};

describe("ADR-172 Phase 1.5 — commandChildrenMap 캐시 동봉", () => {
  let buildCount = 0;

  const call = (args: Partial<CallArgs> = {}) => {
    const merged = { ...BASE, ...args };
    return getCachedCommandStream(
      merged.rootElementIds,
      () => {
        buildCount += 1;
        return new Map<string, CanvasSceneNode[]>([
          ["root", [makeNode("child-a")]],
        ]);
      },
      new Map<string, ComputedLayout>([
        ["root", LAYOUT],
        ["child-a", LAYOUT],
      ]),
      { "page-1": { x: 0, y: 0 } },
      merged.registryVersion,
      merged.pagePosVersion,
      merged.framePosVersion,
      merged.layoutVersion,
    );
  };

  beforeEach(() => {
    clearSkiaRegistry();
    registerNode("root");
    registerNode("child-a");
    invalidateCommandStreamCache();
    buildCount = 0;
  });

  afterEach(() => {
    invalidateCommandStreamCache();
    clearSkiaRegistry();
  });

  it("miss 프레임에서만 builder 를 호출하고, hit 은 같은 identity 를 돌려준다", () => {
    const first = call();
    expect(buildCount).toBe(1);

    // blit 프레임 모사 — 5중 키가 전부 그대로
    const second = call();
    const third = call();

    expect(buildCount).toBe(1);
    expect(second.childrenMap).toBe(first.childrenMap);
    expect(third.childrenMap).toBe(first.childrenMap);
    expect(second.stream).toBe(first.stream);
  });

  it.each([
    ["registryVersion", { registryVersion: 2 }],
    ["pagePosVersion", { pagePosVersion: 2 }],
    ["framePosVersion", { framePosVersion: 2 }],
    ["layoutVersion", { layoutVersion: 2 }],
    ["rootSignature", { rootElementIds: ["root", "root-2"] }],
  ] as Array<[string, Partial<CallArgs>]>)(
    "%s 가 바뀌면 builder 를 다시 호출한다 (stale 반환 금지)",
    (_label, changed) => {
      const first = call();
      expect(buildCount).toBe(1);

      const next = call(changed);

      expect(buildCount).toBe(2);
      expect(next.childrenMap).not.toBe(first.childrenMap);
    },
  );

  it("invalidateCommandStreamCache() 는 스트림과 childrenMap 을 함께 버린다", () => {
    const first = call();
    expect(buildCount).toBe(1);

    invalidateCommandStreamCache();
    const afterInvalidate = call();

    expect(buildCount).toBe(2);
    expect(afterInvalidate.childrenMap).not.toBe(first.childrenMap);
    expect(afterInvalidate.stream).not.toBe(first.stream);
  });
});
