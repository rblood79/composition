import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Chrome island 정본 게이트 (2026-08-30).
 *
 * 캔버스 위에 떠 있는 빌더 chrome 표면 5종 — 좌/우 panel toggle rail · header
 * viewport controls · header action group · contextual action bar · workspace
 * panel frame — 은 같은 디자인 요소로 읽혀야 한다. 이전에는 다섯이 각자 값을 써서
 * 표면색 3종(--bg-raised / --bg-muted / --bg-overlay) · 테두리 3종(없음 / --border /
 * --border-pressed + placed outline 이중 링) · padding 하드코드가 섞였다.
 *
 * 이 테스트는 값이 아니라 **소비 경로**를 고정한다: 다섯 표면은 정본 토큰
 * (`builder-system.css` §Chrome island) 만 읽고, 원시 표면/그림자 토큰을 직접
 * 쓰지 않는다. 값 조정은 토큰 블록 한 곳에서 한다.
 */
const FLOATING_POPOVER_SHEETS = [
  ["./layout/header.css", "header-menu-popover"],
  ["./layout/header.css", "zoom-menu-popover"],
  ["../components/overlay/contextMenu/contextMenu.css", "context-menu-popover"],
  [
    "../components/overlay/actionBar/actionBar.css",
    "contextual-action-bar-options-popover",
  ],
  [
    "../components/overlay/actionBar/actionBar.css",
    "contextual-action-bar-align-popover",
  ],
  ["../panels/history/HistoryPanel.css", "history-menu-popover"],
  ["../panels/icons/IconPickerPopover.css", "icon-picker-popover"],
] as const;
const FLOATING_POPOVERS = FLOATING_POPOVER_SHEETS.map(([, s]) => s);

describe("chrome island", () => {
  const cache = new Map<string, Promise<string>>();
  const read = (rel: string) => {
    let css = cache.get(rel);
    if (!css)
      cache.set(rel, (css = readFile(resolve(__dirname, rel), "utf-8")));
    return css;
  };

  // chrome focus offset 이 사용자 문서로 번지지 않는 것은 문서 경계가 막는다 (ADR-305 —
  // `chromeWidgetSheets.static.test.ts`: 빌더 chrome 시트는 Preview · Publish 진입이 싣지 않는다).

  it("정본 토큰이 builder 스코프에 선언돼 있다", async () => {
    const tokens = await read(
      "../../../../../packages/shared/src/components/styles/theme/builder-system.css",
    );

    for (const decl of [
      // light = 가장 밝은 단 (Hub elevated) · dark = --bg-raised
      "--chrome-surface: var(--color-white);",
      "--chrome-surface: var(--bg-raised);",
      // 모서리 단 = Hub rounding (medium 8 · large 10 · Dialog 16)
      "--radius-md: 0.5rem;",
      "--radius-lg: 0.625rem;",
      "--chrome-radius-dialog: var(--radius-2xl);",
      // 팝오버 = 항목 모서리 + 목록 여백 (식으로 — 한쪽을 바꾸면 따라온다)
      "--chrome-radius-popover: calc(var(--radius-md) + var(--chrome-padding));",
      "--chrome-radius-toolbar: calc(var(--radius-md) + var(--chrome-padding));",
      // 캔버스 선택 색은 focus 표시와 다른 역할
      "--canvas-selection: var(--color-blue-400);",
      "--chrome-border: 0;",
      "--chrome-radius: var(--radius-lg);",
      "--chrome-padding: var(--spacing-xs);",
      "--chrome-gap: var(--spacing-xs);",
      "--chrome-shadow: var(--shadow-md);",
      // dark: 떠 있는 표면에 테두리 선 (Hub drop shadow — dark theme). 크기가 바뀌지 않게 그림자 고리.
      "--chrome-shadow: 0 0 0 1px var(--border), var(--shadow-md);",
      // 캔버스 바깥 = Hub pasteboard — dark 는 가장 어두운 단
      "--bg-pasteboard: var(--color-neutral-200);",
      "--bg-pasteboard: var(--color-zinc-950);",
    ]) {
      expect(tokens).toContain(decl);
    }
    // 고도는 하나다 (Hub elevated). 가장 진한 단은 끌고 있는 대상의 것 — 놓여 있는 표면용 이름을 두지 않는다.
    expect(tokens).not.toContain("--chrome-shadow-floating");
  });

  // Spectrum Hub background layers (2026-11-10): editing context 에서 canvas 위에 뜨는 toolbar · panel ·
  // popover 는 전부 elevated 한 층이다. 팝오버 · 메뉴 · Toast · tooltip · Dialog 가 island 와 다른 표면색 ·
  // 그림자를 쓰면 (종전: 팝오버 --shadow-lg · Dialog 는 직접 쓴 `0 18px 54px` · `--bg-overlay`) 같은 층이
  // 자리마다 다른 높이로 읽힌다.
  it("떠 있는 표면 (팝오버 · 메뉴 · Toast · tooltip · Dialog) 이 chrome 토큰을 읽는다", async () => {
    const sheets = await Promise.all(
      [
        "./widgets/Popover.css",
        "./layout/header.css",
        "../components/overlay/contextMenu/contextMenu.css",
        "../components/overlay/actionBar/actionBar.css",
        "../components/overlay/CommandPalette.css",
        "../components/overlay/ConfirmDialog.css",
        "../components/overlay/AgentCommandConfirmDialog.css",
        "../components/overlay/EditingSemanticsImpactDialog.css",
        "../components/feedback/Toast.css",
        "../components/ui/ActionTooltip.css",
        "../components/property/PropertyInput.css",
        "../panels/history/HistoryPanel.css",
        "../panels/icons/IconPickerPopover.css",
        "../panels/fonts/FontManager.css",
        "../../auth/index.css",
      ].map(async (rel) => [rel, await read(rel)] as const),
    );
    for (const [rel, css] of sheets) {
      expect(css, rel).not.toMatch(/box-shadow: var\(--shadow-(sm|lg)\)/);
      expect(css, rel).not.toMatch(/box-shadow: 0 \d+px \d+px rgba/);
    }
    const byRel = Object.fromEntries(sheets);
    expect(byRel["./widgets/Popover.css"]).toMatch(
      /border: var\(--chrome-border\);\s*background: var\(--chrome-surface\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
    // RAC 기본 class 를 바꾼 팝오버의 껍데기는 모듈 한 곳 (`builder-floating-surface.css`)
    const floating = await read("./modules/builder-floating-surface.css");
    expect(await read("./index.css")).toContain(
      `@import "./modules/builder-floating-surface.css";`,
    );
    for (const selector of FLOATING_POPOVERS)
      expect(floating, selector).toContain(`.${selector}`);
    expect(floating).toMatch(
      /\{\s*background: var\(--chrome-surface\);\s*border: var\(--chrome-border\);\s*border-radius: var\(--chrome-radius-popover\);\s*box-shadow: var\(--chrome-shadow\);\s*\}/,
    );
    // 각자 시트는 껍데기를 다시 적지 않는다 (값이 두 곳에서 갈리지 않게)
    for (const [rel, selector] of FLOATING_POPOVER_SHEETS)
      expect(await read(rel), selector).not.toMatch(
        new RegExp(
          `\\.${selector}\\s*\\{[^}]*?(background|box-shadow|border-radius):`,
        ),
      );
    expect(byRel["../components/overlay/CommandPalette.css"]).toMatch(
      /\.command-palette-modal\s*\{[^}]*?background: var\(--chrome-surface\);[^}]*?box-shadow: var\(--chrome-shadow\);/,
    );
    // 뒤 가림막이 있는 Dialog 는 그림자를 더하지 않는다 (Hub drop shadow — overlay).
    for (const rel of [
      "../components/overlay/ConfirmDialog.css",
      "../components/overlay/AgentCommandConfirmDialog.css",
      "../components/overlay/EditingSemanticsImpactDialog.css",
      "../panels/fonts/FontManager.css",
    ]) {
      expect(byRel[rel], rel).toMatch(
        /-modal\s*\{[^}]*?background: var\(--chrome-surface\);[^}]*?box-shadow: none;/,
      );
    }
  });

  // 팝오버 안 첫 · 끝 항목은 모서리에 바로 붙는다 — 항목 모서리 (8) + 목록 여백 (4) = 팝오버 모서리 (12) 라야
  // 두 곡선의 간격이 변과 같다. 항목이 4 · 2 로 갈려 있었고 팝오버는 패널과 같은 10 이었다 (2026-11-10).
  it("팝오버는 팝오버 모서리 토큰을, 그 안의 행은 컨트롤 모서리를 읽는다", async () => {
    for (const [rel, selector] of [
      ["./widgets/Popover.css", "react-aria-Popover:where\\([^)]*\\)"],
      ["../components/property/PropertyInput.css", "property-input-suggest"],
    ] as const) {
      expect(await read(rel), `${rel} ${selector}`).toMatch(
        new RegExp(
          `\\.${selector}\\s*\\{[^}]*?border-radius: var\\(--chrome-radius-popover\\);`,
        ),
      );
    }
    // 메뉴 항목 6종의 모서리는 행 모듈 한 곳 · 목록 · 제안 · 액션바 항목도 같은 값
    expect(await read("./modules/builder-menu-row.css")).toMatch(
      /\.history-menu-item,[\s\S]*?\{[^}]*?border-radius: var\(--radius-md\);/,
    );
    for (const [rel, selector] of [
      [
        "./modules/builder-popup-list.css",
        "builder-popup-list \\.react-aria-ListBoxItem",
      ],
      [
        "../components/overlay/actionBar/actionBar.css",
        "contextual-action-bar-option",
      ],
      [
        "../components/property/PropertyInput.css",
        "property-input-suggest-item",
      ],
    ] as const) {
      expect(await read(rel), `${rel} ${selector}`).toMatch(
        new RegExp(
          `\\.${selector}\\s*\\{[^}]*?border-radius: var\\(--radius-md\\);`,
        ),
      );
    }
  });

  // 빌더 문서는 `data-builder-theme` 만 세운다. 그림자 dark 값이 `[data-theme="dark"]` 에 걸려 있어
  // dark 에서도 light 값 (8% · 4%) 이 그려졌다 — Hub 는 dark 에서 3 배 (2026-11-10 스냅샷 실측).
  it("그림자 토큰의 dark 값이 빌더 테마 속성에 걸려 있다", async () => {
    const shadows = await read("./builder-shadow-tokens.css");
    expect(shadows).toMatch(/\[data-builder-theme="dark"\]\s*\{/);
    expect(shadows).not.toMatch(/^\s*\[data-theme="dark"\]\s*\{/m);
  });

  it("캔버스 바깥은 pasteboard 토큰을 읽는다", async () => {
    const [workspace, canvas] = await Promise.all([
      read("../workspace/Workspace.css"),
      read("./layout/canvas.css"),
    ]);
    expect(workspace).toMatch(/background: var\(--bg-pasteboard\);/);
    expect(workspace).not.toMatch(/background(-color)?: var\(--bg\);/);
    expect(canvas).toMatch(
      /\.app \.canvas\s*\{[^}]*?background: var\(--bg-pasteboard\);/,
    );
  });

  it("control island 3종(rail / viewport controls / action group)이 토큰만 읽는다", async () => {
    const group = await read("./modules/builder-control-group.css");

    expect(group).toMatch(
      /\.builder-control-group\.react-aria-ToggleButtonGroup,\s*\.builder-action-group,\s*\.builder-viewport-controls\s*\{[\s\S]*?padding: var\(--chrome-padding\);[\s\S]*?gap: var\(--chrome-gap\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?border-radius: var\(--chrome-radius-toolbar\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
    // action group 의 구 --bg-muted 분기는 제거됐다 — 세 표면이 같은 표면색이다.
    expect(group).toMatch(
      /\.builder-action-group,\s*\.builder-viewport-controls\s*\{\s*background: var\(--chrome-surface\);/,
    );
    expect(group).not.toContain("background: var(--bg-muted)");
  });

  it("contextual action bar 루트가 토큰만 읽는다", async () => {
    const bar = await read("../components/overlay/actionBar/actionBar.css");

    expect(bar).toMatch(
      /\.contextual-action-bar\s*\{[\s\S]*?padding: var\(--chrome-padding\);[\s\S]*?background: var\(--chrome-surface\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?border-radius: var\(--chrome-radius-toolbar\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
  });

  // (`936803385` 2026-10-26: the frame's shadow is the island's own `--chrome-shadow` — no longer the
  //   floating step; surface · radius · border were already the island's.)
  it("workspace panel frame 은 표면/테두리/그림자가 chrome island 와 같다", async () => {
    const panels = await read("../layout/PanelWorkspace.css");

    expect(panels).toMatch(
      /\.workspace-panel-frame\s*\{[\s\S]*?background: var\(--chrome-surface\);[\s\S]*?border-radius: var\(--chrome-radius\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
    // 구 placed outline 은 테두리와 겹쳐 링 2겹이었다 — 부활 금지.
    expect(panels).not.toMatch(
      /\[data-mode="placed"\]\s*\{[\s\S]*?outline: 1px solid/,
    );
    // move handle 이 프레임과 같은 표면이어야 이음매가 보이지 않는다.
    expect(panels).toMatch(
      /\.panel-move-handle\s*\{[\s\S]*?background: var\(--chrome-surface\);/,
    );
  });
});
