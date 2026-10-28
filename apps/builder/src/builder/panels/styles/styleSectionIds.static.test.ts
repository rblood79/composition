import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { STYLE_PANEL_SECTION_IDS } from "../../components/panel/useSectionCollapse";

/**
 * ⌥⇧E 전체 토글 · `collapseAll()` 의 대상 = Styles 탭 (Layout · Style · Text · Screen) 이 그리는 절의
 * id 전부, 그 밖은 없음. 목록에 없는 절은 접힘이 저장돼도 토글에서 빠지고, 목록에 남은 옛 id 나 다른
 * 보기의 id 는 토글이 보이지 않는 절을 접는다 (2026-10-28: 삭제된 Spacing 절의 `spacing`,
 * Design 격자 보기의 `grid-columns` · `grid-rows`, id 없는 Responsive 두 절).
 */
const STYLES = resolve(__dirname);
/** Design 패널 격자 보기 (GridTrackView) 의 절 — Styles 탭이 아니다. */
const OTHER_VIEW = new Set(["sections/GridTracksSection.tsx"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "__tests__") sources(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** Styles 소스의 Section id — `<PropertySection id="…">` 와 `…_SECTION_ID = "…"` 상수. */
function renderedSectionIds(): Set<string> {
  const ids = new Set<string>();
  for (const path of sources(STYLES)) {
    const rel = path.slice(STYLES.length + 1);
    if (OTHER_VIEW.has(rel)) continue;
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(/<PropertySection[^>]*?\bid="([^"]+)"/gs))
      ids.add(m[1]!);
    for (const m of text.matchAll(/_SECTION_ID\s*=\s*"([^"]+)"/g))
      ids.add(m[1]!);
  }
  return ids;
}

describe("Styles 절 id 목록 (STYLE_PANEL_SECTION_IDS)", () => {
  it("Styles 탭이 그리는 절 id 와 같은 집합이다", () => {
    expect(new Set(STYLE_PANEL_SECTION_IDS)).toEqual(renderedSectionIds());
  });

  it("Responsive 두 절도 id 를 가진다 (접힘 저장 · 전체 토글 대상)", () => {
    const responsive = readFileSync(
      join(STYLES, "sections/ResponsiveSection.components.tsx"),
      "utf8",
    );
    const sections = [
      ...responsive.matchAll(/<PropertySection\b([^>]*?)>/gs),
    ].map((m) => m[1]!);
    expect(sections.length).toBeGreaterThan(0);
    for (const attrs of sections) expect(attrs).toMatch(/\bid="/);
  });
});
