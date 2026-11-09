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

// ADR-305 Phase 5 — 사용자 picker (Popover 가 `data-catalog-id` 를 가진다) 의 항목은 ListBox rule 의 생성 시트
// `&:is(.react-aria-Popover *)` 블록이 그린다. 수동 ListBox.css 의 같은 블록은 Builder 위젯 몫
// (`:not([data-catalog-id])`) 이었고 Builder 문서가 사용자 시트를 싣지 않게 되며 빠졌다.
const generated = read("../styles/generated/ListBox.css").replace(/\s+/g, " ");

describe("picker 항목 선택 표시 — 작성자 노드가 글리프를 대신한다", () => {
  it("picker Popover 안에서만: 표시 노드가 있는 항목은 글리프가 비키고 아이콘이 gutter 에 놓인다", () => {
    const P =
      ".react-aria-ListBox:is(.react-aria-Popover *) .react-aria-ListBoxItem";
    // 글리프는 표시 노드가 없는 선택 항목에만
    expect(generated).toContain(
      `${P}[data-selected]:not([data-selection-mark])::before {`,
    );
    // 표시 노드의 아이콘은 글리프 자리 (왼쪽 gutter)
    expect(generated).toMatch(
      /\.react-aria-ListBoxItem\[data-selection-mark\] > \.react-aria-Icon:not\(\[slot\]\) \{ position: absolute; top: 50%; left: var\(--spacing-xs\);/,
    );
  });
});
