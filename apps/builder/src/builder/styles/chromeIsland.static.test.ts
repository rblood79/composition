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
describe("chrome island", () => {
  const read = (rel: string) =>
    readFile(resolve(__dirname, rel), "utf-8") as Promise<string>;

  it("정본 토큰이 builder 스코프에 선언돼 있다", async () => {
    const tokens = await read(
      "../../../../../packages/shared/src/components/styles/theme/builder-system.css",
    );

    for (const decl of [
      "--chrome-surface: var(--bg-raised);",
      "--chrome-border: 0;",
      "--chrome-radius: var(--radius-lg);",
      "--chrome-padding: var(--spacing-xs);",
      "--chrome-gap: var(--spacing-xs);",
      "--chrome-shadow: var(--shadow-sm);",
      "--chrome-shadow-floating: var(--shadow-lg);",
    ]) {
      expect(tokens).toContain(decl);
    }
  });

  it("control island 3종(rail / viewport controls / action group)이 토큰만 읽는다", async () => {
    const group = await read("./modules/builder-control-group.css");

    expect(group).toMatch(
      /\.builder-control-group\.react-aria-ToggleButtonGroup,\s*\.builder-action-group,\s*\.builder-viewport-controls\s*\{[\s\S]*?padding: var\(--chrome-padding\);[\s\S]*?gap: var\(--chrome-gap\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?border-radius: var\(--chrome-radius\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
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
      /\.contextual-action-bar\s*\{[\s\S]*?padding: var\(--chrome-padding\);[\s\S]*?background: var\(--chrome-surface\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?border-radius: var\(--chrome-radius\);[\s\S]*?box-shadow: var\(--chrome-shadow\);/,
    );
  });

  it("workspace panel frame 은 floating 그림자만 다르고 표면/테두리는 같다", async () => {
    const panels = await read("../layout/PanelWorkspace.css");

    expect(panels).toMatch(
      /\.workspace-panel-frame\s*\{[\s\S]*?background: var\(--chrome-surface\);[\s\S]*?border-radius: var\(--chrome-radius\);[\s\S]*?border: var\(--chrome-border\);[\s\S]*?box-shadow: var\(--chrome-shadow-floating\);/,
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
