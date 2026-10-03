import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * 섹션은 `Section` 컴포넌트 경유만 — `.section` 직접 마크업 금지 (panel-structure.md §1 · §4).
 *
 * collapse · reset · lazy · badge · actions 와 `data-section-id` 는 `Section` 이 준다. 클래스만 흉내 낸
 * `<div className="section">` 은 이 계약을 하나도 갖지 않으면서 `.section` 구조 CSS (flex column ·
 * content-visibility) 만 받는다. 2026-10-04 ComponentList 검색 결과 없음 화면 1건을 고치며 가드를 추가했다
 * — 빈 상태는 섹션이 아니라 `EmptyState` 하나를 스크롤 영역에 바로 둔다 (다른 패널과 같음).
 */

const BUILDER_ROOT = resolve(__dirname, "../..");
const SECTION_COMPONENT = resolve(__dirname, "Section.tsx");

async function collectTsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await collectTsxFiles(full)));
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/** `className="section"` 또는 `className="section other"` — `section-*` · `*-section` 은 아니다. */
const DIRECT_SECTION =
  /className=(?:"section(?:\s[^"]*)?"|\{`section(?:\s[^`]*)?`\})/;

describe(".section 직접 마크업 금지 가드", () => {
  it("Section.tsx 밖에서 className 이 `section` 으로 시작하는 요소 0건", async () => {
    const files = await collectTsxFiles(BUILDER_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      if (file === SECTION_COMPONENT) continue;
      const source = await readFile(file, "utf8");
      source.split("\n").forEach((line, index) => {
        if (DIRECT_SECTION.test(line))
          offenders.push(`${relative(BUILDER_ROOT, file)}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
