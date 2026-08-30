import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 컨트롤 크기 2-티어 게이트 (2026-08-30).
 *
 * 빌더의 컨트롤 높이는 `--control-size`(28px) / `--control-size-lg`(32px) 둘뿐이고,
 * 아이콘 전용 정사각 컨트롤의 기하는 `styles/modules/builder-control-size.css` 한 곳이
 * 소유한다. 이 테스트가 막는 것은 값이 아니라 **패턴 이탈** 두 가지다:
 *   ① 세 번째 크기 도입 (티어 토큰이 아닌 값을 아이콘 버튼에 직접 씀)
 *   ② `padding × 2 + 아이콘` 파생으로 크기를 만드는 구 패턴의 부활
 *
 * Why: 파생 패턴 때문에 같은 `.iconButton` 이 자리마다 20 / 24 / 32px 이었다.
 */
describe("control size 2-tier", () => {
  const read = (rel: string) =>
    readFile(resolve(__dirname, rel), "utf-8") as Promise<string>;

  const TOKENS =
    "../../../../../packages/shared/src/components/styles/theme/builder-system.css";
  const MODULE = "./modules/builder-control-size.css";

  /** `at` 위치의 규칙 본문을 중첩 블록까지 포함해 잘라낸다. */
  const body = (css: string, at: number): string => {
    const open = css.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(open + 1, i);
      }
    }
    return css.slice(open + 1);
  };

  it("티어 토큰은 2개뿐이고 구 이름은 남아 있지 않다", async () => {
    const css = await read(TOKENS);

    expect(css).toContain(
      "--control-size: calc(var(--text-2xl) + var(--spacing));",
    );
    expect(css).toContain(
      "--control-size-lg: calc(var(--text-2xl) + var(--spacing-sm));",
    );
    // 자리 이름(구 토큰)은 선언으로 부활하지 않는다 — Why 주석의 인용만 남는다.
    expect(css).not.toMatch(/^\s*--inspector-control-size:/m);
    expect(css).not.toMatch(/^\s*--header-height:/m);
  });

  it("아이콘 컨트롤 기하는 모듈 한 곳이 소유한다", async () => {
    const css = await read(MODULE);

    // 기본 티어: 크기를 선언하고 padding 은 0 으로 고정한다.
    expect(css).toMatch(
      /--icon-control-size: var\(--control-size\);[\s\S]*?inline-size: var\(--icon-control-size\);[\s\S]*?block-size: var\(--icon-control-size\);[\s\S]*?padding: 0;/,
    );
    // lg 티어는 크기 토큰만 바꾼다 — width/height/padding 재선언 금지.
    const lg = css.slice(css.indexOf("--icon-control-size: var(--control-size-lg)"));
    expect(lg).not.toMatch(/^\s*(width|height|padding):/m);

    // 세 번째 크기 금지: --icon-control-size 는 두 티어 토큰만 참조한다.
    const assigned = [...css.matchAll(/--icon-control-size:\s*([^;]+);/g)].map(
      (m) => m[1].trim(),
    );
    expect(assigned.length).toBeGreaterThan(0);
    expect(new Set(assigned)).toEqual(
      new Set(["var(--control-size)", "var(--control-size-lg)"]),
    );
  });

  it("파생 크기 패턴이 부활하지 않는다", async () => {
    const cases: Array<[string, string, RegExp]> = [
      // [파일, 규칙 선택자, 금지 선언]
      [
        "../components/ui/ActionIconButton.css",
        ".action-icon-button",
        /padding:/,
      ],
      ["./layout/canvas.css", ".panel-header .iconButton", /padding:/],
      [
        "../components/styles/list-group.css",
        ".list-item-actions .iconButton",
        /padding:/,
      ],
      [
        "../panels/navigator/NavigatorPanel.css",
        ".elementItemActions .iconButton",
        /width:|height:/,
      ],
      [
        "../components/overlay/actionBar/actionBar.css",
        ".contextual-action-bar .contextual-action-bar-item",
        /width: \d|height: \d/,
      ],
      [
        "./modules/builder-control-group.css",
        '.react-aria-ToggleButtonGroup[data-indicator="true"]\n    .react-aria-ToggleButton',
        /padding:/,
      ],
    ];

    for (const [file, selector, banned] of cases) {
      // 주석은 구 패턴을 설명하느라 금지어를 그대로 인용하므로 먼저 걷어낸다.
      const css = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, "");
      const at = css.indexOf(selector);
      expect(at, `${file} — ${selector} 규칙이 사라졌다`).toBeGreaterThan(-1);
      expect(body(css, at), `${file} — ${selector} 에 파생 선언 부활`).not.toMatch(
        banned,
      );
    }
  });

  it("section-header 아이콘 버튼의 구 padding 규칙은 제거됐다", async () => {
    const css = await read("../components/styles/panel-system.css");
    expect(css).not.toMatch(/\.section-header \.iconButton\s*\{/);
  });
});
