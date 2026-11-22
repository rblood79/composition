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
import { catalogFieldBoxStyle } from "../../../../../../packages/shared/src/catalog/runtime/fieldPrefix";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas } from "../canvasBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

async function fixture(props: Record<string, unknown> = {}) {
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
    },
  );
  const command = catalogPaletteInsertCommand(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: BODY }),
      newId: workspace.newId,
    },
    "TokenField",
    { value: "", ...props },
  );
  workspace.execute(command!);
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
