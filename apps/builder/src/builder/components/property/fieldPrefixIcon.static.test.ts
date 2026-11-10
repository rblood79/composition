import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

/**
 * 패널 입력 앞 표시 규칙 (Figma 방식, 사용자 결정 2026-11-10).
 *
 * - 숫자 칸 (`PropertyUnitInput` · `PropertyNumberInput`) 은 늘 칸 안 앞 표시를 둔다 — 축은 글자
 *   (`LetterX` …), 그 밖은 값 아이콘, 지정이 없으면 컴포넌트 기본값 `#`. 렌더 테스트가 기본값을 본다.
 * - 셀렉트 (`PropertySelect`) 앞에는 아이콘을 두지 않는다 — 값 · 타입 자체를 보여 주는 아이콘
 *   (Data 필드 타입 글리프) 만 아래 허용 목록으로 둔다.
 * - 스위치 (`PropertySwitch`) 는 대상이 아이콘으로 분명한 칸 (검색 · sitemap) 에만 아이콘을 둔다 (사용자 지정).
 *
 * **Why**: 같은 패널 안에서 앞 아이콘이 있는 칸과 없는 칸이 섞였다 — 셀렉트 5 (Apply layout ·
 * 데이터 바인딩 · Who can access · Language …) 는 legend 와 같은 뜻의 장식 아이콘을 달았고, 스위치는
 * 15 / 11 로 갈렸으며 (Show action bar 가 눈금자 아이콘을 복사), 숫자 칸은 Gradient 8 만 아이콘이
 * 있었다. Figma UI3 · Pen 은 숫자 칸마다 칸 안 표시, 셀렉트 · 토글은 표시 없음으로 한 벌이다.
 */

const SRC_ROOT = resolve(__dirname, "../../..");

/** 값 · 타입을 보여 주는 셀렉트 아이콘 — 고른 값이 바뀌면 아이콘도 바뀐다. */
const SELECT_VALUE_ICON_ALLOWLIST = new Set([
  "builder/panels/datatable/grid/ColumnEditorPopover.tsx",
  "builder/panels/datatable/grid/FieldValueInput.tsx",
]);

async function collectTsx(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await collectTsx(full)));
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/** `<Tag …>` 여는 태그 본문 (중괄호 안의 `>` 는 건너뛴다). */
function openingTags(source: string, tag: string): string[] {
  const tags: string[] = [];
  const re = new RegExp(`<${tag}(?![\\w.])`, "g");
  for (const m of source.matchAll(re)) {
    let i = (m.index ?? 0) + m[0].length;
    let depth = 0;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (depth === 0 && ch === ">") break;
    }
    tags.push(source.slice((m.index ?? 0) + m[0].length, i));
  }
  return tags;
}

describe("panel field prefix icons (Figma 방식)", () => {
  it("selects carry no prefix icon outside the value-icon allowlist", async () => {
    const offenders: string[] = [];
    for (const file of await collectTsx(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file);
      if (SELECT_VALUE_ICON_ALLOWLIST.has(rel)) continue;
      const source = await readFile(file, "utf-8");
      for (const tag of openingTags(source, "PropertySelect")) {
        if (/\bicon=\{/.test(tag)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the allowlisted value icons still exist (no stale entries)", async () => {
    for (const rel of SELECT_VALUE_ICON_ALLOWLIST) {
      const source = await readFile(resolve(SRC_ROOT, rel), "utf-8");
      const withIcon = openingTags(source, "PropertySelect").filter((tag) =>
        /\bicon=\{/.test(tag),
      );
      expect(withIcon.length, rel).toBeGreaterThan(0);
    }
  });

  it("numeric fields default to a prefix glyph", async () => {
    const unit = await readFile(
      resolve(__dirname, "PropertyUnitInput.components.tsx"),
      "utf-8",
    );
    expect(unit).toContain(
      '(iconProp ?? (labelMode === "legend" ? Hash : undefined))',
    );
    const num = await readFile(
      resolve(__dirname, "PropertyNumberInput.tsx"),
      "utf-8",
    );
    expect(num).toContain("icon={icon ?? Hash}");
  });
});
