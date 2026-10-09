// @vitest-environment jsdom
/**
 * S2 1.8.0 field side label (사용자 2026-10-10 「text, number, search, date, time, color, date
 * picker, date range 모든 field 컴퍼넌트들과 picker 컴퍼넌트들 Label Position - Side 로 변경시
 * label width 가 fit content 로 지정 되지않았거나 … slider 와 같은 패턴의 문제다」): S2 `field()`
 * (`style-utils.ts`) lays a side field out as a grid — `gridTemplateColumns: ['auto', '1fr']`,
 * areas `'label input' / 'label helptext'`. The label column is its text's width, the control takes
 * the rest, and the help text sits under the control at its x; the label is in the middle of the
 * control's row (S2 `alignItems: 'baseline'` — no grid baseline in the engine). Before, the label was a fixed 176px
 * (11rem) column. In a side Form its fields keep one shared label column (`--form-label-width`
 * 11rem, inherited at any depth — S2 aligns them with a subgrid).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const FORM = "project:node:form" as NodeId;
const OWNER = "project:node:owner" as NodeId;
const GENERATED = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated",
);
/** A fixed-advance text measure (no fonts here) — a fit-content label gets its text's width. */
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});
const set = <T>(value: T) => ({ kind: "set" as const, value });

/** The field types with a side label column (their sheet: TextArea draws as a TextField). */
const FIELDS = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "Select",
  "ComboBox",
  "CheckboxGroup",
  "RadioGroup",
] as const;
const HINTS = new Set(["Label", "Description", "FieldError"]);

async function open(type: string, inForm?: "side" | "top") {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:field-side-label" as const,
        name: "Field side label",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `field-side-label-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  const entry = (
    id: NodeId,
    kind: string,
    props: NodeEntry["props"],
  ): NodeEntry =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library, kind),
      children: [],
      props,
      visual: {},
      sizing: { width: set(420) },
      descendantOverrides: [],
    }) as NodeEntry;
  if (inForm)
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [entry(FORM, "Form", { labelPosition: set(inForm) } as never)],
        rootIds: [FORM],
        newId: workspace.newId,
      }),
    );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: inForm ? FORM : BODY },
      entries: [
        entry(OWNER, type, {
          labelPosition: set("side"),
          description: set("Help"),
        } as never),
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = [...root.domInputs.values()].find(
    (record) => record.sourceId === OWNER,
  )!;
  const children = owner.children.map((id) => root.canvasInputs.get(id)!);
  const of = (kind: string) =>
    children.find((record) => root.typeOf(record) === kind)!;
  const control = children.find((record) => !HINTS.has(root.typeOf(record)))!;
  const ids = [of("Label").id, control.id, of("Description").id, owner.id];
  const box = (id: string) =>
    root.getGeometry([id]).get(id) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  /** The Form's label position, edited (the fields take it again — and its label column). */
  const setForm = (labelPosition: string) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FORM }],
        props: { labelPosition: set(labelPosition) as never },
      }),
    );
  return {
    label: box(ids[0]!),
    control: box(ids[1]!),
    description: box(ids[2]!),
    owner: box(ids[3]!),
    labelWidth: () => box(ids[0]!).width,
    setForm,
  };
}

describe.each(FIELDS)("S2 %s side label", (type) => {
  it("the label is its text's width, the control takes the rest, the help text sits under it", async () => {
    const { label, control, description, owner } = await open(type);
    // (not the old 176px column)
    expect(label.width).toBeGreaterThan(0);
    expect(label.width).toBeLessThan(100);
    // Vertically: S2 aligns the label's baseline with the control's text — a one-line control's
    // middle (사용자 2026-10-10 「label 의 세로 위치는 가운데 정렬」); a group's label sits at its
    // first item's line (the top).
    if (type === "CheckboxGroup" || type === "RadioGroup")
      expect(label.y).toBe(control.y);
    // A TextArea's label at the textarea's first line — its top, below the border + padding (M: 5)
    // — not its middle (사용자 2026-10-10 「Text Area 는 상단 위치해야하지만 여백은 가져야 한다」).
    else if (type === "TextArea") expect(label.y - control.y).toBe(5);
    else
      expect(label.y + label.height / 2).toBeCloseTo(
        control.y + control.height / 2,
        0,
      );
    expect(control.x).toBeGreaterThan(label.x + label.width);
    // (A ColorField's input stops at its per-size max width — `--cf-input-max-width`.)
    if (type === "ColorField")
      expect(control.x + control.width).toBeLessThanOrEqual(owner.width);
    else expect(control.x + control.width).toBeCloseTo(owner.width, 0);
    expect(description.x).toBeCloseTo(control.x, 0);
    expect(description.y).toBeGreaterThan(control.y);
  });

  it("in a side Form the label is the Form's shared column (11rem)", async () => {
    const { label, control, description } = await open(type, "side");
    expect(label.width).toBe(176);
    expect(description.x).toBeCloseTo(control.x, 0);
  });

  it("in a top Form a side field's label is its text's width", async () => {
    const { label } = await open(type, "top");
    expect(label.width).toBeLessThan(100);
  });

  it("the Form's label position edited: the column comes and goes", async () => {
    const { labelWidth, setForm } = await open(type, "top");
    setForm("side");
    expect(labelWidth()).toBe(176);
    setForm("top");
    expect(labelWidth()).toBeLessThan(100);
  });
});

describe("the sheets", () => {
  it.each(FIELDS.filter((type) => type !== "TextArea"))(
    "%s: a side field is a grid of an auto label column and the rest",
    (type) => {
      const sheet = readFileSync(`${GENERATED}/${type}.css`, "utf8");
      const side = `.react-aria-${type}[data-label-position="side"]`;
      const block = (selector: string) =>
        new RegExp(
          `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
        ).exec(sheet)?.[1] ?? "";
      expect(block(side)).toMatch(/display: grid;/);
      expect(block(side)).toMatch(
        /grid-template-columns: auto minmax\(0, 1fr\);/,
      );
      const label = block(`${side} > .react-aria-Label`);
      expect(label).toMatch(/width: var\(--form-label-width\);/);
      expect(label).not.toMatch(/11rem|flex-shrink/);
      expect(block(`${side} > .react-aria-FieldError`)).toMatch(
        /grid-column: 2;/,
      );
      expect(sheet).not.toMatch(/side-gap/);
    },
  );

  it("a side Form gives its fields the shared label column", () => {
    const sheet = readFileSync(`${GENERATED}/Form.css`, "utf8");
    expect(sheet).toMatch(
      /\.react-aria-Form\[data-label-position="side"\]\s*\{\s*--form-label-width: 11rem;/,
    );
  });
});
