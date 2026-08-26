import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/**
 * ADR-163 Phase 4-c — 예약 prefix 정적 가드.
 *
 * `.claude/rules/panel-structure.md` §2 Prefix 예약표: `panel-*` / `section-*` /
 * `fieldset-*` / `tab-*` 는 구조 예약어이며 정의처는 시스템 인프라 CSS 단일.
 * 패널 로컬 CSS 가 이들을 **base 정의**(top-level, 조상 스코프 없음)로 선언하면
 * 구조 정본과 경쟁하는 두 번째 소스가 생긴다 — 이 가드가 그 재발을 차단한다.
 *
 * 판정 범위 — **base 정의만**:
 * - 대상: 조상 스코프 없이 예약 클래스 **단독**으로 선언한 규칙
 *   (`.panel-tabs {`, `.panel-tab:hover {`). `@layer` 는 스코프로 세지 않는다.
 * - 비대상 1 — 조상 스코프 안의 contextual override
 *   (NodesPanel `.nodes-panel-content` 안의 `.section { .section-content { … } }`,
 *   `.section[data-section-id] .section-content`).
 * - 비대상 2 — 인스턴스 한정 override: 같은 compound 에 고유 클래스나 속성이
 *   덧붙은 형태 (`.section.block-view`, `.section[data-section-id="schema-preview"]`).
 *   구조 정본을 대체하는 두 번째 소스가 아니라 특정 인스턴스만 조정한다.
 *   Phase 4-a 의 `.iconButton` 판정과 같은 기준 — context-scoped 규칙은 정당하다.
 *
 * 회수 이력 (Phase 4-a/4-c): `.section-divider`(ApiEndpointEditor→panel-system),
 * `.panel-tabs`/`.panel-tab`(→`.datatable-*`), `.panel-selection`/`.panel-option`
 * (→`.datatable-creator-mode*`), `.section-tabs`/`.section-tab`
 * (→`.datatable-creator-tab*`), `.section-header*`(→`.variable-editor-section-*`).
 */

/** 구조 클래스의 정당한 정의처 (repo-relative). 여기 밖에서는 base 정의 금지. */
const INFRA_ALLOWLIST = [
  "components/styles/panel-system.css",
  "components/styles/panel-btn.css",
  "components/styles/inspector-layout.css",
  "components/styles/form-controls.css",
  "components/styles/list-group.css",
  "layout/PanelWorkspace.css",
  "styles/modules/builder-control-group.css",
  "styles/layout/canvas.css",
] as const;

const RESERVED = /^\.(panel|section|fieldset|tab)(-[a-z0-9-]+)?$/;

const BUILDER_ROOT = resolve(__dirname, "../..");

async function collectCssFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await collectCssFiles(full)));
    } else if (e.name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * base 정의 = 조상 스코프 없이 선언된 예약 클래스 규칙.
 *
 * 중괄호 depth 를 추적하되 `@`-rule(@layer/@media/@supports)은 스코프로 세지
 * 않는다 — `@layer x { .panel-tabs { … } }` 도 base 정의다.
 */
function findBaseReservedRules(css: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = stripped.split("\n");
  const offenders: string[] = [];
  /** 조상 selector 스코프 깊이 (@-rule 제외) */
  let selectorDepth = 0;

  for (const raw of lines) {
    const line = raw.trim();
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (opens > 0 && selectorDepth === 0) {
      const prelude = line.slice(0, line.indexOf("{")).trim();
      const isAtRule = prelude.startsWith("@");
      if (!isAtRule) {
        // 콤마 분리 후 각 선택자의 첫 compound 만 검사 — 조상이 있으면 base 아님
        for (const sel of prelude.split(",")) {
          const s = sel.trim();
          if (!s) continue;
          // 결합자(공백/>/+/~)가 있으면 조상 스코프 존재 → contextual
          if (/[\s>+~]/.test(s)) continue;
          const first = s.match(/^\.[a-zA-Z0-9_-]+/)?.[0];
          if (!first || !RESERVED.test(first)) continue;
          // 같은 compound 에 고유 클래스/속성이 덧붙으면 인스턴스 한정 override
          const rest = s.slice(first.length);
          if (/[.[]/.test(rest)) continue;
          offenders.push(s);
        }
      }
    }

    // depth 갱신: @-rule 은 selector 스코프로 세지 않음
    if (opens > 0) {
      const prelude = line.slice(0, line.indexOf("{")).trim();
      const isAtRule = prelude.startsWith("@");
      selectorDepth += isAtRule ? 0 : opens;
    }
    if (closes > 0) selectorDepth = Math.max(0, selectorDepth - closes);
  }
  return offenders;
}

describe("예약 prefix 정적 가드 (ADR-163 §2)", () => {
  it("패널 로컬 CSS 는 구조 예약 클래스를 base 정의로 선언하지 않는다", async () => {
    const files = await collectCssFiles(BUILDER_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(BUILDER_ROOT, file).replaceAll("\\", "/");
      if (INFRA_ALLOWLIST.some((a) => rel === a)) continue;
      const css = await readFile(file, "utf-8");
      for (const sel of findBaseReservedRules(css)) {
        violations.push(`${rel}: ${sel}`);
      }
    }

    expect(
      violations,
      [
        "구조 예약 prefix(panel-*/section-*/fieldset-*/tab-*) 를 패널 로컬 CSS 가 base 정의로 선언했다.",
        "도메인 접두 고유 클래스로 rename 하거나(.datatable-tabs 사례),",
        "구조 정본이 맞다면 panel-system.css 로 승격하라(.section-divider 사례).",
        "",
        ...violations,
      ].join("\n"),
    ).toEqual([]);
  });

  it("allowlist 는 실제 존재하는 인프라 파일만 담는다 (stale 방지)", async () => {
    const files = (await collectCssFiles(BUILDER_ROOT)).map((f) =>
      relative(BUILDER_ROOT, f).replaceAll("\\", "/"),
    );
    const missing = INFRA_ALLOWLIST.filter((a) => !files.includes(a));
    expect(missing, `allowlist stale 항목: ${missing.join(", ")}`).toEqual([]);
  });
});
