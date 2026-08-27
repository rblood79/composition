// @vitest-environment jsdom
/**
 * ADR-195 Phase 2 — 팔레트가 registry 를 소비하는 계약.
 *
 * 잠그는 것 셋: (1) scope 별 executable 집합이 정확한가, (2) 실행이 등록된
 * handler 를 정확히 1회 부르는가, (3) 닫힘 뒤에 부르는가. 종전에는 switch 12
 * case 만 실행되고 나머지 59개는 골라도 팔레트만 닫혔다.
 */
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CommandPalette } from "./CommandPalette";
import {
  registerCommand,
  resetCommandRegistry,
} from "../../stores/commandRegistry";
import type { ShortcutScope } from "../../types/keyboard";

const mockScope = vi.hoisted(() => ({
  current: "canvas-focused" as ShortcutScope,
}));

vi.mock("@/builder/hooks", async () => {
  const actual = await vi.importActual<
    typeof import("../../hooks/useKeyboardShortcutsRegistry")
  >("../../hooks/useKeyboardShortcutsRegistry");
  return {
    bindHandlersToDefinitions: actual.bindHandlersToDefinitions,
    formatShortcut: actual.formatShortcut,
    useKeyboardShortcutsRegistry: () => {},
    useActiveScope: () => mockScope.current,
  };
});

vi.mock("../panel/PanelHeader", () => ({
  PanelHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("../ui/ActionIconButton", () => ({
  ActionIconButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock("../ui/SearchField", () => ({
  SearchField: ({
    value,
    onChange,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange: (next: string) => void;
    "aria-label": string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

/**
 * RAC `usePress` 는 pointer 이벤트로 동작하는데 jsdom 에 `PointerEvent` 가 없다.
 * 필요한 필드만 갖춘 최소 구현을 깔고 pointerdown → pointerup → click 순서로
 * 누른다 (RAC 테스트 권장 방식).
 */
class MockPointerEvent extends Event {
  button: number;
  pointerId: number;
  pointerType: string;
  ctrlKey = false;
  metaKey = false;
  shiftKey = false;
  altKey = false;
  width = 1;
  height = 1;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.button = init.button ?? 0;
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

beforeAll(() => {
  // @ts-expect-error jsdom 에는 PointerEvent 가 없다
  window.PointerEvent = MockPointerEvent;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
});

function press(node: HTMLElement): void {
  fireEvent(
    node,
    new MockPointerEvent("pointerdown", { bubbles: true, cancelable: true }),
  );
  fireEvent(
    node,
    new MockPointerEvent("pointerup", { bubbles: true, cancelable: true }),
  );
  fireEvent.click(node);
}

async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function itemFor(label: string): HTMLElement {
  const node = screen.getByText(label).closest(".command-palette-item");
  if (!node) throw new Error(`팔레트 항목을 찾지 못함: ${label}`);
  return node as HTMLElement;
}

beforeEach(() => {
  resetCommandRegistry();
  mockScope.current = "canvas-focused";
});

afterEach(() => {
  cleanup();
});

describe("CommandPalette — registry 소비", () => {
  it("palette:false 정의는 목록에서 빠진다 (62개)", () => {
    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    expect(document.querySelectorAll(".command-palette-item")).toHaveLength(62);
    expect(screen.queryByText("명령 팔레트 열기")).toBeNull();
    expect(screen.queryByText("다음 항목")).toBeNull();
  });

  it("canvas-focused 에서 캔버스 명령은 executable, 패널 명령은 scope 불일치", () => {
    registerCommand({
      id: "duplicate",
      handler: vi.fn(),
      scope: ["canvas-focused", "panel:nodes"],
      priority: 70,
      allowInInput: false,
      disabled: false,
    });
    registerCommand({
      id: "copyStyles",
      handler: vi.fn(),
      scope: "panel:styles",
      priority: 50,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    expect(itemFor("복제").dataset.executable).toBe("true");
    const styles = itemFor("스타일 복사");
    expect(styles.dataset.executable).toBe("false");
    expect(styles.dataset.availability).toBe("scope-mismatch");
    expect(styles.textContent).toContain("스타일 패널에서 실행할 수 있습니다");
  });

  it("panel:styles 로 열면 반대로 갈린다", () => {
    mockScope.current = "panel:styles";
    registerCommand({
      id: "duplicate",
      handler: vi.fn(),
      scope: ["canvas-focused", "panel:nodes"],
      priority: 70,
      allowInInput: false,
      disabled: false,
    });
    registerCommand({
      id: "copyStyles",
      handler: vi.fn(),
      scope: "panel:styles",
      priority: 50,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    expect(itemFor("복제").dataset.executable).toBe("false");
    expect(itemFor("복제").textContent).toContain(
      "캔버스에서 실행할 수 있습니다",
    );
    expect(itemFor("스타일 복사").dataset.executable).toBe("true");
  });

  it("global 명령은 어느 scope 에서 열어도 executable", () => {
    mockScope.current = "panel:styles";
    registerCommand({
      id: "undo",
      handler: vi.fn(),
      scope: "global",
      priority: 100,
      allowInInput: true,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);
    expect(itemFor("실행 취소").dataset.executable).toBe("true");
  });

  it("등록이 없으면 미등록으로 흐려진다", () => {
    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    const item = itemFor("모든 섹션 펼침/접힘");
    expect(item.dataset.executable).toBe("false");
    expect(item.dataset.availability).toBe("unregistered");
    expect(item.textContent).toContain("지금은 실행할 수 없습니다");
  });

  it("실행은 닫힌 뒤 handler 를 정확히 1회 부른다", async () => {
    const handler = vi.fn();
    const onOpenChange = vi.fn();
    registerCommand({
      id: "duplicate",
      handler,
      scope: ["canvas-focused", "panel:nodes"],
      priority: 70,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={onOpenChange} />);

    press(itemFor("복제"));

    // 닫기가 먼저, 실행은 rAF 뒤 (RAC 포커스 복원 이후)
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(handler).not.toHaveBeenCalled();

    await flushFrame();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("실행 불가 항목은 골라도 아무 handler 도 돌지 않는다", async () => {
    const handler = vi.fn();
    registerCommand({
      id: "copyStyles",
      handler,
      scope: "panel:styles",
      priority: 50,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    press(itemFor("스타일 복사"));
    await flushFrame();

    expect(handler).not.toHaveBeenCalled();
  });

  it("중복 id 는 우선순위가 높은 등록이 실행된다", async () => {
    const low = vi.fn();
    const high = vi.fn();
    registerCommand({
      id: "escape",
      handler: low,
      scope: ["canvas-focused", "panel:events", "modal"],
      priority: 70,
      allowInInput: false,
      disabled: false,
    });
    registerCommand({
      id: "escape",
      handler: high,
      scope: ["canvas-focused", "panel:events", "modal"],
      priority: 90,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);

    press(itemFor("선택 해제 / 모달 닫기"));
    await flushFrame();

    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });

  it("footer 는 실행 가능 수 / 전체 를 센다", () => {
    registerCommand({
      id: "duplicate",
      handler: vi.fn(),
      scope: ["canvas-focused", "panel:nodes"],
      priority: 70,
      allowInInput: false,
      disabled: false,
    });

    render(<CommandPalette isOpen onOpenChange={() => {}} />);
    expect(screen.getByText("실행 가능 1 / 62")).toBeTruthy();
  });
});
