/**
 * 빌더 팝업 목록 정본 가드 (2026-11-09) — `builder-popup-list.css` 가 Select · ComboBox · 고르기 팝오버
 * 목록의 행 모양 · hover · 선택 ✓ · 구역 머리글을 한 곳에서 정한다.
 *
 * (a) Popover 안에 ListBox 를 그리는 파일은 목록 Popover 에 `BUILDER_POPUP_LIST_CLASS` 를 붙인다.
 * (b) 패널 · 컴포넌트 CSS 는 ListBoxItem 의 hover · focus 칠을 따로 선언하지 않는다.
 *
 * Why: catalog Select · ComboBox 목록은 hover 행이 gray-200 으로 뚜렷한데, 빌더 목록은 `--bg-raised` 위에
 * `--bg-overlay` 를 칠해 hover 가 거의 안 보였다. 파일 다섯이 같은 행 규칙을 따로 적어 값이 갈렸다
 * (`--bg-overlay` · `--bg-muted` · 없음), 구역 머리글도 다섯 벌이었다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import postcss, { type Container, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const BUILDER = join(import.meta.dirname, "../..");

const walk = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "__tests__"
        ? []
        : walk(join(dir, e.name), ext)
      : ext.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

/** 목록 Popover 가 아닌 것 — 사유를 적는다 */
const NOT_A_POPUP_LIST: Record<string, string> = {
  "panels/icons/IconPickerPopover.tsx": "아이콘 격자 (행 목록 아님)",
  "panels/codeView/CatalogCodeViewPanel.tsx":
    "Popover 는 행 메뉴 (Menu) · ListBox 는 패널 안 파일 목록",
};

describe("빌더 팝업 목록 정본 (a) — 목록 Popover 의 class", () => {
  const files = walk(BUILDER, /\.tsx$/).filter((f) => {
    const s = readFileSync(f, "utf8");
    return /<Popover\b/.test(s) && /<ListBox\b/.test(s);
  });
  it("대상 파일을 찾았다", () => expect(files.length).toBeGreaterThan(5));
  it.each(files.map((f) => relative(BUILDER, f)))("%s", (rel) => {
    if (NOT_A_POPUP_LIST[rel]) return;
    expect(readFileSync(join(BUILDER, rel), "utf8")).toContain(
      "BUILDER_POPUP_LIST_CLASS",
    );
  });
});

describe("빌더 팝업 목록 정본 (b) — 행 hover · focus 칠은 정본 한 곳", () => {
  const selectorChain = (rule: Rule): string => {
    const parts: string[] = [rule.selector];
    for (
      let p = rule.parent as Container | undefined;
      p;
      p = p.parent as Container | undefined
    )
      if (p.type === "rule") parts.unshift((p as Rule).selector);
    return parts.join(" ");
  };
  const css = walk(join(BUILDER, "panels"), /\.css$/).concat(
    walk(join(BUILDER, "components"), /\.css$/),
  );
  it("panels · components CSS 에 ListBoxItem hover · focus 배경 선언 0", () => {
    const hits: string[] = [];
    for (const f of css) {
      postcss.parse(readFileSync(f, "utf8")).walkRules((rule) => {
        const chain = selectorChain(rule);
        if (!/ListBoxItem|font-picker-item/.test(chain)) return;
        if (!/data-hovered|data-focused|:hover/.test(chain)) return;
        rule.each((n) => {
          if (n.type === "decl" && /^background/.test(n.prop))
            hits.push(`${relative(BUILDER, f)}: ${chain}`);
        });
      });
    }
    expect(hits).toEqual([]);
  });
});
