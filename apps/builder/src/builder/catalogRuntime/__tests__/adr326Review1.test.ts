import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  addRecord,
  createComponent,
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setProjectVariable } from "../../../../../../packages/shared/src/catalog/commands/data";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
  ProjectVariableEntry,
  ProjectVariableId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogCascaderItems } from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { CATALOG_DELEGATED_DOM } from "../../../../../../packages/shared/src/catalog/runtime/delegatedDom.runtime";
import { catalogBoundRows } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogProjectVariableDefs } from "../catalogDataRead";
import { catalogContextualHelpCommand } from "../contextualHelpCommand";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 판독 (codex, 2026-11-28) 수리 — 구조 쪽 지적 (h1 고정 항목 유지 · h5 목록 지운 뒤
 * Undo · h6 바깥 instance 의 mode · h7 변수 mode · h8 「+」 항목의 이름). 기대값은 입력에서 손으로 적었다.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const col = (id: string) =>
  `data:collection:${id}` as DataBindingRef["collectionId"];
const ref = (id: string) =>
  `data:field:${id}` as DataBindingRef["fieldMap"][string];

const SOURCES = [
  {
    id: "t",
    schema: [
      { id: "f-id", key: "id" },
      { id: "f-name", key: "name" },
    ],
    mockData: [{ id: "remote", name: "Remote" }],
    useMockData: true,
  },
];

type Read = (id: string) => unknown;
async function place(
  props: NodeEntry["props"] = {},
  withState = false,
  read?: Read,
) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr326-review1" as EntryId<"project">,
      name: "ADR-326 review 1",
    }),
    library,
  );
  const workspace: CatalogWorkspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr326-review1-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (bound, kind, _owner, _path, slices) =>
          catalogBoundRows(
            bound,
            SOURCES as never,
            kind,
            undefined,
            undefined,
            slices,
          ),
        ...(withState
          ? {
              state: {
                projectVariables: () =>
                  catalogProjectVariableDefs(workspace.runtime.graph),
                ...(read ? { read } : {}),
              },
            }
          : {}),
      },
    },
  );
  return { workspace, library, graph };
}

async function placed(
  props: NodeEntry["props"] = {},
  withState = false,
  read?: Read,
  modeDefault = "drill",
) {
  const opened = await place(props, withState, read);
  const { workspace, library } = opened;
  if (withState)
    workspace.execute(
      setProjectVariable({
        entry: {
          kind: "projectVariable",
          id: "data:variable:panel-mode" as ProjectVariableId,
          name: "panelMode",
          valueType: "string",
          defaultValue: modeDefault,
          persist: false,
        } satisfies ProjectVariableEntry,
      }),
    );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props,
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  // (These cases start from `columns` — the default is `drill`, 사용자 결정 2026-11-29 — unless the
  //  case writes its own mode.)
  if (!("mode" in props))
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: { mode: { kind: "set", value: "columns" } },
      } as never),
    );
  const root = () => workspace.root;
  const get = (id: string) => root().domInputs.get(id);
  const typeOf = (node: CatalogConsumerNode) => root().typeOf(node);
  const field = (source: NodeId = PLACED) =>
    [...root().domInputs.values()].find(
      (record) => record.sourceId === source && typeOf(record) === "Cascader",
    )!;
  const popover = (source?: NodeId) =>
    field(source)
      .children.map(get)
      .find((record) => record && typeOf(record) === "Popover");
  const through = (
    record: CatalogConsumerNode | undefined,
    of: (id: string) => CatalogConsumerNode | undefined,
  ) =>
    (record?.children ?? []).flatMap((id) => {
      const child = of(id)!;
      return typeOf(child) === "frame"
        ? child.children.map((part) => typeOf(of(part)!))
        : [typeOf(child)];
    });
  const parts = (source?: NodeId) => ({
    dom: through(popover(source), get),
    canvas: through(
      root().canvasInputs.get(popover(source)?.id ?? "") ?? undefined,
      (id) => root().canvasInputs.get(id),
    ),
  });
  const items = (source?: NodeId) =>
    catalogCascaderItems(field(source), get, typeOf);
  const labels = (source?: NodeId) =>
    items(source).map((item) => String(item.props.label));
  return {
    ...opened,
    get,
    typeOf,
    field,
    parts,
    items,
    labels,
  };
}

/** A position's typed children (Layers rows). */
function positionsOf(
  workspace: CatalogWorkspace,
  parent: CatalogPosition,
): CatalogPosition[] {
  return childPositions(workspace.runtime.graph, parent);
}
const nameOf = (workspace: CatalogWorkspace, position: CatalogPosition) =>
  workspace.runtime.graph.getDefinition(position.definitionId)?.name ?? "";
function listPosition(workspace: CatalogWorkspace, id: NodeId = PLACED) {
  const popover = positionsOf(
    workspace,
    nodePosition(workspace.runtime.graph, id),
  ).find((position) => nameOf(workspace, position) === "Popover")!;
  return positionsOf(workspace, popover).find(
    (position) => nameOf(workspace, position) === "CascaderList",
  )!;
}
function layersOfPopover(workspace: CatalogWorkspace, id: NodeId): string[] {
  const popover = positionsOf(
    workspace,
    nodePosition(workspace.runtime.graph, id),
  ).find((position) => nameOf(workspace, position) === "Popover")!;
  return positionsOf(workspace, popover).flatMap((position) =>
    nameOf(workspace, position) === "frame"
      ? positionsOf(workspace, position).map((part) => nameOf(workspace, part))
      : [nameOf(workspace, position)],
  );
}

// (The head row's parts are read through — `Popover > frame > 「Back」 + SearchField`, 사용자 결정
//  2026-11-29: 「Back」 stands before the search box while the mode is `drill`.)
const COLUMNS_PARTS = ["SearchField", "CascaderList"];
const DRILL_PARTS = [
  "ActionButton",
  "SearchField",
  "Breadcrumbs",
  "CascaderList",
];

describe("ADR-326 Phase 1 판독 수리 — 구조", () => {
  it("h1: 첫 연결의 「모두 고정 항목으로 두고 데이터는 뒤에」 — 고친 이름까지 남고, 해제하면 그대로", async () => {
    const { workspace, labels } = await placed();
    const books = positionsOf(workspace, listPosition(workspace)).find(
      (position) =>
        workspace.readModel.propSource(position.target, "label").value ===
        "Books",
    )!;
    workspace.execute(
      setFields({
        targets: [books.target],
        props: { label: { kind: "set", value: "My books" } },
      } as never),
    );
    expect(labels()).toEqual(["Electronics", "Clothing", "My books"]);
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        {
          collectionId: col("t"),
          fieldMap: { value: ref("f-id"), label: ref("f-name") },
        },
        workspace.newId,
        "keep",
      ),
    );
    expect(labels()).toEqual(["Electronics", "Clothing", "My books", "Remote"]);
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: PLACED }], undefined),
    );
    expect(labels().slice(0, 3)).toEqual([
      "Electronics",
      "Clothing",
      "My books",
    ]);
  });

  it("h1: 「첫 항목을 템플릿으로」 — 표본 항목이 행에 자리를 내준다 (그대로)", async () => {
    const { workspace, labels } = await placed();
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        {
          collectionId: col("t"),
          fieldMap: { value: ref("f-id"), label: ref("f-name") },
        },
        workspace.newId,
      ),
    );
    expect(labels()).toEqual(["Remote"]);
  });

  it("h5: 목록 상자를 지우고 Undo — 필드가 Popover 를 계속 구독해 복원 알림을 받는다", async () => {
    const { workspace, field, get } = await placed();
    const watches = CATALOG_DELEGATED_DOM.cascader!.watchesChildren as (
      node: CatalogConsumerNode,
      root: CatalogWorkspace["root"],
    ) => string[];
    const popoverId = () =>
      field().children.find(
        (id) => workspace.root.typeOf(get(id)!) === "Popover",
      )!;
    expect(watches(field(), workspace.root)).toContain(popoverId());
    workspace.execute(
      removeTargets({ targets: [listPosition(workspace).target] }),
    );
    expect(watches(field(), workspace.root)).toContain(popoverId());
    workspace.undo();
    expect(watches(field(), workspace.root)).toContain(popoverId());
  });

  it("h6: 도움말을 넣고 컴포넌트로 만든 뒤 instance 에서 mode = drill — record 와 Layers 모두 drill 부품", async () => {
    for (const help of [true, false]) {
      const { workspace, parts } = await placed();
      if (help)
        workspace.execute(
          catalogContextualHelpCommand({
            field: nodePosition(workspace.runtime.graph, PLACED),
            kind: "info",
            newId: workspace.newId,
          }),
        );
      workspace.execute(
        createComponent({ id: PLACED, name: "Picker", newId: workspace.newId }),
      );
      const body = workspace.runtime.graph.getEntry(BODY) as NodeEntry;
      const instance = body.children.find((id) => id !== PLACED)!;
      expect(parts(instance).dom, `help ${help}`).toEqual(COLUMNS_PARTS);
      expect(layersOfPopover(workspace, instance), `help ${help}`).toEqual(
        COLUMNS_PARTS,
      );
      workspace.execute(
        setFields({
          targets: [
            {
              kind: "descendant",
              ownerId: instance,
              address: { instances: [instance], templatePath: [PLACED] },
            },
          ],
          props: { mode: { kind: "set", value: "drill" } },
        } as never),
      );
      expect(parts(instance), `help ${help}`).toEqual({
        dom: DRILL_PARTS,
        canvas: DRILL_PARTS,
      });
      expect(layersOfPopover(workspace, instance), `help ${help}`).toEqual(
        DRILL_PARTS,
      );
    }
  });

  it("h7: mode 가 변수 식 (`{{ panelMode }}` = drill) — 해석된 값으로 drill 부품이 선다", async () => {
    const { parts, workspace } = await placed(
      { mode: { kind: "set", value: "{{ panelMode }}" } },
      true,
    );
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(DRILL_PARTS);
  });

  it("h7: 실행 중 변수 값이 바뀌면 (Preview) — drill 부품이 서고 사라진다", async () => {
    const values = new Map<string, unknown>();
    const read: Read = (id) =>
      id.includes("panel-mode") ? values.get("panelMode") : undefined;
    const { parts, workspace } = await placed(
      { mode: { kind: "set", value: "{{ panelMode }}" } },
      true,
      read,
      "columns",
    );
    expect(parts().dom).toEqual(COLUMNS_PARTS);
    values.set("panelMode", "drill");
    workspace.root.refreshState(new Set(["panelMode"]));
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    values.set("panelMode", "tree");
    workspace.root.refreshState(new Set(["panelMode"]));
    expect(parts().dom).toEqual(COLUMNS_PARTS);
  });

  it("h8: 「+」 로 넣은 항목 — 이름 Text 가 항목의 label 을 따른다", async () => {
    const { workspace, items, get } = await placed();
    const choice = catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      listPosition(workspace),
    ).find((option) => option.type === "CascaderItem")!;
    workspace.execute(choice.build());
    const added = () => items()[3]!;
    const text = () =>
      added()
        .children.map((id) => get(id)!)
        .find((record) => workspace.root.typeOf(record) === "Text")!;
    expect(String(added().props.label)).toBe("Item 4");
    expect(text().props.children).toBe("Item 4");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: added().sourceId as NodeId }],
        props: { label: { kind: "set", value: "New Label" } },
      } as never),
    );
    expect(String(added().props.label)).toBe("New Label");
    expect(text().props.children).toBe("New Label");
  });
});

/** Every position under `position` (Layers rows, depth first). */
function allPositions(
  workspace: CatalogWorkspace,
  position: CatalogPosition,
): CatalogPosition[] {
  return positionsOf(workspace, position).flatMap((child) => [
    child,
    ...allPositions(workspace, child),
  ]);
}

describe("ADR-326 Phase 1 수리 검증 수리 — 구조", () => {
  it("검증 h1: 컴포넌트 안 Cascader 의 mode 가 페이지 변수 (`{{ pageMode }}` = drill) — record 에 drill 부품", async () => {
    const { workspace, parts } = await placed({
      mode: { kind: "set", value: "{{ pageMode }}" },
    });
    workspace.execute(
      addRecord({
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:page-mode" as EntryId<"stateVariable">,
          ownerId: "project:page:home" as EntryId<"page">,
          name: "pageMode",
          valueType: "string",
          defaultValue: "drill",
        },
      }),
    );
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    workspace.execute(
      createComponent({ id: PLACED, name: "Picker", newId: workspace.newId }),
    );
    const body = workspace.runtime.graph.getEntry(BODY) as NodeEntry;
    const instance = body.children.find((id) => id !== PLACED)!;
    expect(parts(instance)).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    expect(layersOfPopover(workspace, instance)).toEqual(DRILL_PARTS);
  });

  it("검증 h2: instance 가 덮어쓴 mode = `{{ panelMode }}` — 실행 중 변수 변경에 drill 부품이 선다", async () => {
    const values = new Map<string, unknown>();
    const read: Read = (id) =>
      id.includes("panel-mode") ? values.get("panelMode") : undefined;
    const { workspace, parts } = await placed({}, true, read, "columns");
    workspace.execute(
      createComponent({ id: PLACED, name: "Picker", newId: workspace.newId }),
    );
    const body = workspace.runtime.graph.getEntry(BODY) as NodeEntry;
    const instance = body.children.find((id) => id !== PLACED)!;
    workspace.execute(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: instance,
            address: { instances: [instance], templatePath: [PLACED] },
          },
        ],
        props: { mode: { kind: "set", value: "{{ panelMode }}" } },
      } as never),
    );
    expect(parts(instance).dom).toEqual(COLUMNS_PARTS);
    values.set("panelMode", "drill");
    workspace.root.refreshState(new Set(["panelMode"]));
    expect(parts(instance)).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
  });

  it("검증 h3: 「모두 고정 항목으로」 연결 — 데이터 행이 마지막 항목 (비활성 Books) 의 설정을 이어받는다", async () => {
    const { workspace, items } = await placed();
    const books = positionsOf(workspace, listPosition(workspace)).find(
      (position) =>
        workspace.readModel.propSource(position.target, "label").value ===
        "Books",
    )!;
    workspace.execute(
      setFields({
        targets: [books.target],
        props: { isDisabled: { kind: "set", value: true } },
      } as never),
    );
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        {
          collectionId: col("t"),
          fieldMap: { value: ref("f-id"), label: ref("f-name") },
        },
        workspace.newId,
        "keep",
      ),
    );
    expect(
      items().map((item) => [
        String(item.props.label),
        item.props.isDisabled === true,
      ]),
    ).toEqual([
      ["Electronics", false],
      ["Clothing", false],
      ["Books", true],
      ["Remote", true],
    ]);
  });

  it("검증 h4: mode 가 변수 참조 (`!var` = drill) — Layers 에도 drill 부품", async () => {
    const { workspace, parts } = await placed(
      {
        mode: {
          kind: "set",
          value: { kind: "var", ref: "!var.data:variable:panel-mode" },
        },
      } as never,
      true,
    );
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(DRILL_PARTS);
  });

  it("검증 h5: AlertDialog 의 cancelLabel 이 빈 변수 — record 와 Layers 모두 취소 버튼 없음", async () => {
    const CANCEL = "lib:template:component-alertdialog__cancel";
    for (const [label, present] of [
      ["{{ cancelText }}", false],
      ["Cancel", true],
    ] as const) {
      const { workspace, library } = await place({}, true);
      workspace.execute(
        setProjectVariable({
          entry: {
            kind: "projectVariable",
            id: "data:variable:cancel-text" as ProjectVariableId,
            name: "cancelText",
            valueType: "string",
            defaultValue: "",
            persist: false,
          } satisfies ProjectVariableEntry,
        }),
      );
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              kind: "node",
              id: PLACED,
              definitionId: catalogPaletteDefinitionId(library, "AlertDialog"),
              children: [],
              props: { cancelLabel: { kind: "set", value: label } },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [PLACED],
          newId: workspace.newId,
        }),
      );
      const records = [...workspace.root.domInputs.values()].filter(
        (record) => record.sourceId === CANCEL,
      );
      const rows = allPositions(
        workspace,
        nodePosition(workspace.runtime.graph, PLACED),
      ).filter(
        (position) =>
          position.target.kind === "descendant" &&
          position.target.address.templatePath.at(-1) === CANCEL,
      );
      expect(records.length > 0, label).toBe(present);
      expect(rows.length > 0, label).toBe(present);
    }
  });
});
