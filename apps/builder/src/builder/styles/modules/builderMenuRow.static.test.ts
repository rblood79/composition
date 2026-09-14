/**
 * builder-menu-row.css 적용처 가드 (panel-ui 21, 2026-09-14)
 *
 * 메뉴 항목 28 규격은 모듈 하나가 갖고 각 파일은 색·hover 만 둔다. 인벤토리 21 의
 * "미반영 5" — History 스냅샷 메뉴 · 데이터 바인딩 팝오버 (필드 피커 메뉴 · 옵션 한 줄) ·
 * AgentCommandConfirmDialog (13 다이얼로그 규격) · RulerOverlay 글자 · CompareMode 라벨 pill —
 * 가 티어 밖 값 (34 · 46 · 26 · 9px) 으로 되돌아가지 않는지 정적으로 고정한다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(BUILDER, rel), "utf-8");

/** 선택자 블록 하나의 선언부 */
function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`selector not found: ${selector}`);
  return match[1];
}

describe("builder-menu-row 적용처 — 메뉴 항목 28", () => {
  const module = read("styles/modules/builder-menu-row.css");
  const itemRule = block(
    module,
    ".react-aria-Menu.field-picker-menu .react-aria-MenuItem",
  );

  it("History 스냅샷 메뉴 · 필드 피커 메뉴가 28 행 선택자에 있다", () => {
    const head = module.slice(0, module.indexOf(itemRule));
    expect(head).toContain(".history-menu-item,");
    expect(head).toContain(
      ".react-aria-Menu.field-picker-menu .react-aria-MenuItem",
    );
    expect(itemRule).toContain("block-size: var(--control-size)");
    expect(module).toContain(".history-menu-item > svg");
  });

  it("HistoryPanel.css · PropertyFieldTemplateInput.css 는 행 기하를 다시 선언하지 않는다", () => {
    const history = block(
      read("panels/history/HistoryPanel.css"),
      ".history-menu-item",
    );
    expect(history).not.toMatch(/padding|block-size|height|font-size|gap/);

    const picker = block(
      read("components/property/PropertyFieldTemplateInput.css"),
      ".react-aria-Menu.field-picker-menu .react-aria-MenuItem",
    );
    expect(picker).not.toMatch(/height|padding/);
  });
});

describe("데이터 바인딩 옵션 — 한 줄 (이름 12 · 타입 10 mono caps)", () => {
  const css = read("components/property/PropertyDataBinding.css");

  it("옵션 컨테이너는 row, 설명은 --text-2xs mono", () => {
    expect(block(css, ".binding-option")).not.toContain(
      "flex-direction: column",
    );
    const desc = block(css, ".binding-option-desc");
    expect(desc).toContain("font-size: var(--text-2xs)");
    expect(desc).toContain("font-family: var(--font-mono)");
    expect(block(css, ".binding-option-label")).toContain(
      "font-size: var(--text-xs)",
    );
  });
});

describe("AgentCommandConfirmDialog — 13 다이얼로그 규격", () => {
  const css = read("components/overlay/AgentCommandConfirmDialog.css");
  const tsx = read("components/overlay/AgentCommandConfirmDialog.tsx");

  it("헤더 48 · 푸터 44 · 본문 12 — ConfirmDialog 와 같은 8 격자", () => {
    expect(block(css, ".agent-confirm-header")).toContain("min-height: 48px");
    expect(block(css, ".agent-confirm-actions")).toContain("min-height: 44px");
    expect(block(css, ".agent-confirm-body")).toContain(
      "font-size: var(--text-xs)",
    );
    expect(css).not.toMatch(/font-size:\s*1[35]px/);
    expect(css).not.toContain("#f59e0b");
  });

  it("Dialog 에 className 이 있다 — 생성 Dialog.css overlay archetype 누수 방지", () => {
    expect(tsx).toContain('className="agent-confirm-dialog"');
  });

  it("DataChangeDiffView 행 28 · 태그 10 mono", () => {
    const diff = read("components/overlay/DataChangeDiffView.css");
    expect(block(diff, ".data-diff-heading")).toContain(
      "min-block-size: var(--control-size)",
    );
    expect(block(diff, ".data-diff-item")).toContain(
      "min-block-size: var(--control-size)",
    );
    expect(block(diff, ".data-diff-op")).toContain(
      "font-size: var(--text-2xs)",
    );
    expect(diff).not.toMatch(/font-size:\s*1[0-2]px/);
  });
});

describe("Workspace.css — 눈금자 글자 10 mono · 캔버스 pill 28", () => {
  const css = read("workspace/Workspace.css");

  it("ruler-label 은 9px 이 아니라 --text-2xs mono", () => {
    const label = block(css, ".ruler-label");
    expect(label).toContain("font-size: var(--text-2xs)");
    expect(label).toContain("font-family: var(--font-mono)");
    expect(css).not.toContain("font-size: 9px");
  });

  it("compare 라벨 · 상태 표시는 block-size --control-size", () => {
    expect(block(css, ".workspace-compare-label")).toContain(
      "block-size: var(--control-size)",
    );
    expect(block(css, ".workspace-status-indicator")).toContain(
      "block-size: var(--control-size)",
    );
    expect(css).not.toContain("padding: 4px 12px");
  });
});
