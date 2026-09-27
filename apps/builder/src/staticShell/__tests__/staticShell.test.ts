import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PANEL_LAYOUT_STORAGE_KEY,
  SHELL_SNAPSHOT_KEY,
  STATIC_SHELL_ATTRS,
  STATIC_SHELL_SKELETON_ID,
  STATIC_SHELL_ID,
  STATIC_SHELL_MARKUP,
  hashShellLayout,
  releaseStaticShell,
  releaseStaticShellOutsideBuilder,
  releaseStaticShellSkeleton,
  renderStaticShellScript,
  staticShellBoot,
} from "../staticShell";

const PREFIX = "/composition/builder/";
const BUILD = "b1";

function mountShell(): HTMLElement {
  const shell = document.createElement("div");
  shell.id = STATIC_SHELL_ATTRS.id;
  shell.hidden = STATIC_SHELL_ATTRS.hidden;
  shell.innerHTML = STATIC_SHELL_MARKUP;
  document.body.prepend(shell);
  return shell;
}

function stubColorScheme(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark && query === "(prefers-color-scheme: dark)",
    })),
  );
}

function storeUi(state: Record<string, unknown>) {
  localStorage.setItem("composition-ui", JSON.stringify({ state, version: 0 }));
}

describe("ADR-247 정적 셸 — 인라인 boot", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/composition/builder/p1");
    stubColorScheme(false);
  });

  afterEach(() => {
    document.getElementById(STATIC_SHELL_ID)?.remove();
    document.documentElement.removeAttribute("data-builder-theme");
    document.documentElement.style.removeProperty("--ui-scale");
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builder 경로 · 저장값 dark → 테마 속성 dark · 셸 표시", () => {
    const shell = mountShell();
    storeUi({ themeMode: "dark", uiScale: 120 });
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "120",
    );
  });

  it("저장값 없음 (첫 방문) → auto: prefers-color-scheme 를 따른다", () => {
    stubColorScheme(true);
    const shell = mountShell();
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "",
    );
  });

  it("명시 light 는 시스템 dark 보다 우선", () => {
    stubColorScheme(true);
    mountShell();
    storeUi({ themeMode: "light" });
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "light",
    );
  });

  it("손상 JSON → auto 로 그리고 부팅은 계속 (HC6)", () => {
    const shell = mountShell();
    localStorage.setItem("composition-ui", "{not json");
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "light",
    );
  });

  it("localStorage 가 예외를 던져도 (WebKit 사생활 모드) auto 로 그린다 (HC6)", () => {
    const shell = mountShell();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "light",
    );
  });

  it.each([
    "/composition/dashboard",
    "/composition/signin",
    "/composition/publish/x",
    "/composition/",
  ])("builder 가 아닌 경로 %s → 셸 제거 · 테마 속성 없음 (HC3)", (path) => {
    window.history.pushState({}, "", path);
    mountShell();
    storeUi({ themeMode: "dark" });
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(document.getElementById(STATIC_SHELL_ID)).toBeNull();
    expect(document.documentElement.hasAttribute("data-builder-theme")).toBe(
      false,
    );
  });

  it("예상 밖 예외 → 셸을 치우고 조용히 끝난다", () => {
    const shell = mountShell();
    vi.stubGlobal("matchMedia", () => {
      throw new Error("boom");
    });
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(shell.isConnected).toBe(false);
  });

  it("주입 문자열은 모듈 스코프 없이 단독 실행된다 (toString 주입 계약)", () => {
    const shell = mountShell();
    storeUi({ themeMode: "dark" });
    new Function(renderStaticShellScript("/composition/", BUILD))();
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
  });

  it("dev base '/' 는 /builder/ 경로만 통과", () => {
    window.history.pushState({}, "", "/builder/p1");
    const shell = mountShell();
    new Function(renderStaticShellScript("/", BUILD))();
    expect(shell.hidden).toBe(false);
  });
});

describe("ADR-247 정적 셸 — 이어받기", () => {
  afterEach(() => {
    document.getElementById(STATIC_SHELL_ID)?.remove();
    document.documentElement.removeAttribute("data-builder-theme");
  });

  it("releaseStaticShell 은 셸만 지우고 테마 속성은 BuilderCore 에 남긴다", () => {
    mountShell();
    document.documentElement.setAttribute("data-builder-theme", "dark");
    releaseStaticShell();
    expect(document.getElementById(STATIC_SHELL_ID)).toBeNull();
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
  });

  it("builder 밖 commit 에 셸이 남아 있으면 셸과 셸이 붙인 테마 속성을 지운다", () => {
    mountShell();
    document.documentElement.setAttribute("data-builder-theme", "dark");
    releaseStaticShellOutsideBuilder();
    expect(document.getElementById(STATIC_SHELL_ID)).toBeNull();
    expect(document.documentElement.hasAttribute("data-builder-theme")).toBe(
      false,
    );
  });

  it("셸이 이미 이어받아졌으면 builder 밖 정리는 테마 속성을 건드리지 않는다", () => {
    document.documentElement.setAttribute("data-builder-theme", "dark");
    releaseStaticShellOutsideBuilder();
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
  });
});

describe("ADR-247 정적 셸 — 패널 골격 일치 판정", () => {
  const LAYOUT = '{"version":4,"frames":[1,2]}';
  const snapshot = (over: Record<string, unknown> = {}) => ({
    v: 1,
    build: BUILD,
    vw: window.innerWidth,
    vh: window.innerHeight,
    scale: null,
    theme: "dark",
    layout: hashShellLayout(LAYOUT),
    boxes: [
      { x: 0, y: 0, w: 1024, h: 48, bg: "rgb(1, 2, 3)", bc: "rgb(4, 5, 6)", bw: 1, r: "0px", sh: "none" },
      { x: 8, y: 56, w: 280, h: 600, bg: "rgb(7, 8, 9)", bc: "rgb(4, 5, 6)", bw: 1, r: "12px", sh: "none" },
    ],
    ...over,
  });
  const store = (over?: Record<string, unknown>) => {
    storeUi({ themeMode: "dark" });
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, LAYOUT);
    localStorage.setItem(SHELL_SNAPSHOT_KEY, JSON.stringify(snapshot(over)));
  };
  const skeleton = () => document.getElementById(STATIC_SHELL_SKELETON_ID);

  beforeEach(() => {
    window.history.pushState({}, "", "/composition/builder/p1");
    stubColorScheme(false);
  });

  afterEach(() => {
    skeleton()?.remove();
    document.getElementById(STATIC_SHELL_ID)?.remove();
    document.documentElement.removeAttribute("data-builder-theme");
    document.documentElement.style.removeProperty("--ui-scale");
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("모든 키가 같으면 저장된 사각형 · 색으로 골격을 그린다", () => {
    mountShell();
    store();
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    const layer = skeleton();
    expect(layer).not.toBeNull();
    const boxes = Array.from(layer!.children) as HTMLElement[];
    expect(boxes).toHaveLength(2);
    expect(boxes[1].style.left).toBe("8px");
    expect(boxes[1].style.top).toBe("56px");
    expect(boxes[1].style.width).toBe("280px");
    expect(boxes[1].style.borderRadius).toBe("12px");
    expect(boxes[1].style.backgroundColor).toBe("rgb(7, 8, 9)");
    expect(layer!.style.pointerEvents).toBe("none");
  });

  it.each([
    ["빌드 id (배포 직후)", { build: "old" }],
    ["viewport 폭", { vw: 1 }],
    ["viewport 높이", { vh: 1 }],
    ["테마", { theme: "light" }],
    ["UI 배율", { scale: 120 }],
    ["패널 배치 (변경 직후)", { layout: hashShellLayout("{}") }],
    ["형식 버전", { v: 2 }],
  ])("%s 가 다르면 골격 없이 최소 셸 (R1)", (_label, over) => {
    const shell = mountShell();
    store(over);
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(skeleton()).toBeNull();
    expect(shell.hidden).toBe(false);
  });

  it("손상 스냅샷 → 최소 셸 · 부팅 계속 (HC6)", () => {
    const shell = mountShell();
    store();
    localStorage.setItem(SHELL_SNAPSHOT_KEY, "{broken");
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    expect(skeleton()).toBeNull();
    expect(shell.hidden).toBe(false);
  });

  it("주입 문자열도 같은 해시 함수로 판정한다", () => {
    mountShell();
    store();
    new Function(renderStaticShellScript("/composition/", BUILD))();
    expect(skeleton()?.children).toHaveLength(2);
  });

  it("presented 교체는 골격만, builder 밖 정리는 셸 · 골격 둘 다", () => {
    mountShell();
    store();
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    releaseStaticShell();
    expect(skeleton()).not.toBeNull();
    releaseStaticShellSkeleton();
    expect(skeleton()).toBeNull();

    mountShell();
    staticShellBoot(PREFIX, BUILD, hashShellLayout);
    releaseStaticShellOutsideBuilder();
    expect(skeleton()).toBeNull();
    expect(document.getElementById(STATIC_SHELL_ID)).toBeNull();
  });
});
