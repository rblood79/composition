import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * ADR-256 Phase 6f — picker 항목의 선택 표시. 기본은 picker Popover 안 `[data-selected]::before`
 * 글리프이고, 작성자의 선택 표시 노드 (`showWhen: isSelected`) 가 있는 항목 (`data-selection-mark` —
 * `domBinding.tsx` `hasSelectionMark`) 은 글리프가 비키고 아이콘 노드가 그 자리 (왼쪽 gutter) 에
 * 놓인다 (레퍼런스 `.dropdown-item[data-selected] .lucide-check`). cascade 는 jsdom 으로 못 재므로
 * 규칙 존재만 고정하고 실제 표시는 live 로 확인한다 (`menuSelectionIndicator.test.ts` 와 같은 방식).
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const listBoxCss = read("../styles/ListBox.css").replace(/\s+/g, " ");
const popoverBlock = listBoxCss.slice(
  listBoxCss.indexOf('.react-aria-Popover[data-trigger="ComboBox"]'),
  listBoxCss.indexOf("/* ========== Color Variants"),
);

describe("picker 항목 선택 표시 — 작성자 노드가 글리프를 대신한다", () => {
  it("picker Popover 안에서만: 표시 노드가 있는 항목은 글리프가 비키고 아이콘이 gutter 에 놓인다", () => {
    expect(popoverBlock).toMatch(
      /&\[data-selection-mark\]::before \{ display: none; \}/,
    );
    expect(popoverBlock).toMatch(
      /&\[data-selection-mark\] > \.react-aria-Icon:not\(\[slot\]\) \{ position: absolute; top: 0; left: 0; width: 18px;/,
    );
    // (글리프 자리와 같은 폭 — `[data-selected]::before` 의 18px.)
    expect(popoverBlock).toMatch(
      /&::before \{ content: "✓" \/ ""; position: absolute; left: 0; color: var\(--accent\); width: 18px;/,
    );
  });
});
