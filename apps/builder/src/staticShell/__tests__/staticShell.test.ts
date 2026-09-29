import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STATIC_SHELL_ATTRS,
  STATIC_SHELL_ID,
  STATIC_SHELL_MARKUP,
  releaseStaticShell,
  releaseStaticShellOutsideBuilder,
  renderStaticShellScript,
  staticShellBoot,
} from "../staticShell";

const PREFIX = "/composition/builder/";

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
    staticShellBoot(PREFIX);
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
    staticShellBoot(PREFIX);
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
    staticShellBoot(PREFIX);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "light",
    );
  });

  it("손상 JSON → auto 로 그리고 부팅은 계속 (HC6)", () => {
    const shell = mountShell();
    localStorage.setItem("composition-ui", "{not json");
    staticShellBoot(PREFIX);
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
    staticShellBoot(PREFIX);
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
    staticShellBoot(PREFIX);
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
    staticShellBoot(PREFIX);
    expect(shell.isConnected).toBe(false);
  });

  it("주입 문자열은 모듈 스코프 없이 단독 실행된다 (toString 주입 계약)", () => {
    const shell = mountShell();
    storeUi({ themeMode: "dark" });
    new Function(renderStaticShellScript("/composition/"))();
    expect(shell.hidden).toBe(false);
    expect(document.documentElement.getAttribute("data-builder-theme")).toBe(
      "dark",
    );
  });

  it("dev base '/' 는 /builder/ 경로만 통과", () => {
    window.history.pushState({}, "", "/builder/p1");
    const shell = mountShell();
    new Function(renderStaticShellScript("/"))();
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

describe("ADR-247 정적 셸 — 패널 골격 없음 (2026-09-29 사용자 결정)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/composition/builder/p1");
    stubColorScheme(false);
  });

  afterEach(() => {
    document.getElementById(STATIC_SHELL_ID)?.remove();
    document.documentElement.removeAttribute("data-builder-theme");
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("지난 presented 스냅샷이 남아 있어도 셸 밖에 chrome 골격을 그리지 않는다", () => {
    const shell = mountShell();
    storeUi({ themeMode: "light" });
    localStorage.setItem("composition-panel-layout", '{"version":4}');
    localStorage.setItem(
      "composition-shell-snapshot",
      JSON.stringify({
        v: 1,
        build: "dev",
        vw: window.innerWidth,
        vh: window.innerHeight,
        scale: null,
        theme: "light",
        layout: "",
        boxes: [{ x: 0, y: 0, w: 40, h: 40, bg: "red", bc: "red", bw: 1, r: "0px", sh: "none" }],
      }),
    );
    new Function(renderStaticShellScript("/composition/"))();
    expect(shell.hidden).toBe(false);
    expect(document.body.children).toHaveLength(1);
    expect(shell.querySelector(".header, .panel-dock-stage")).toBeNull();
  });
});
