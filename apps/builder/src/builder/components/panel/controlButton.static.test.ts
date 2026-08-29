import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * 라벨 액션 버튼 정본 정적 가드 (2026-08-30 통일).
 *
 * 정본은 `components/styles/panel-system.css` 의 `.control-button` 하나이고, 무게 축은
 * `data-variant="primary"`(확정 채움) / `"add"`(목록 끝 전폭 점선) / 무지정(중립·취소)이다.
 *
 * **왜 가드가 필요한가**: 통일 직전 실측에서 라벨 액션 버튼이 25개 클래스 / 47개 호출부에
 * 흩어져 각자 chrome 을 정의했고, 높이가 22·26·28·32·34·36·38px 로 갈려 패널 필드 격자
 * (`--inspector-control-size` 28px)에서 버튼만 튀어나왔다. 같은 "추가" 액션 6종의 배경 4종·
 * radius 2종·글자 2종·글자색 3종이 전부 달랐고 `focus-visible` 은 29개 중 24개에 없었다.
 * 새 패널이 또 로컬 버튼 클래스를 만들면 같은 곳으로 되돌아간다.
 *
 * 아이콘 전용 버튼(`.iconButton` / `ActionIconButton`), 패널 헤더 액션 슬롯(`.panel-actions`),
 * 캔버스 오버레이(`contextual-action-bar-*`)는 축이 다르므로 대상이 아니다.
 */

const BUILDER_ROOT = resolve(__dirname, "../..");
const CANONICAL_CSS = resolve(
  BUILDER_ROOT,
  "components/styles/panel-system.css",
);

async function collectFiles(dir: string, ext: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await collectFiles(full, ext)));
    } else if (e.name.endsWith(ext) && !e.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

/** 통일로 사라진 로컬 버튼 클래스 — 되살아나면 발산이 재개된 것이다. */
const RETIRED_CLASSES = [
  "interactions-add",
  "datatable-add-btn",
  "add-kv-btn",
  "add-field-btn",
  "add-row-btn",
  "responsive-add-override",
  "creator-action",
  "add-page-submit",
  "add-page-cancel",
  "test-btn",
  "import-btn",
  "agent-confirm-button",
  "editing-impact-button",
  "component-semantics-action",
  "frame-slot-action",
  "page-slug-generate",
  "toolbar-btn",
  "auto-detect-btn",
  "toggle-all-btn",
  "control-button--add",
];

const ALLOWED_VARIANTS = new Set(["primary", "add"]);

describe("라벨 액션 버튼 정본 (.control-button)", () => {
  it("chrome 정의처는 panel-system.css 하나다", async () => {
    const cssFiles = await collectFiles(BUILDER_ROOT, ".css");
    /** 인스턴스 override(조상 스코프 있음)는 허용 — base 정의만 금지. */
    const baseDefinitions: string[] = [];
    for (const file of cssFiles) {
      if (file === CANONICAL_CSS) continue;
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(
        /(^|\n)\s*([^\n{}]*\.control-button[^\n{}]*)\{/g,
      )) {
        const selector = match[2].trim();
        const isInstanceOverride = /\s/.test(
          selector.replace(/\[[^\]]*\]/g, "").trim(),
        );
        if (!isInstanceOverride) {
          baseDefinitions.push(`${relative(BUILDER_ROOT, file)}: ${selector}`);
        }
      }
    }
    expect(baseDefinitions).toEqual([]);
  });

  it("정본이 상태 4종을 모두 정의한다 (:hover 계열 + [data-*] 계열)", async () => {
    const source = await readFile(CANONICAL_CSS, "utf8");
    for (const selector of [
      ".control-button:hover:not(:disabled)",
      ".control-button[data-hovered]",
      ".control-button:active:not(:disabled)",
      ".control-button[data-pressed]",
      ".control-button:focus-visible",
      ".control-button[data-focus-visible]",
      ".control-button:disabled",
      ".control-button[data-disabled]",
    ]) {
      expect(source).toContain(selector);
    }
  });

  it("높이는 패널 필드 격자와 같은 토큰이다", async () => {
    const source = await readFile(CANONICAL_CSS, "utf8");
    const block = source.slice(
      source.indexOf("  .control-button {"),
      source.indexOf("  .control-button > svg"),
    );
    expect(block).toContain("height: var(--inspector-control-size)");
  });

  it("은퇴한 로컬 버튼 클래스가 되살아나지 않는다", async () => {
    const files = [
      ...(await collectFiles(BUILDER_ROOT, ".tsx")),
      ...(await collectFiles(BUILDER_ROOT, ".css")),
    ];
    const revived: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const cls of RETIRED_CLASSES) {
        if (new RegExp(`[."\`\\s]${cls}\\b`).test(source)) {
          revived.push(`${relative(BUILDER_ROOT, file)}: ${cls}`);
        }
      }
    }
    expect(revived).toEqual([]);
  });

  it("variant 값은 정본이 정의한 것만 쓴다", async () => {
    const tsxFiles = await collectFiles(BUILDER_ROOT, ".tsx");
    const unknown: string[] = [];
    for (const file of tsxFiles) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/data-variant="([a-z-]+)"/g)) {
        if (!ALLOWED_VARIANTS.has(match[1])) {
          unknown.push(`${relative(BUILDER_ROOT, file)}: ${match[1]}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});
