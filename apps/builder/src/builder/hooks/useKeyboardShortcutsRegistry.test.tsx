// @vitest-environment jsdom
/**
 * ADR-195 Phase 1 — 등록 hook 이 listener 를 붙이면서 registry 에 **추가로**
 * 게시하는지, 그리고 keydown 경로가 종전 그대로인지 (HC1) 를 잠근다.
 *
 * 손수 선언 등록(정의 없는 Space·Escape·⌘C/⌘V)은 id 가 없어 게시되지 않아야
 * 한다 — 팔레트에 올릴 수 없는 항목들이다.
 */
import { renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
  type KeyboardShortcut,
} from "./useKeyboardShortcutsRegistry";
import {
  getCommandRegistrySnapshot,
  resetCommandRegistry,
  resolveCommand,
} from "../stores/commandRegistry";

/**
 * `matchesShortcut` 의 `cmd` 분기는 `navigator.platform` 으로 Mac 여부를 가른다 —
 * jsdom 기본값(`""`)에서는 ⌘ 가 Ctrl 로 해석되므로 실물 macOS 형태로 고정한다.
 */
beforeAll(() => {
  Object.defineProperty(navigator, "platform", {
    value: "MacIntel",
    configurable: true,
  });
});

beforeEach(() => {
  resetCommandRegistry();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useKeyboardShortcutsRegistry — command registry 게시", () => {
  it("정의 경유 등록은 게시되고, 언마운트하면 해제된다", () => {
    const duplicate = vi.fn();
    const shortcuts = bindHandlersToDefinitions(["duplicate", "selectAll"], {
      duplicate,
      selectAll: vi.fn(),
    });

    const view = renderHook(() =>
      useKeyboardShortcutsRegistry(shortcuts, [shortcuts]),
    );

    const entry = resolveCommand("duplicate");
    expect(entry).toBeDefined();
    expect(entry?.scope).toEqual(["canvas-focused", "panel:nodes"]);
    expect(resolveCommand("selectAll")).toBeDefined();

    view.unmount();
    expect(resolveCommand("duplicate")).toBeUndefined();
    expect(getCommandRegistrySnapshot().size).toBe(0);
  });

  it("게시된 handler 가 등록된 핸들러 그대로다", () => {
    const duplicate = vi.fn();
    const shortcuts = bindHandlersToDefinitions(["duplicate"], { duplicate });
    renderHook(() => useKeyboardShortcutsRegistry(shortcuts, [shortcuts]));

    resolveCommand("duplicate")?.handler();
    expect(duplicate).toHaveBeenCalledTimes(1);
  });

  it("id 없는 손수 선언 등록은 게시되지 않는다", () => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: "c",
        modifier: "cmd",
        handler: vi.fn(),
        description: "Copy All Elements",
        scope: "panel:properties",
      },
    ];
    renderHook(() => useKeyboardShortcutsRegistry(shortcuts, [shortcuts]));

    expect(getCommandRegistrySnapshot().size).toBe(0);
  });

  it("keyup 등록(Space pan)은 게시 대상이 아니다", () => {
    const shortcuts = bindHandlersToDefinitions(["duplicate"], {
      duplicate: vi.fn(),
    });
    renderHook(() =>
      useKeyboardShortcutsRegistry(shortcuts, [shortcuts], {
        eventType: "keyup",
      }),
    );

    expect(getCommandRegistrySnapshot().size).toBe(0);
  });

  it("deps 재실행 시 해제→재등록으로 stale 핸들러가 남지 않는다", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const build = (handler: () => void) =>
      bindHandlersToDefinitions(["duplicate"], { duplicate: handler });

    const view = renderHook(
      ({ handler }: { handler: () => void }) => {
        const shortcuts = build(handler);
        useKeyboardShortcutsRegistry(shortcuts, [handler]);
      },
      { initialProps: { handler: stale } },
    );

    view.rerender({ handler: fresh });

    expect(getCommandRegistrySnapshot().get("duplicate")).toHaveLength(1);
    resolveCommand("duplicate")?.handler();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });

  it("keydown 경로는 종전대로 동작한다 (HC1)", () => {
    const duplicate = vi.fn();
    const shortcuts = bindHandlersToDefinitions(["duplicate"], { duplicate });
    renderHook(() =>
      useKeyboardShortcutsRegistry(shortcuts, [shortcuts], {
        activeScope: "canvas-focused",
      }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "d",
      code: "KeyD",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("scope 불일치면 keydown 은 무시되지만 게시는 유지된다", () => {
    const duplicate = vi.fn();
    const shortcuts = bindHandlersToDefinitions(["duplicate"], { duplicate });
    renderHook(() =>
      useKeyboardShortcutsRegistry(shortcuts, [shortcuts], {
        activeScope: "panel:styles",
      }),
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        code: "KeyD",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(duplicate).not.toHaveBeenCalled();
    expect(resolveCommand("duplicate")).toBeDefined();
  });
});
