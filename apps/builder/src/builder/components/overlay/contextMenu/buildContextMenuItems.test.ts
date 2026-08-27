import { afterEach, describe, expect, it } from "vitest";
import {
  buildContextMenuItems,
  dropEmptySeparators,
  registerContextMenuProvider,
} from "./buildContextMenuItems";
import type { ContextMenuRequest } from "./types";

const request: ContextMenuRequest = {
  surface: "canvas-element",
  clientX: 10,
  clientY: 20,
  targetElementIds: ["card"],
};

describe("dropEmptySeparators — 빈 구간 구분선 정리 (code-review #10)", () => {
  const sep = (id: string) => ({ kind: "separator", id }) as const;
  const act = (id: string) =>
    ({ kind: "action", id, label: id, run: () => undefined }) as const;

  it("연속 구분선을 하나로 줄인다 (섹션이 통째로 빈 경우)", () => {
    const items = dropEmptySeparators([
      act("copy"),
      sep("selection-separator"),
      sep("component-separator"),
      act("toggle-component-origin"),
    ]);
    expect(items.map((i) => i.id)).toEqual([
      "copy",
      "selection-separator",
      "toggle-component-origin",
    ]);
  });

  it("맨 앞·맨 뒤 구분선을 버린다", () => {
    const items = dropEmptySeparators([
      sep("lead"),
      act("copy"),
      sep("trail"),
    ]);
    expect(items.map((i) => i.id)).toEqual(["copy"]);
  });

  it("항목이 사이에 있으면 구분선을 유지한다", () => {
    const items = dropEmptySeparators([
      act("copy"),
      sep("a"),
      act("group"),
      sep("b"),
      act("delete"),
    ]);
    expect(items.map((i) => i.id)).toEqual([
      "copy",
      "a",
      "group",
      "b",
      "delete",
    ]);
  });
});

describe("buildContextMenuItems", () => {
  const unregisters: Array<() => void> = [];

  afterEach(() => {
    unregisters.splice(0).forEach((unregister) => unregister());
  });

  it("dispatches by surface through the provider registry", () => {
    const items = [
      {
        kind: "action" as const,
        id: "copy",
        label: "Copy",
        run: () => undefined,
      },
    ];
    unregisters.push(
      registerContextMenuProvider("canvas-element", () => items),
    );

    // 조립 지점에서 빈 구분선을 걷어내므로 배열 identity 는 보장하지 않는다
    // (내용 동일) — 2026-08-27 code-review #10
    expect(buildContextMenuItems(request)).toEqual(items);
  });

  it("lets a mode override replace the provider result", () => {
    const providerItems = [
      {
        kind: "action" as const,
        id: "provider",
        label: "Provider",
        run: () => undefined,
      },
    ];
    const overrideItems = [
      {
        kind: "action" as const,
        id: "override",
        label: "Override",
        run: () => undefined,
      },
    ];
    unregisters.push(
      registerContextMenuProvider("canvas-element", () => providerItems),
    );

    expect(
      buildContextMenuItems(request, {
        modeOverride: () => overrideItems,
      }),
    ).toEqual(overrideItems);
  });

  it("returns an empty list before a surface provider is registered", () => {
    expect(
      buildContextMenuItems({ ...request, surface: "canvas-empty" }),
    ).toEqual([]);
  });
});
