import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-227 Phase 3 G3 ratchet (2026-09-22): catalog rule 의 border 폭은 테마 토큰 `{border.width.none|thin|thick}`
 * 으로만 참조한다 — 숫자 리터럴 (`borderWidth: 1`) · px 문자열 (`borderWidth: "1px"`) · shorthand 리터럴
 * (`border: "1px solid …"`) 0. Phase 0 inventory (breakdown §8 F7) 47 + 6 + 8 + 2 = 63 곳을 참조화했다.
 *
 * 확정 예외 (테마 축 밖 — 위치·사유):
 *   - `outline: "2px solid var(--accent)"` 17 — focus 축 (ADR-150 · `{focus.ring.*}` 소유).
 *   - `"border-bottom": "1px solid var(--border)"` 10 — Table/ListBox 행·섹션 구분선 (divider 축; Skia 도
 *     같은 리터럴 1 로 그린다 — 폭 토큰과 분리, 후속 판정).
 *   - 생성기 archetype 블록의 Slider thumb `border: 2px solid var(--bg)` — Skia thumb 도 리터럴 2 (대칭).
 */
const TABLE_PATH = resolve(__dirname, "../generated/componentRulesTable.ts");

function walk(value: unknown, visit: (key: string, v: unknown) => void): void {
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    visit(k, v);
    walk(v, visit);
  }
}

describe("ADR-227 G3 — catalog border 폭 리터럴 0 ratchet", () => {
  it("`borderWidth` 값은 전부 `{border.width.<k>}` 토큰이다 (숫자 · 'Npx' 0)", () => {
    const offenders: string[] = [];
    const tokens = new Set<string>();
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (key !== "borderWidth") return;
      if (
        typeof v === "string" &&
        /^\{border\.width\.(none|thin|thick)\}$/.test(v)
      ) {
        tokens.add(v);
        return;
      }
      offenders.push(`${key}: ${JSON.stringify(v)}`);
    });
    expect(offenders).toEqual([]);
    expect([...tokens].sort()).toEqual([
      "{border.width.none}",
      "{border.width.thick}",
      "{border.width.thin}",
    ]);
  });

  it("`border` shorthand 문자열의 폭은 `var(--border-width-*)` — `Npx solid` 0", () => {
    const offenders: string[] = [];
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (key !== "border" || typeof v !== "string") return;
      if (/^\d+(\.\d+)?px\s+solid/.test(v)) offenders.push(v);
    });
    expect(offenders).toEqual([]);
  });

  it('소스 텍스트에도 `borderWidth: <숫자>` · `borderWidth: "Npx"` · `border: "Npx solid` 가 없다 (주석 제외)', () => {
    const src = readFileSync(TABLE_PATH, "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"));
    const hits = src.filter(
      (line) =>
        /borderWidth:\s*\d/.test(line) ||
        /borderWidth:\s*"\d+px"/.test(line) ||
        /\bborder:\s*"\d+px\s+solid/.test(line),
    );
    expect(hits).toEqual([]);
  });

  it("확정 예외 목록은 고정 — outline 17 · border-bottom 10 (늘면 판정 필요)", () => {
    let outline = 0;
    let borderBottom = 0;
    walk(COMPONENT_RULES_TABLE, (key, v) => {
      if (typeof v !== "string") return;
      if (key === "outline" && /^2px solid var\(--accent\)$/.test(v))
        outline += 1;
      if (key === "border-bottom" && /^1px solid var\(--border\)$/.test(v))
        borderBottom += 1;
    });
    expect({ outline, borderBottom }).toEqual({
      outline: 17,
      borderBottom: 10,
    });
  });
});
