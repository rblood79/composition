/**
 * 빌더 팝업 목록 정본 가드 (2026-11-09) — `builder-popup-list.css` 가 Select · ComboBox · 고르기 팝오버
 * 목록의 행 모양 · hover · 선택 ✓ · 구역 머리글을 한 곳에서 정한다.
 *
 * (a) 안에 ListBox 를 그리는 `<Popover>` 마다 className 에 `BUILDER_POPUP_LIST_CLASS` 가 있다
 *     (Popover 단위 — 파일 단위였을 때 VariableTable 의 셀 유형 목록이 같은 파일의 다른 Popover 덕에
 *     빠져나갔다).
 * (b) 패널 · 컴포넌트 CSS 는 ListBoxItem 의 hover · focus 칠을 따로 선언하지 않는다.
 * (c) RAC `Select` 는 `PanelSelect.tsx` 에서만 쓴다 — Select · 팝오버 · 목록 틀은 한 벌.
 * (d) 검색되는 고르기 팝오버 (RAC `Autocomplete` + ListBox) 는 `SearchablePicker.tsx` 로만 만든다.
 * (e) 팝업 목록 ListBox 의 안쪽 여백은 0 또는 `--spacing-xs` (첫 행이 테두리에서 4 + 1) — 2026-11-10 사용자
 *     지적: 글꼴 목록만 `.font-picker-list { padding: 8 }` 이라 다른 목록 (4) 과 달랐다 (그 뒤 글꼴 고르기도
 *     SearchablePicker 로 옮겼다).
 *
 * Why: catalog Select · ComboBox 목록은 hover 행이 gray-200 으로 뚜렷한데, 빌더 목록은 `--bg-raised` 위에
 * `--bg-overlay` 를 칠해 hover 가 거의 안 보였다. 파일 다섯이 같은 행 규칙을 따로 적어 값이 갈렸다
 * (`--bg-overlay` · `--bg-muted` · 없음), 구역 머리글도 다섯 벌이었다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import postcss, { type Container, type Rule } from "postcss";
import ts from "typescript";
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
};

const tagName = (el: ts.JsxElement | ts.JsxSelfClosingElement) =>
  (ts.isJsxElement(el) ? el.openingElement : el).tagName.getText();

/** 파일의 `<Popover>` 중 안에 `<ListBox>` 가 있는 것마다 [줄, className 글자] */
function popoverListBoxes(file: string): { line: number; className: string }[] {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const hasListBox = (node: ts.Node): boolean =>
    ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      tagName(node) === "ListBox") ||
    (ts.forEachChild(node, (c) => hasListBox(c) || undefined) ?? false);
  const out: { line: number; className: string }[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxElement(node) &&
      tagName(node) === "Popover" &&
      hasListBox(node)
    ) {
      const attr = node.openingElement.attributes.properties.find(
        (p) => ts.isJsxAttribute(p) && p.name.getText() === "className",
      );
      out.push({
        line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        className: attr?.getText() ?? "",
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

describe("빌더 팝업 목록 정본 (a) — 목록 Popover 마다 class", () => {
  const cases = walk(BUILDER, /\.tsx$/)
    .filter((f) => !NOT_A_POPUP_LIST[relative(BUILDER, f)])
    .flatMap((f) =>
      popoverListBoxes(f).map((p) => ({
        at: `${relative(BUILDER, f)}:${p.line}`,
        className: p.className,
      })),
    );
  it("대상 Popover 를 찾았다", () => expect(cases.length).toBeGreaterThan(4));
  it.each(cases)("$at", ({ className }) => {
    expect(className).toContain("BUILDER_POPUP_LIST_CLASS");
  });
});

describe("빌더 팝업 목록 정본 (c) — RAC Select 는 PanelSelect 에서만", () => {
  it("react-aria-components/Select 에서 Select 를 가져오는 파일 = PanelSelect.tsx", () => {
    const importers = walk(BUILDER, /\.tsx?$/).filter((f) =>
      /import\s*\{[^}]*\bSelect\b(?!Value)[^}]*\}\s*from\s*"react-aria-components\/Select"/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(importers.map((f) => relative(BUILDER, f))).toEqual([
      "components/property/PanelSelect.tsx",
    ]);
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

/** Autocomplete 를 직접 쓰는 곳 — 고르기 목록이 아닌 것만, 사유를 적는다 */
const AUTOCOMPLETE_ELSEWHERE: Record<string, string> = {
  "components/property/SearchablePicker.tsx": "정본",
  "panels/icons/IconPickerPopover.tsx":
    "아이콘 격자 + 개수 표시 (행 목록 아님)",
  "components/overlay/CommandPalette.tsx": "명령 팔레트 (Menu)",
  "main/headerMenu/HeaderMainMenu.tsx": "헤더 메뉴 검색 (Menu)",
};

describe("빌더 팝업 목록 정본 (d) — 검색 고르기 팝오버는 SearchablePicker", () => {
  it("react-aria-components/Autocomplete 를 쓰는 파일 = 허용 목록", () => {
    const users = walk(BUILDER, /\.tsx?$/)
      .filter((f) =>
        readFileSync(f, "utf8").includes(
          '"react-aria-components/Autocomplete"',
        ),
      )
      .map((f) => relative(BUILDER, f))
      .sort();
    expect(users).toEqual(Object.keys(AUTOCOMPLETE_ELSEWHERE).sort());
  });
});

/** 목록 Popover 안 ListBox 의 class (+ SearchablePicker 호출부의 `listClassName`) — react-aria-* 제외 */
function popupListClasses(file: string): string[] {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const tokens = (text: string) =>
    (text.match(/[a-z][\w-]*/g) ?? []).filter(
      (t) => t.includes("-") && !t.startsWith("react-aria"),
    );
  const out: string[] = [];
  const attrText = (el: ts.JsxOpeningLikeElement, name: string) =>
    el.attributes.properties
      .find((p) => ts.isJsxAttribute(p) && p.name.getText() === name)
      ?.getText() ?? "";
  const visit = (node: ts.Node, inPopupList: boolean) => {
    let inside = inPopupList;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      const name = tagName(node);
      if (
        name === "Popover" &&
        attrText(open, "className").includes("BUILDER_POPUP_LIST_CLASS")
      )
        inside = true;
      if (name === "ListBox" && inside)
        out.push(
          ...tokens(attrText(open, "className").replace(/^className=/, "")),
        );
      const list = attrText(open, "listClassName");
      if (list) out.push(...tokens(list.replace(/^listClassName=/, "")));
    }
    ts.forEachChild(node, (c) => visit(c, inside));
  };
  visit(src, false);
  return out;
}

describe("빌더 팝업 목록 정본 (e) — 목록 안쪽 여백 한 값", () => {
  // SearchablePicker 는 ListBox 에 props 를 펼쳐 넘겨 (`{...listProps}`) AST 로 class 를 못 읽는다 — 직접 넣는다.
  const classes = new Set([
    "searchable-picker-list",
    ...walk(BUILDER, /\.tsx$/).flatMap((f) => popupListClasses(f)),
  ]);
  it("팝업 목록 ListBox class 를 찾았다", () => {
    expect(classes.has("react-aria-ListBox")).toBe(false);
    expect(classes.has("component-swap-list")).toBe(true);
  });
  it("panels · components CSS 가 그 class 에 0 · --spacing-xs 밖의 padding 을 주지 않는다", () => {
    const allowed = /^(0|0px|var\(--spacing-xs\))$/;
    const hits: string[] = [];
    const css = walk(join(BUILDER, "panels"), /\.css$/).concat(
      walk(join(BUILDER, "components"), /\.css$/),
    );
    for (const f of css)
      postcss.parse(readFileSync(f, "utf8")).walkRules((rule) => {
        const last = rule.selector
          .split(",")
          .map((x) => x.trim().split(/\s+/).pop() ?? "");
        if (
          !last.some((c) =>
            [...classes].some((k) => new RegExp(`\\.${k}(?![\\w-])`).test(c)),
          )
        )
          return;
        rule.each((n) => {
          if (n.type !== "decl" || !/^padding/.test(n.prop)) return;
          if (!n.value.split(/\s+/).every((v) => allowed.test(v)))
            hits.push(
              `${relative(BUILDER, f)}: ${rule.selector} { ${n.prop}: ${n.value} }`,
            );
        });
      });
    expect(hits).toEqual([]);
  });
});
