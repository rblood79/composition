import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogTokenSegments } from "../../../../../../packages/shared/src/catalog/document/tokenFieldValue";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogBuiltinOrigins } from "../layouts";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { editContractFixture } from "./support/editContractFixture";
import { catalogSheetHandleShapes } from "../ruleShapes";
import { CatalogCanvasScene } from "../canvasScene";

const BODY = "project:node:home-body" as NodeId;
async function fixture(
  type: string,
  props: Record<string, unknown> = {},
  viewport = { width: 1200, height: 900 },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rac-additions" as EntryId<"project">,
        name: "RAC additions",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `rac-additions-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport,
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
    type,
    props,
  );
  expect(command).toBeDefined();
  const id = workspace.execute(command!).plan.selectAfter![0];
  return { workspace, library, id };
}

describe("RAC TokenField / PreviewTrigger / Sheet registration", () => {
  it.each(["bottom", "top", "left", "right", "center"])(
    "places the open Sheet at the viewport %s with a full backdrop",
    async (position) => {
      const { workspace } = await fixture("Sheet", { isOpen: true, position });
      const root = workspace.root;
      const of = (type: string) =>
        [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type)!;
      const scene = new CatalogCanvasScene(root);
      try {
        scene.sync();
        const body = scene.stream.boundsMap.get(root.recordsOfSource(BODY)[0])!;
        const overlay = of("SheetOverlay");
        const sheet = scene.stream.boundsMap.get(of("Sheet").id)!;
        const backdrop = scene.stream.boundsMap.get(of("SheetBackdrop").id)!;
        expect(getSkiaNode(overlay.id)?.isFixed).toBe(true);
        // S2 1.8.1 Modal underlay `transparent-black-500` = #00000070 (112/255).
        const scrim = Array.from(
          getSkiaNode(of("SheetBackdrop").id)!.box!.fillColor!,
        );
        expect(scrim.slice(0, 3)).toEqual([0, 0, 0]);
        expect(scrim[3]).toBeCloseTo(112 / 255, 5);
        expect(backdrop).toMatchObject({
          x: body.x,
          y: body.y,
          width: 1200,
          height: 900,
        });
        expect(sheet.x - body.x).toBe(
          position === "left"
            ? 0
            : position === "right"
              ? 1200 - sheet.width
              : (1200 - sheet.width) / 2,
        );
        expect(sheet.y - body.y).toBe(
          position === "top"
            ? 0
            : position === "bottom"
              ? 900 - sheet.height
              : (900 - sheet.height) / 2,
        );
        expect(sheet.width).toBe(360);
        // 텍스트 측정 fixture의 내용 64 + padding 48. 재배치에서 padding을 중복 더하지 않는다.
        expect(sheet.height).toBe(112);
        expect(
          scene.stream.boundsMap.get(of("SheetContent").id)!.height,
        ).toBeCloseTo(sheet.height, 3);
        expect(scene.stream.hitBoundsMap.get(of("Sheet").id)).toBeDefined();
      } finally {
        scene.dispose();
      }
    },
  );

  it("keeps the open Sheet within a narrow viewport and updates the bound scene through Open and undo", async () => {
    const { workspace, id } = await fixture(
      "Sheet",
      { isOpen: true },
      { width: 320, height: 600 },
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const sheetId = [...workspace.root.canvasInputs.values()].find(
      (node) => workspace.root.typeOf(node) === "Sheet",
    )!.id;
    const bounds = () => {
      scene.sync();
      return scene.stream.boundsMap.get(sheetId);
    };
    try {
      const initial = { ...bounds()! };
      expect(initial.width).toBe(320);
      for (let cycle = 0; cycle < 2; cycle++) {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            props: { isOpen: { kind: "set", value: false } },
          }),
        );
        bounds();
        expect(bounds()?.height ?? 0).toBe(0);
        workspace.undo();
        expect(bounds()).toEqual(initial);
      }
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: { position: { kind: "set", value: "top" } },
        }),
      );
      expect(bounds()!.y).toBeLessThan(initial.y);
      workspace.undo();
      expect(bounds()).toEqual(initial);
    } finally {
      scene.dispose();
    }
  });

  it("Sheet handle follows Prevent Dismissal and swipe direction through edit and undo", async () => {
    const { workspace, id } = await fixture("Sheet");
    const sheet = () =>
      [...workspace.root.canvasInputs.values()].find(
        (r) => workspace.root.typeOf(r) === "Sheet",
      )!;
    const handle = () =>
      catalogSheetHandleShapes({
        type: "Sheet",
        node: sheet(),
        rect: { width: 360, height: 200 },
      });
    expect(handle()).toMatchObject([
      { type: "roundRect", x: 140, y: 12, width: 80, height: 6 },
    ]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { preventDismissal: { kind: "set", value: true } },
      }),
    );
    expect(sheet().derivedProps?._sheetHandle).toBe(false);
    expect(handle()).toEqual([]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: {
          preventDismissal: { kind: "set", value: false },
          swipeDirection: { kind: "set", value: "right" },
        },
      }),
    );
    expect(handle()).toMatchObject([{ x: 12, y: 60, width: 6, height: 80 }]);
    workspace.undo();
    expect(handle()).toEqual([]);
    workspace.undo();
    expect(handle()).toMatchObject([{ x: 140, y: 12, width: 80, height: 6 }]);
  });

  it("restores every Sheet descendant rectangle after repeated Open off/on", async () => {
    const { workspace, id } = await fixture("Sheet");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { isOpen: { kind: "set", value: true } },
      }),
    );
    const ids = [...workspace.root.canvasInputs.keys()].filter((recordId) =>
      recordId.includes("component-sheet__"),
    );
    const titleId = ids.find((recordId) =>
      recordId.endsWith("component-sheet__title"),
    )!;
    expect(
      workspace.root.getGeometry([titleId]).get(titleId)!.width,
    ).toBeGreaterThan(0);
    const geometry = () =>
      [...workspace.root.getGeometry(ids)].map(([key, rect]) => [
        key,
        { ...rect },
      ]);
    const opened = geometry();
    expect(opened.length).toBeGreaterThan(5);
    for (let cycle = 0; cycle < 3; cycle++) {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: { isOpen: { kind: "set", value: false } },
        }),
      );
      expect(workspace.root.getGeometry([titleId]).get(titleId)!.width).toBe(0);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id }],
          props: { isOpen: { kind: "set", value: true } },
        }),
      );
      expect(geometry()).toEqual(opened);
    }
  });

  it("Sheet exposes its overlay and content properties on the reusable instance", () => {
    const fields = editContractFixture("Sheet").fields;
    expect(fields.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        "position",
        "swipeDirection",
        "snapPoints",
        "preventDismissal",
        "overscrollPadding",
        "isOpen",
        "defaultOpen",
      ]),
    );
    expect(
      fields
        .find((field) => field.key === "position")
        ?.options?.map((option) => option.value),
    ).toContain("right");
  });

  it("Sheet authored open state updates Canvas presence and honors explicit false through undo", async () => {
    const { workspace, id } = await fixture("Sheet");
    const overlay = () =>
      [...workspace.root.canvasInputs.values()].find(
        (record) => workspace.root.typeOf(record) === "SheetOverlay",
      )!;
    const sheet = () =>
      [...workspace.root.domInputs.values()].find(
        (record) => workspace.root.typeOf(record) === "Sheet",
      )!;
    expect(overlay().hidden).toBe(true);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: {
          defaultOpen: { kind: "set", value: true },
          position: { kind: "set", value: "right" },
          swipeDirection: { kind: "set", value: "right" },
          snapPoints: { kind: "set", value: ["50%", "100%"] },
          preventDismissal: { kind: "set", value: true },
          overscrollPadding: { kind: "set", value: true },
        },
      }),
    );
    expect(overlay().hidden).not.toBe(true);
    expect(overlay().props).toMatchObject({
      position: "right",
      swipeDirection: "right",
      snapPoints: ["50%", "100%"],
      preventDismissal: true,
    });
    expect(sheet().props.overscrollPadding).toBe(true);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { isOpen: { kind: "set", value: false } },
      }),
    );
    expect(overlay().hidden).toBe(true);
    workspace.undo();
    expect(overlay().hidden).not.toBe(true);
    workspace.undo();
    expect(overlay().hidden).toBe(true);
    expect(overlay().props.position).toBe("bottom");
    workspace.redo();
    expect(overlay().hidden).not.toBe(true);
  });

  it.each(["TokenField", "PreviewTrigger", "Sheet"])(
    "%s has a reusable Library origin and inserts its authored parts",
    async (type) => {
      const { workspace, library } = await fixture(type);
      expect(
        catalogBuiltinOrigins(library).some((origin) => origin.name === type),
      ).toBe(true);
      const records = [...workspace.root.domInputs.values()];
      const types = records.map((record) => workspace.root.typeOf(record));
      const parts =
        type === "TokenField"
          ? ["TokenField", "TokenInput", "Token"]
          : type === "Sheet"
            ? ["SheetTrigger", "SheetOverlay", "Sheet", "SheetContent"]
            : ["PreviewTrigger", "Button", "Popover"];
      expect(types).toEqual(expect.arrayContaining(parts));
      if (type === "TokenField")
        expect(
          records.find((record) => workspace.root.typeOf(record) === type)
            ?.props.value,
        ).toBe("Hello @person ");
      if (type === "PreviewTrigger")
        expect(
          records.find((record) => workspace.root.typeOf(record) === type)
            ?.props.isDisabled,
        ).toBe(false);
      if (type === "Sheet")
        expect(
          records.find(
            (record) => workspace.root.typeOf(record) === "SheetOverlay",
          )?.props.preventDismissal,
        ).toBe(false);
    },
  );

  it("TokenField preserves text and produces the same token runs for DOM and Canvas", async () => {
    const value = "안녕 @사용자 #태그 ";
    const { workspace } = await fixture("TokenField", { value });
    const records = [...workspace.root.domInputs.values()];
    const root = records.find(
      (record) => workspace.root.typeOf(record) === "TokenField",
    )!;
    const input = records.find(
      (record) => workspace.root.typeOf(record) === "TokenInput",
    )!;
    expect(input.props.children).toBe(value);
    expect(input.textRuns?.map((run) => run.text).join("")).toBe(value);
    expect(
      input.textRuns
        ?.filter((run) => run.marks?.fontWeight === 600)
        .map((run) => run.text),
    ).toEqual(["@사용자", "#태그"]);
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, root.id),
    );
    expect(html).toContain('contentEditable="true"');
    expect(html).toContain("react-aria-Token");
    expect(html).toContain("@사용자");
    expect(html).toContain("#태그");
    expect(html).not.toContain("{tokenText}");
    const canvas = bindCatalogCanvas(workspace.root, [root.id]);
    const drawn = getSkiaNode(input.id)!;
    const texts = [drawn, ...(drawn.children ?? [])]
      .filter((node) => node.text)
      .map((node) => node.text!);
    expect(
      texts.some((text) => text.runs?.some((run) => run.fontWeight === 600)),
    ).toBe(true);
    canvas.dispose();
  });

  it("updates TokenField text runs after a document value edit and undo", async () => {
    const { workspace, id } = await fixture("TokenField");
    const input = () =>
      [...workspace.root.canvasInputs.values()].find(
        (record) => workspace.root.typeOf(record) === "TokenInput",
      )!;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { value: { kind: "set", value: "New #tag " } },
      }),
    );
    expect(
      input()
        .textRuns?.map((run) => run.text)
        .join(""),
    ).toBe("New #tag ");
    workspace.undo();
    expect(
      input()
        .textRuns?.map((run) => run.text)
        .join(""),
    ).toBe("Hello @person ");
  });

  it("does not tokenize unfinished words, email addresses, or IME text until a delimiter", () => {
    for (const text of ["@user", "#태그", "a@b.com ", "hello#tag "])
      expect(catalogTokenSegments(text)).toEqual([{ type: "text", text }]);
    const text = "@사용자 \n#태그\t끝";
    expect(
      catalogTokenSegments(text)
        .filter((segment) => segment.type === "token")
        .map((segment) => segment.text),
    ).toEqual(["@사용자", "#태그"]);
    expect(
      catalogTokenSegments(text)
        .map((segment) => segment.text)
        .join(""),
    ).toBe(text);
  });
});
