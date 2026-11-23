/**
 * S2 체크리스트 §4.1 TokenField Phase 1 (2026-11-22) — S2 에 TokenField 가 없어 `TextArea` 를 따른다
 * (`TextField.tsx` — FieldLabel + FieldGroup + HelpText): 상자는 control Group (S2 `FieldGroup`) 이 Input rule
 * 의 크기별 값 · 상태 트리로 그리고, 안의 TokenInput (RAC contenteditable) 은 상자를 내려놓는다. 크기는
 * TextArea 처럼 S · M · L · XL 이고 field 의 size 가 Group 을 건너 TokenInput · Token 에 닿는다.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { tokenFieldBinding } from "../../../../../../packages/shared/src/catalog/bindings/TokenField.binding";
import { catalogFieldBoxStyle } from "../../../../../../packages/shared/src/catalog/runtime/fieldPrefix";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas, catalogCanvasNodeData } from "../canvasBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import type {
  SkiaNodeData,
  SkiaTextRun,
} from "../../workspace/canvas/skia/nodeRendererTypes";
import type { CatalogTextMeasure } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";

const BODY = "project:node:home-body" as NodeId;

/**
 * A measure with width (0.5 em a character, a run's chip `inset` at each end) and lines (the width over
 * `maxWidth`, rounded up) — the jsdom default measures no text.
 */
const wrapMeasure: CatalogTextMeasure = (text, font, maxWidth, runs) => {
  const width =
    text.length * font.fontSize * 0.5 +
    (runs ?? []).reduce((sum, run) => sum + 2 * (run.inset ?? 0), 0);
  const line = font.fontSize * (font.lineHeight || 1.2);
  const lines =
    maxWidth === undefined ? 1 : Math.max(1, Math.ceil(width / maxWidth));
  return {
    width: maxWidth ?? width,
    exactWidth: width,
    minWidth: font.fontSize * 0.5 * 8,
    height: lines * line,
  };
};

async function fixture(
  props: Record<string, unknown> = {},
  inForm?: Record<string, unknown>,
  textMeasure?: CatalogTextMeasure,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-tokenfield" as EntryId<"project">,
        name: "S2 TokenField",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-tokenfield-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
      ...(textMeasure ? { textMeasure } : {}),
    },
  );
  const insert = (type: string, at: NodeId, p: Record<string, unknown>) =>
    workspace.execute(
      catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          records: workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (id) => workspace.itemOfRecord(id),
          pageContent: () => ({ kind: "node", id: at }),
          newId: workspace.newId,
        },
        type,
        p,
      )!,
    );
  let at = BODY;
  if (inForm) {
    insert("Form", BODY, inForm);
    const form = [...workspace.root.canvasInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "Form",
    )!;
    at = form.sourceId as NodeId;
  }
  insert("TokenField", at, { value: "", ...props });
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type)!;
  const rect = (type: string) =>
    root.getGeometry([of(type).id]).get(of(type).id)!;
  return { workspace, root, of, rect };
}

describe("S2 §4.1 TokenField — 상자 = control Group (S2 TextArea 의 FieldGroup)", () => {
  it("원본 구조: TokenField > FieldLabel + Group > TokenInput + Description", async () => {
    const { root, of } = await fixture();
    const input = of("TokenInput");
    const group = root.canvasInputs.get(input.parentId!)!;
    expect(root.typeOf(group)).toBe("Group");
    expect(root.typeOf(root.canvasInputs.get(group.parentId!)!)).toBe(
      "TokenField",
    );
  });

  it("rule: 크기는 TextArea 처럼 S · M · L · XL, TokenInput 은 자기 상자 (칠 · 테두리 · 모서리 · 여백) 가 없다", () => {
    const rules = COMPONENT_RULES_TABLE as Record<
      string,
      { sizes?: Record<string, Record<string, unknown>>; variants?: unknown }
    >;
    const steps = Object.keys(rules.TextArea!.sizes!);
    expect(Object.keys(rules.TokenField!.sizes!)).toEqual(steps);
    expect(Object.keys(rules.TokenInput!.sizes!)).toEqual(steps);
    expect(Object.keys(rules.Token!.sizes!)).toEqual(steps);
    for (const size of Object.values(rules.TokenInput!.sizes!)) {
      for (const key of ["paddingX", "paddingY", "borderWidth"])
        expect(size[key], key).toBeUndefined();
      expect(size.borderRadius ?? 0).toBe(0);
    }
    const paint = JSON.stringify(rules.TokenInput!.variants ?? {});
    expect(paint).not.toMatch(/borderColor/);
    expect(paint).toContain('"backgroundColor":"{color.transparent}"');
  });

  it.each(["S", "M", "L", "XL"])(
    "Canvas %s — Group 이 Input rule 의 상자 (테두리 · 여백), TokenInput 은 그 안을 채운다",
    async (size) => {
      const { workspace, of, rect } = await fixture();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: of("TokenField").sourceId as NodeId }],
          props: { size: { kind: "set", value: size } },
        }),
      );
      expect(of("TokenInput").props.size).toBe(size);
      const box = catalogFieldBoxStyle(size, "TokenField");
      const group = rect("Group");
      const input = rect("TokenInput");
      // the input sits inside the box's padding + border on every side
      expect(input.x).toBeCloseTo(box.paddingLeft + box.borderWidth, 1);
      expect(input.y).toBeCloseTo(box.paddingTop + box.borderWidth, 1);
      expect(group.width - input.width).toBeCloseTo(
        box.paddingLeft + box.paddingRight + 2 * box.borderWidth,
        1,
      );
      expect(group.height - input.height).toBeCloseTo(
        box.paddingTop + box.paddingBottom + 2 * box.borderWidth,
        1,
      );
    },
  );

  it("Canvas — 두 줄 값 (allowsNewlines) 은 TokenInput 이 두 줄 높이, Group 이 그만큼 자란다 (DOM `pre-wrap`)", async () => {
    const one = await fixture({ value: "Line one @person " });
    const two = await fixture({
      allowsNewlines: true,
      value: "Line one @person\nLine two #tag ",
    });
    const line = one.rect("TokenInput").height;
    // (the rule's `pre-wrap` reaches the Canvas text — the browser measure collapses `\n` without it)
    expect(two.of("TokenInput").visual?.whiteSpace).toBe("pre-wrap");
    expect(two.of("Token").visual?.whiteSpace).toBe("nowrap");
    expect(two.rect("TokenInput").height).toBeCloseTo(2 * line, 1);
    expect(two.rect("Group").height - one.rect("Group").height).toBeCloseTo(
      line,
      1,
    );
    // the Canvas draws it — the carried `white-space` is not an unsupported visual
    for (const f of [one, two]) {
      const canvas = bindCatalogCanvas(f.root, [f.of("TokenField").id]);
      canvas.dispose();
    }
  });

  it("Canvas — 긴 값은 칸 폭에서 줄바꿈하고 TokenInput · Group 이 그만큼 자란다 (RAC contenteditable `pre-wrap`)", async () => {
    const value = "Ask @alexandra about #design-system and @morgan with #frontend-tokens today ";
    const wide = await fixture({ value }, undefined, wrapMeasure);
    const narrow = await fixture({ value }, undefined, wrapMeasure);
    narrow.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: narrow.of("TokenField").sourceId as NodeId }],
        sizing: { width: { kind: "set", value: 200 } },
      }),
    );
    const line = wide.rect("TokenInput").height;
    expect(narrow.rect("TokenInput").height).toBeGreaterThan(1.5 * line);
    expect(narrow.rect("Group").height - wide.rect("Group").height).toBeCloseTo(
      narrow.rect("TokenInput").height - line,
      1,
    );
  });

  it("Canvas 측정 — 토큰 구간이 칩의 좌우 자리 (padding + 테두리) 를 측정에 넣는다 (Publish inline 상자의 폭)", async () => {
    const calls: { runs?: readonly { inset?: number }[] }[] = [];
    const spy: CatalogTextMeasure = (text, font, maxWidth, runs) => {
      calls.push({ runs });
      return wrapMeasure(text, font, maxWidth, runs);
    };
    await fixture({ value: "Hi @person and #tag " }, undefined, spy);
    const measured = calls.find((call) => call.runs?.some((run) => run.inset));
    // M: padding 6 + border 1, the two tokens only
    expect(measured?.runs?.map((run) => run.inset ?? 0)).toEqual([0, 7, 0, 7, 0]);
  });

  it("라벨 색 = S2 TextArea 처럼 field 의 상태 트리 — disabled 면 disabled 글자색 (Canvas 파생 · 생성 CSS)", async () => {
    const enabled = await fixture();
    const disabled = await fixture({ isDisabled: true });
    const label = (f: Awaited<ReturnType<typeof fixture>>) =>
      f.of("Label").derivedProps?.color;
    expect(label(disabled)).toBeDefined();
    expect(label(disabled)).not.toBe(label(enabled));
    const rules = COMPONENT_RULES_TABLE as Record<string, unknown>;
    expect(JSON.stringify(rules.TokenField)).toContain(
      '"isDisabled":"{color.disabled-content}"',
    );
  });

  it("binding: labelPosition (top · side) · labelAlign (side 에서만) — S2 TextArea 와 같은 선택지", () => {
    const accepts = (
      tokenFieldBinding.props as {
        accepts: Record<string, { options?: { value: string }[]; visibleWhen?: unknown }>;
      }
    ).accepts;
    expect(accepts.labelPosition?.options?.map((o) => o.value)).toEqual([
      "top",
      "side",
    ]);
    expect(accepts.labelAlign?.options?.map((o) => o.value)).toEqual([
      "start",
      "end",
    ]);
    expect(accepts.labelAlign?.visibleWhen).toEqual({
      key: "labelPosition",
      equals: "side",
    });
  });

  it("side: 라벨 행은 1열, 상자 Group 은 2열 맨 위 — 라벨은 입력 첫 줄에 (Canvas), DOM 에 data-label-position", async () => {
    const { root, of, rect } = await fixture({ labelPosition: "side" });
    const row = rect("FieldLabel");
    const group = rect("Group");
    expect(row.x).toBe(0);
    expect(group.x).toBeGreaterThanOrEqual(row.width);
    expect(group.y).toBe(0);
    // (the label at the TokenInput's first line — `--tf-side-label-offset` M 7)
    expect(row.y).toBeCloseTo(7, 0);
    const html = renderToStaticMarkup(
      renderCatalogDom(root, of("TokenField").id),
    );
    expect(html).toMatch(/class="react-aria-TokenField[^"]*"[^>]*data-label-position="side"|data-label-position="side"[^>]*class="react-aria-TokenField/);
  });

  it("labelAlign end: Canvas 라벨 행이 끝 정렬, DOM 에 data-label-align", async () => {
    const start = await fixture({ labelPosition: "side" });
    const end = await fixture({ labelPosition: "side", labelAlign: "end" });
    expect(start.of("FieldLabel").layout?.justifyContent).toBe("start");
    expect(end.of("FieldLabel").layout?.justifyContent).toBe("end");
    expect(
      renderToStaticMarkup(renderCatalogDom(end.root, end.of("TokenField").id)),
    ).toContain('data-label-align="end"');
  });

  it("Form 상속: side Form 안의 TokenField 는 Form 의 labelPosition · labelAlign · size · isDisabled 를 받는다", async () => {
    const { of } = await fixture(
      {},
      { labelPosition: "side", labelAlign: "end", size: "L", isDisabled: true },
    );
    const field = of("TokenField");
    expect(field.props.labelPosition).toBe("side");
    expect(field.props.labelAlign).toBe("end");
    expect(field.props.size).toBe("L");
    expect(field.props.isDisabled).toBe(true);
    expect(of("TokenInput").props.size).toBe("L");
  });

  it("Token 모양 = design-data tag-field 의 S2 Tag 칠 — 줄 안 inline 칩 (rule · 생성 CSS · DOM data-variant)", async () => {
    type Tree = Record<string, unknown>;
    type Rule = {
      variants: { default: { paint: Record<string, Tree> } };
      sizes: Record<string, Record<string, unknown>>;
      structure: { containerStyles: Record<string, unknown> };
    };
    const rules = COMPONENT_RULES_TABLE as unknown as Record<string, Rule>;
    const token = rules.Token!;
    expect(token.variants.default.paint).toEqual({
      backgroundColor: { default: "{color.layer-1}", isSelected: "{color.neutral}" },
      color: {
        default: "{color.neutral}",
        isSelected: "{color.base}",
        isDisabled: "{color.disabled-content}",
      },
      borderColor: { default: "{color.border}", isSelected: "{color.neutral}" },
    });
    // (the Tag's own tree — the same rest · selected values)
    const tag = rules.Tag!.variants.default.paint;
    expect(token.variants.default.paint.backgroundColor!.default).toBe(tag.backgroundColor!.default);
    expect(token.variants.default.paint.borderColor!.isSelected).toBe(
      (tag.borderColor!.isSelected as Tree).default,
    );
    expect(
      Object.fromEntries(Object.entries(token.sizes).map(([k, v]) => [k, [v.paddingX, v.paddingY, v.borderRadius, v.borderWidth]])),
    ).toEqual({
      S: [5, 0, "{radius.sm}", "{border.width.thin}"],
      M: [6, 0, "{radius.sm}", "{border.width.thin}"],
      L: [7, 0, "{radius.sm}", "{border.width.thin}"],
      XL: [8, 0, "{radius.sm}", "{border.width.thin}"],
    });
    // an inline box — the line height stays the TokenInput's
    expect(token.structure.containerStyles.display).toBe("inline");
    const { root, of } = await fixture({ value: "Hi @person " });
    const html = renderToStaticMarkup(renderCatalogDom(root, of("TokenField").id));
    const span = html.match(/<span[^>]*react-aria-Token[^>]*>/)?.[0] ?? "";
    expect(span).toContain('data-variant="default"');
    expect(span).toContain('data-size="M"');
  });

  it("Canvas — 토큰 구간이 Token rule 의 칩 (좌우 여백 + 테두리 · 모서리 · 칠) 을 든다, 크기 · disabled 를 따른다", async () => {
    const chipRuns = (f: Awaited<ReturnType<typeof fixture>>) => {
      const find = (d: SkiaNodeData): SkiaTextRun[] | undefined =>
        d.text?.runs
          ? [...d.text.runs]
          : (d.children ?? []).map(find).find(Boolean);
      return find(catalogCanvasNodeData(f.root, f.of("TokenInput").id))!;
    };
    const m = await fixture({ value: "Hi @person and #tag " });
    const runs = chipRuns(m);
    const chips = runs.filter((run) => run.chip);
    expect(chips.map((run) => [run.start, run.end])).toEqual([
      [3, 10],
      [15, 19],
    ]);
    // M: padding 6 + border 1 · radius sm 4
    expect(chips[0]!.chip).toMatchObject({ inset: 7, borderWidth: 1, radius: 4 });
    expect(chips[0]!.chip!.fill).toBeDefined();
    expect(chips[0]!.chip!.stroke).toBeDefined();
    expect(runs.filter((run) => !run.chip)).toHaveLength(runs.length - 2);
    const l = await fixture({ value: "Hi @person ", size: "L" });
    expect(chipRuns(l).find((run) => run.chip)!.chip!.inset).toBe(8);
    const off = await fixture({ value: "Hi @person ", isDisabled: true });
    const on = chipRuns(m).find((run) => run.chip)!.color!;
    expect(Array.from(chipRuns(off).find((run) => run.chip)!.color!)).not.toEqual(
      Array.from(on),
    );
  });

  it("DOM — Group 이 S2 FieldGroup (`react-aria-FieldBox` · presentation · size), 필드의 disabled 를 받는다", async () => {
    const { workspace, root, of } = await fixture();
    const html = () =>
      renderToStaticMarkup(renderCatalogDom(root, of("TokenField").id));
    const group = () =>
      html().match(/<div[^>]*react-aria-FieldBox[^>]*>/)?.[0] ?? "";
    expect(group()).toContain('role="presentation"');
    expect(group()).toContain('data-size="M"');
    expect(group()).not.toContain("data-disabled");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: of("TokenField").sourceId as NodeId }],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
    expect(group()).toContain("data-disabled");
    // the TokenInput lays its box down — no border · fill of its own
    const input = html().match(/<div[^>]*react-aria-TokenInput[^>]*>/)?.[0];
    expect(input).toMatch(/border-width:0/);
    expect(input).toMatch(/background:transparent/);
  });
});
