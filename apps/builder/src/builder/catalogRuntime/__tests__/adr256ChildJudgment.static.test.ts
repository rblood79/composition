/**
 * ADR-256 G1 — 「넣을 수 있는가」 의 판정은 하나다 (Decision 4). 중첩 검사 · Properties slot 섹션의
 * 넣기 목록 · instance 자리 검증 (fillSlot) 이 `catalogChildKind` · `resolveNestingViolation`
 * (nestingRules) 만 읽는다. 옛 표 — renderer 한계 표 `SELF_COMPOSED_CONTAINER_CHILD_TYPES` (이름과 뜻이
 * `UNCONVERTED_FAMILY_LIMITS` 로 바뀜) · 모든 slot 에 같은 5종을 내던 `SLOT_FILL_PRIMITIVE_TYPES` — 의
 * 참조는 0 이다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  resolve(__dirname, "../../.."),
  resolve(__dirname, "../../../../../../packages/shared/src"),
];
const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);

function sources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
        out.push(full);
    }
  };
  walk(root);
  return out;
}

const OLD_TABLES = [
  "SELF_COMPOSED_CONTAINER_CHILD_TYPES",
  "SLOT_FILL_PRIMITIVE_TYPES",
  "isSlotFillPrimitiveType",
  "slotFillPrimitiveLabel",
];
/** The old module itself, until its deletion is approved (CLAUDE.md — 원본 파일 삭제는 별도 승인). */
const OLD_MODULE = /components\/slotFillNodes\.ts$/;

describe("ADR-256 G1 — one children judgment", () => {
  it("no source reads the old tables", () => {
    const hits: string[] = [];
    for (const root of ROOTS)
      for (const file of sources(root)) {
        if (OLD_MODULE.test(file)) continue;
        const text = readFileSync(file, "utf8");
        for (const name of OLD_TABLES)
          if (text.includes(name))
            hits.push(`${relative(root, file)}: ${name}`);
        if (/from ["'][^"']*slotFillNodes["']/.test(text))
          hits.push(`${relative(root, file)}: imports slotFillNodes`);
      }
    expect(hits).toEqual([]);
  });

  it("the slot section reads the insert list from the judgment", () => {
    const section = readFileSync(
      resolve(
        __dirname,
        "../../panels/properties/catalog/CatalogSlotSection.tsx",
      ),
      "utf8",
    );
    expect(section).toContain("catalogSlotInsertOptions");
    const slots = readFileSync(resolve(__dirname, "../slots.ts"), "utf8");
    expect(slots).toContain("catalogChildKind");
    expect(slots).toContain("assertNestable");
  });
});
