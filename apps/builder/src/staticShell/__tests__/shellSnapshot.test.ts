import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleShellSnapshotWrite } from "../scheduleShellSnapshotWrite";
import {
  SHELL_SNAPSHOT_MAX_BYTES,
  captureShellSnapshot,
  writeShellSnapshot,
} from "../shellSnapshot";
import {
  PANEL_LAYOUT_STORAGE_KEY,
  SHELL_BUILD_META,
  SHELL_SNAPSHOT_KEY,
  STATIC_SHELL_ATTRS,
  STATIC_SHELL_MARKUP,
  STATIC_SHELL_SKELETON_ID,
  hashShellLayout,
  staticShellBoot,
} from "../staticShell";

function rectOf(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountPresentedApp(booting = false) {
  const root = document.createElement("div");
  root.id = "root";
  root.innerHTML =
    `<div class="app${booting ? " builder-booting" : ""}">` +
    '<header class="header"></header>' +
    '<div class="panel-dock-stage"><div class="rail-wrap">' +
    '<div class="workspace-panel-frame" data-panel="layers"><button class="inner"></button></div>' +
    '<div class="workspace-panel-frame" data-panel="hidden-one"></div>' +
    "</div></div>" +
    '<div class="workspace-panel-frame" data-panel="outside-roots"></div>' +
    "</div>";
  document.body.appendChild(root);
  // 칠해지지 않은 wrapper (stage · rail-wrap) 도 크기가 있어야 안으로 내려간다.
  // (prototype 을 spy 하면 instance spyOn 이 같은 mock 을 돌려받는다 — 요소마다 따로 건다.)
  for (const wrapper of root.querySelectorAll<HTMLElement>(
    ".panel-dock-stage, .rail-wrap, .inner",
  )) {
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(
      rectOf(0, 0, 100, 100),
    );
  }
  const [header, frame, hidden, outside] = Array.from(
    root.querySelectorAll<HTMLElement>(".header, .workspace-panel-frame"),
  );
  // 칠해진 frame 안의 버튼 · 루트 밖 frame 은 옮기지 않는다.
  root.querySelector<HTMLElement>(".inner")!.style.backgroundColor =
    "rgb(200, 0, 0)";
  outside.style.backgroundColor = "rgb(0, 200, 0)";
  vi.spyOn(outside, "getBoundingClientRect").mockReturnValue(
    rectOf(500, 500, 100, 100),
  );
  header.style.backgroundColor = "rgb(10, 20, 30)";
  frame.style.backgroundColor = "rgb(40, 50, 60)";
  frame.style.borderTop = "1px solid rgb(70, 80, 90)";
  frame.style.borderRadius = "12px";
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue(
    rectOf(0, 0, 1024, 48),
  );
  vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(
    rectOf(8, 56.333, 280, 600),
  );
  vi.spyOn(hidden, "getBoundingClientRect").mockReturnValue(rectOf(0, 0, 0, 0));
  return root;
}

describe("ADR-247 Phase 2 — 스냅샷 기록기", () => {
  beforeEach(() => {
    const meta = document.createElement("meta");
    meta.name = SHELL_BUILD_META;
    meta.content = "b1";
    document.head.appendChild(meta);
    document.documentElement.setAttribute("data-builder-theme", "dark");
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, '{"v":4}');
    localStorage.setItem(
      "composition-ui",
      JSON.stringify({ state: { themeMode: "dark", uiScale: 120 } }),
    );
  });

  afterEach(() => {
    document.getElementById("root")?.remove();
    document.getElementById(STATIC_SHELL_SKELETON_ID)?.remove();
    document.getElementById(STATIC_SHELL_ATTRS.id)?.remove();
    document.head.querySelector(`meta[name="${SHELL_BUILD_META}"]`)?.remove();
    document.documentElement.removeAttribute("data-builder-theme");
    document.documentElement.style.removeProperty("--ui-scale");
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("presented chrome 의 사각형 · computed 색을 읽고 크기 0 인 frame 은 건너뛴다", () => {
    mountPresentedApp();
    const snap = captureShellSnapshot();
    expect(snap).toMatchObject({
      v: 1,
      build: "b1",
      theme: "dark",
      scale: 120,
      layout: hashShellLayout('{"v":4}'),
      vw: window.innerWidth,
      vh: window.innerHeight,
    });
    expect(snap!.boxes).toEqual([
      {
        x: 0,
        y: 0,
        w: 1024,
        h: 48,
        bg: "rgb(10, 20, 30)",
        bc: expect.any(String),
        bw: 0,
        r: expect.any(String),
        sh: expect.any(String),
      },
      {
        x: 8,
        y: 56.33,
        w: 280,
        h: 600,
        bg: "rgb(40, 50, 60)",
        bc: "rgb(70, 80, 90)",
        bw: 1,
        r: "12px",
        sh: expect.any(String),
      },
    ]);
  });

  it("부팅 중 (builder-booting) 이거나 빌드 id 가 없으면 기록하지 않는다", () => {
    mountPresentedApp(true);
    expect(captureShellSnapshot()).toBeNull();
    document.getElementById("root")?.remove();
    mountPresentedApp();
    document.head.querySelector(`meta[name="${SHELL_BUILD_META}"]`)?.remove();
    expect(captureShellSnapshot()).toBeNull();
  });

  it("못 읽으면 지난 스냅샷을 지운다 — 틀린 골격이 남지 않는다", () => {
    localStorage.setItem(SHELL_SNAPSHOT_KEY, "stale");
    writeShellSnapshot();
    expect(localStorage.getItem(SHELL_SNAPSHOT_KEY)).toBeNull();
  });

  it(`상한 ${SHELL_SNAPSHOT_MAX_BYTES} B 를 넘으면 쓰지 않는다`, () => {
    const root = mountPresentedApp();
    const app = root.querySelector(".panel-dock-stage")!;
    for (let i = 0; i < 200; i++) {
      const extra = document.createElement("div");
      extra.className = "workspace-panel-frame";
      extra.style.backgroundColor = "rgb(1, 2, 3)";
      extra.style.boxShadow = Array.from(
        { length: 6 },
        () => "rgba(0, 0, 0, 0.1) 0px 2px 8px 0px",
      ).join(", ");
      vi.spyOn(extra, "getBoundingClientRect").mockReturnValue(
        rectOf(i, i, 10, 10),
      );
      app.appendChild(extra);
    }
    writeShellSnapshot();
    expect(localStorage.getItem(SHELL_SNAPSHOT_KEY)).toBeNull();
  });

  it("presented 뒤 idle 에 한 번 기록하고, 취소하면 기록하지 않는다", async () => {
    mountPresentedApp();
    const callbacks: Array<() => void> = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: () => void) => callbacks.push(cb)),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    scheduleShellSnapshotWrite();
    expect(localStorage.getItem(SHELL_SNAPSHOT_KEY)).toBeNull();
    callbacks.splice(0).forEach((cb) => cb());
    await vi.waitFor(() =>
      expect(localStorage.getItem(SHELL_SNAPSHOT_KEY)).not.toBeNull(),
    );

    localStorage.removeItem(SHELL_SNAPSHOT_KEY);
    const cancel = scheduleShellSnapshotWrite();
    const pending = callbacks.splice(0);
    cancel();
    pending.forEach((cb) => cb());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(localStorage.getItem(SHELL_SNAPSHOT_KEY)).toBeNull();
  });

  it("기록 → 다음 진입의 인라인 판정이 같은 사각형으로 골격을 그린다 (왕복)", () => {
    mountPresentedApp();
    writeShellSnapshot();
    document.getElementById("root")?.remove();
    document.documentElement.removeAttribute("data-builder-theme");

    window.history.pushState({}, "", "/composition/builder/p1");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const shell = document.createElement("div");
    shell.id = STATIC_SHELL_ATTRS.id;
    shell.hidden = true;
    shell.innerHTML = STATIC_SHELL_MARKUP;
    document.body.prepend(shell);
    staticShellBoot("/composition/builder/", "b1", hashShellLayout);
    const boxes = Array.from(
      document.getElementById(STATIC_SHELL_SKELETON_ID)?.children ?? [],
    ) as HTMLElement[];
    expect(
      boxes.map((b) => [
        b.style.left,
        b.style.top,
        b.style.width,
        b.style.height,
      ]),
    ).toEqual([
      ["0px", "0px", "1024px", "48px"],
      ["8px", "56.33px", "280px", "600px"],
    ]);
  });
});
