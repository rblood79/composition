/**
 * VirtualizedTree 키보드 탐색 회귀 테스트.
 *
 * 원래 이 컴포넌트는 `role="tree"` 를 선언하면서 onKeyDown 이 없었다 —
 * 화살표로 행을 옮길 수 없고, `focusedKey` 가 null 이면 `tabIndex` 가 전부
 * -1 이라 Tab 으로 진입조차 못 했다. 아래 케이스가 그 두 결함을 잠근다.
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { Key } from "react-stately";
import { VirtualizedTree } from "./VirtualizedTree";
import type { BaseTreeNode } from "./types";

interface Node extends BaseTreeNode {
  label: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    id: "a",
    parentId: null,
    depth: 0,
    hasChildren: true,
    label: "A",
    children: [
      { id: "a1", parentId: "a", depth: 1, hasChildren: false, label: "A1" },
      { id: "a2", parentId: "a", depth: 1, hasChildren: false, label: "A2" },
    ],
  },
  { id: "b", parentId: null, depth: 0, hasChildren: false, label: "B" },
];

// jsdom 은 레이아웃도 ResizeObserver 도 없어 virtualizer 가 0개를 그린다 —
// 스크롤 컨테이너 크기와 관찰자·scrollTo 를 채워 준다.
beforeAll(() => {
  // observe 즉시 크기를 통보해야 virtualizer 가 범위를 계산한다.
  globalThis.ResizeObserver ??= class {
    constructor(private cb: ResizeObserverCallback) {}
    observe(target: Element) {
      this.cb(
        [
          {
            target,
            contentRect: target.getBoundingClientRect(),
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollTo ??= function scrollTo() {};
  // virtual-core 는 offsetWidth/offsetHeight 로 스크롤 컨테이너를 잰다.
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 240,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width: 240,
      height: 400,
      top: 0,
      left: 0,
      right: 240,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
});

function renderTree(
  overrides: {
    expandedKeys?: Set<Key>;
    selectedKeys?: Set<Key>;
    onSelectionChange?: (keys: Set<Key>) => void;
    onExpandedChange?: (keys: Set<Key>) => void;
  } = {},
) {
  return render(
    <VirtualizedTree<Node>
      items={TREE}
      getKey={(n) => n.id}
      getTextValue={(n) => n.label}
      renderContent={(n) => <span>{n.label}</span>}
      selectedKeys={overrides.selectedKeys ?? new Set()}
      expandedKeys={overrides.expandedKeys ?? new Set()}
      onSelectionChange={overrides.onSelectionChange}
      onExpandedChange={overrides.onExpandedChange}
      aria-label="Test tree"
    />,
  );
}

// setupFiles 가 없어 RTL 자동 cleanup 이 안 걸린다 — 직접 건다.
afterEach(cleanup);

const tree = () => screen.getByRole("tree");
const item = (label: string) =>
  screen.getByRole("treeitem", { name: label }) as HTMLElement;

describe("VirtualizedTree 키보드 탐색", () => {
  it("focusedKey 가 없어도 첫 행이 Tab 대상이다 (roving tabindex)", () => {
    renderTree();
    expect(item("A").tabIndex).toBe(0);
    expect(item("B").tabIndex).toBe(-1);
  });

  it("ArrowDown 이 다음 행으로 tabindex 와 DOM 포커스를 옮긴다", () => {
    renderTree();
    fireEvent.keyDown(tree(), { key: "ArrowDown" });
    expect(item("B").tabIndex).toBe(0);
    expect(item("A").tabIndex).toBe(-1);
    expect(document.activeElement).toBe(item("B"));
  });

  it("ArrowUp 이 이전 행으로 돌아간다", () => {
    renderTree();
    fireEvent.keyDown(tree(), { key: "ArrowDown" });
    fireEvent.keyDown(tree(), { key: "ArrowUp" });
    expect(item("A").tabIndex).toBe(0);
  });

  it("ArrowRight 가 접힌 노드를 펼친다", () => {
    const onExpandedChange = vi.fn();
    renderTree({ onExpandedChange });
    fireEvent.keyDown(tree(), { key: "ArrowRight" });
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(["a"]));
  });

  it("ArrowLeft 가 펼쳐진 노드를 접는다", () => {
    const onExpandedChange = vi.fn();
    renderTree({ expandedKeys: new Set(["a"]), onExpandedChange });
    fireEvent.keyDown(tree(), { key: "ArrowLeft" });
    expect(onExpandedChange).toHaveBeenCalledWith(new Set());
  });

  it("ArrowLeft 가 자식 행에서 부모로 올라간다", () => {
    renderTree({ expandedKeys: new Set(["a"]) });
    fireEvent.keyDown(tree(), { key: "ArrowDown" }); // A1
    expect(item("A1").tabIndex).toBe(0);
    fireEvent.keyDown(tree(), { key: "ArrowLeft" });
    expect(item("A").tabIndex).toBe(0);
  });

  it("Home / End 가 처음·마지막 행으로 간다", () => {
    renderTree({ expandedKeys: new Set(["a"]) });
    fireEvent.keyDown(tree(), { key: "End" });
    expect(item("B").tabIndex).toBe(0);
    fireEvent.keyDown(tree(), { key: "Home" });
    expect(item("A").tabIndex).toBe(0);
  });

  it("Enter 가 활성 행을 선택한다 (클릭과 같은 규칙)", () => {
    const onSelectionChange = vi.fn();
    renderTree({ onSelectionChange });
    fireEvent.keyDown(tree(), { key: "ArrowDown" });
    fireEvent.keyDown(tree(), { key: "Enter" });
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["b"]));
  });

  it("Space 도 선택한다", () => {
    const onSelectionChange = vi.fn();
    renderTree({ onSelectionChange });
    fireEvent.keyDown(tree(), { key: " " });
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["a"]));
  });
});
