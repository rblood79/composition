// @vitest-environment node
/**
 * 단축키 **표기**의 단일 소스 계약을 기계로 집행한다.
 *
 * **Why (2026-08-27 실측)**: 단축키 자체는 `SHORTCUT_DEFINITIONS` 하나로 모여
 * 있었는데 화면에 찍히는 문자열은 그렇지 않았다. 패널 설정이 `shortcut: "⌥1"`
 * 처럼 표기를 따로 들고 있었고, 헤더 메뉴는 JSX 에 `⌘O` / `⌘/` 를 직접 적었다.
 * 그 결과:
 *
 * - settings `"Ctrl+,"` / monitor `"Ctrl+Alt+M"` — 정의는 `⌘,` / `⌃⌥M` 인데
 *   표기는 Mac 표기조차 아니었다 (레일에 안 나오는 자리라 오래 안 보였다).
 * - `⌘O` — 정의도 등록도 핸들러도 없는 표기가 메뉴에 떠 있었다.
 * - `⌥1`~`⌥8` — 마침 정의와 같았지만, 이번 재배치에서 정의만 옮겼으면 그대로
 *   남았을 값이다.
 *
 * 그래서 두 조항을 건다:
 *
 * 1. **glyph 리터럴은 표기 함수 안에만** — 그 밖의 코드가 `⌘`/`⌥`/`⇧`/`⌃` 를
 *    문자열로 적으면 정의에서 파생되지 않은 두 번째 소스다.
 * 2. **패널 토글 정의는 전부 라벨 경로를 갖는다** — 새 `toggle*` 정의를 더하고
 *    `PanelConfig.shortcutId` 를 빠뜨리면 툴팁에 표기가 안 붙는다 (`ai` 가
 *    실제로 그 상태였다).
 *
 * 주석·테스트는 판정에서 뺀다. 이 파일의 위 설명처럼 무엇이 어긋났는지 적으려면
 * glyph 를 써야 하고, 주석은 화면에 안 나온다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { SHORTCUT_DEFINITIONS } from "./keyboardShortcuts";

const SRC_ROOT = resolve(__dirname, "../..");

/** 표기 문자열을 만드는 유일한 자리 (`formatShortcut`). */
const DISPLAY_SOURCE_REL = "builder/hooks/useKeyboardShortcutsRegistry.ts";

const SHORTCUT_GLYPHS = /[⌘⌥⇧⌃]/;

/**
 * `panelConfigs.ts` 는 패널 컴포넌트를 전부 끌고 들어와 node 환경에서 import 할
 * 수 없다 (`PanelRegistry` 가 DEV 에서 `window` 를 만진다). 표기 계약에 필요한
 * 것은 `shortcutId` 값 목록뿐이라 소스에서 읽는다.
 */
const PANEL_CONFIG_REL = "builder/panels/core/panelConfigs.ts";

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/** 블록/줄 주석 제거 — 주석 안의 glyph 는 화면에 안 나온다. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("단축키 표기 SSOT", () => {
  it("glyph 리터럴은 표기 함수 밖에 없다", () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .map((file) => ({ file, rel: relative(SRC_ROOT, file) }))
      .filter(({ rel }) => rel !== DISPLAY_SOURCE_REL)
      .flatMap(({ file, rel }) =>
        stripComments(readFileSync(file, "utf8"))
          .split("\n")
          .map((line, index) => ({ rel, line: line.trim(), no: index + 1 }))
          .filter(({ line }) => SHORTCUT_GLYPHS.test(line)),
      )
      .map(({ rel, no, line }) => `${rel}:${no}  ${line}`);

    expect(offenders).toEqual([]);
  });

  it("패널 토글 정의는 전부 패널 설정의 shortcutId 로 이어진다", () => {
    const panelConfigSource = readFileSync(
      join(SRC_ROOT, PANEL_CONFIG_REL),
      "utf8",
    );
    const wiredIds = new Set(
      [...panelConfigSource.matchAll(/shortcutId:\s*"([^"]+)"/g)].map(
        (match) => match[1],
      ),
    );
    expect(wiredIds.size).toBeGreaterThan(0);

    // `panels` 카테고리에는 패널이 아닌 것도 둘 있다 — 눈금자는 캔버스 오버레이,
    // 커맨드 팔레트는 모달이라 레일에 자리가 없다. 둘 다 자기 자리에서 표기를
    // 따로 갖는다 (컨텍스트 메뉴 / 헤더 메뉴).
    const NOT_PANELS = new Set(["toggleRulers", "commandPalette"]);
    const panelOpeningIds = Object.entries(SHORTCUT_DEFINITIONS)
      .filter(([id, def]) => def.category === "panels" && !NOT_PANELS.has(id))
      .map(([id]) => id);
    expect(panelOpeningIds.length).toBeGreaterThan(0);

    const unwired = panelOpeningIds.filter((id) => !wiredIds.has(id));
    expect(unwired).toEqual([]);
  });
});
