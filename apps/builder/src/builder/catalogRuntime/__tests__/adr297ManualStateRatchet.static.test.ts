import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss, { type ChildNode, type Container } from "postcss";
import { describe, expect, it } from "vitest";

/**
 * ADR-297 Phase 3g (G4 ratchet) — 수동 sheet 의 selected · focus 규칙은 rule 트리 (`structure.stateStyles` ·
 * `partStateStyles` — 생성 CSS) 로 옮겼다. Preview 번들 (`styles/index.css`) 이 싣는 수동 sheet 에 남는 상태 규칙은
 * Builder 위젯 전용 (`[data-catalog-id]` 로 catalog 노드를 빼는 규칙) 이거나 아래 목록의 사유가 있는 것뿐이다.
 * 새 수동 상태 규칙이 catalog 노드에 닿으면 이 테스트가 막는다 — 값은 rule 트리에 적는다.
 */
const STYLES = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles",
);
const STATE = /data-selected|data-focus-visible|data-focused|:focus/;

/** 남는 규칙 — 파일 → 사유 (규칙 수). */
const REMAINING: Readonly<Record<string, { count: number; reason: string }>> = {
  "ActionList.css": { count: 2, reason: "Builder 전용 sheet (index.css 주석)" },
  "ChatInput.css": { count: 2, reason: "Builder 전용 sheet" },
  "EventHandlerManager.css": { count: 1, reason: "Builder 전용 sheet" },
  "EventPalette.css": { count: 1, reason: "Builder 전용 sheet" },
  "ColorPicker.css": {
    count: 2,
    reason:
      "portal 된 팝오버 안 입력칸 (rule 루트 아래 선택자로 못 잡는다) · Builder 색 버튼 (`.color-swatch-button`)",
  },
  "ListBox.css": {
    count: 1,
    reason:
      "선택 바탕 — DOM (연한 accent) ≠ rule 트리 · Canvas (accent): S2 ListBox 는 스타일이 없어 oracle 없음 (사용자 결정 대기)",
  },
  "Table.css": {
    count: 3,
    reason:
      "drag 손잡이 숨김 (`data-focus-visible-within-row` — 상태가 아니라 행 안 focus 의 구조 규칙) · resizer 의 hover · resizing 목록 2 (같은 목록의 focus 몫은 트리)",
  },
  "Toast.css": {
    count: 5,
    reason:
      "앱 토스트 region (`catalog-toast*` — rule class 가 아닌 런타임 요소)",
  },
  "ToggleButtonGroup.css": {
    count: 2,
    reason:
      "indicator 의 static 비선택 글자 (`:not([data-selected])` — 트리는 「선택이면 값 없음」 을 적지 못한다)",
  },
};

function importedSheets(): string[] {
  const index = readFileSync(join(STYLES, "index.css"), "utf8");
  return [...index.matchAll(/@import\s+"\.\/([A-Za-z]+\.css)"/g)].map(
    (m) => m[1],
  );
}

function split(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** 상태 선택자가 있고 선언을 가진 규칙 중 catalog 노드를 빼지 않는 것 (선택자 목록). */
function catalogReachingStateRules(file: string): string[][] {
  const root = postcss.parse(readFileSync(join(STYLES, file), "utf8"));
  const out: string[][] = [];
  const visit = (node: Container<ChildNode>, parents: readonly string[]) => {
    node.each((child) => {
      if (child.type === "rule") {
        const resolved = parents.flatMap((parent) =>
          split(child.selector).map((s) =>
            s.includes("&")
              ? s.replaceAll("&", parent)
              : parent
                ? `${parent} ${s}`
                : s,
          ),
        );
        const hasDecls = child.nodes.some((n) => n.type === "decl");
        if (
          hasDecls &&
          resolved.some((s) => STATE.test(s)) &&
          !resolved.every((s) => s.includes("[data-catalog-id]"))
        )
          out.push(resolved);
        visit(child, resolved);
      } else if (child.type === "atrule") visit(child, parents);
    });
  };
  visit(root, [""]);
  return out;
}

describe("ADR-297 G4 — manual selected · focus CSS reaches no catalog node", () => {
  it("the Preview bundle's manual sheets keep only the listed state rules", () => {
    const counts: Record<string, number> = {};
    for (const file of importedSheets()) {
      const rules = catalogReachingStateRules(file);
      if (rules.length) counts[file] = rules.length;
    }
    const expected = Object.fromEntries(
      Object.entries(REMAINING)
        .filter(([, v]) => v.count > 0)
        .map(([file, v]) => [file, v.count]),
    );
    expect(counts).toEqual(expected);
  });

  it("every remaining entry names its reason", () => {
    for (const [file, { count, reason }] of Object.entries(REMAINING))
      if (count > 0) expect(reason, file).not.toBe("");
  });
});
