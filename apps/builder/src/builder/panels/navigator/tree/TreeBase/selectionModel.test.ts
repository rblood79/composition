import { describe, expect, it } from "vitest";
import type { Key } from "react-stately";
import { resolveVirtualizedSelection } from "./selectionModel";

const ORDER: Key[] = ["a", "b", "c", "d", "e"];

const NO_MODIFIERS = { ctrlKey: false, metaKey: false, shiftKey: false };

function run(
  key: Key,
  overrides: {
    anchorKey?: Key | null;
    modifiers?: Partial<typeof NO_MODIFIERS>;
    selected?: Key[];
    selectionBehavior?: "replace" | "toggle";
    selectionMode?: "single" | "multiple" | "none";
  } = {},
) {
  const result = resolveVirtualizedSelection({
    anchorKey: overrides.anchorKey ?? null,
    key,
    modifiers: { ...NO_MODIFIERS, ...overrides.modifiers },
    orderedKeys: ORDER,
    selectedKeys: new Set(overrides.selected ?? []),
    // 레이어 트리가 쓰는 어법이 기본. RAC 기본값(`toggle`)은 별도 케이스로 확인.
    selectionBehavior: overrides.selectionBehavior ?? "replace",
    selectionMode: overrides.selectionMode ?? "multiple",
  });
  return { anchorKey: result.anchorKey, keys: [...result.keys] };
}

/**
 * 가상화 트리는 react-aria Tree 를 쓰지 않고 클릭을 직접 해석한다. 두 경로가
 * 같은 규칙을 따르지 않으면 문서 크기(300 노드)를 넘는 순간 선택 동작이 조용히
 * 바뀐다 — 본 계약은 RAC `selectionBehavior="replace"` 규칙의 미러다.
 */
describe("resolveVirtualizedSelection", () => {
  it("수식어 없는 클릭은 선택을 교체하고 anchor 를 옮긴다", () => {
    expect(run("c", { selected: ["a", "b"], anchorKey: "a" })).toEqual({
      anchorKey: "c",
      keys: ["c"],
    });
  });

  it("single 모드는 수식어를 무시하고 항상 교체한다", () => {
    expect(
      run("c", {
        selected: ["a"],
        anchorKey: "a",
        modifiers: { shiftKey: true },
        selectionMode: "single",
      }),
    ).toEqual({ anchorKey: "c", keys: ["c"] });
  });

  it("meta/ctrl 클릭은 개별 토글이다", () => {
    expect(run("c", { selected: ["a"], modifiers: { metaKey: true } })).toEqual(
      { anchorKey: "c", keys: ["a", "c"] },
    );

    expect(
      run("a", { selected: ["a", "c"], modifiers: { ctrlKey: true } }),
    ).toEqual({ anchorKey: "a", keys: ["c"] });
  });

  it("toggle 로 선택이 비면 빈 집합을 그대로 돌려준다", () => {
    expect(run("a", { selected: ["a"], modifiers: { metaKey: true } })).toEqual(
      {
        anchorKey: "a",
        keys: [],
      },
    );
  });

  it("shift 클릭은 anchor 부터 대상까지의 구간을 선택하고 anchor 를 유지한다", () => {
    expect(
      run("d", {
        selected: ["b"],
        anchorKey: "b",
        modifiers: { shiftKey: true },
      }),
    ).toEqual({ anchorKey: "b", keys: ["b", "c", "d"] });
  });

  it("shift 구간은 역방향에서도 표시 순서를 따른다", () => {
    expect(
      run("b", {
        selected: ["d"],
        anchorKey: "d",
        modifiers: { shiftKey: true },
      }),
    ).toEqual({ anchorKey: "d", keys: ["b", "c", "d"] });
  });

  it("anchor 가 없거나 접혀서 사라졌으면 shift 도 단일 교체로 떨어진다", () => {
    expect(run("c", { modifiers: { shiftKey: true } })).toEqual({
      anchorKey: "c",
      keys: ["c"],
    });

    expect(
      run("c", { anchorKey: "gone", modifiers: { shiftKey: true } }),
    ).toEqual({ anchorKey: "c", keys: ["c"] });
  });

  it("toggle 어법에서는 수식어 없는 클릭도 개별 토글이다", () => {
    expect(run("c", { selected: ["a"], selectionBehavior: "toggle" })).toEqual({
      anchorKey: "c",
      keys: ["a", "c"],
    });
  });

  it("none 모드는 선택과 anchor 를 모두 그대로 둔다", () => {
    expect(
      run("c", { selected: ["a"], anchorKey: "a", selectionMode: "none" }),
    ).toEqual({ anchorKey: "a", keys: ["a"] });
  });
});
