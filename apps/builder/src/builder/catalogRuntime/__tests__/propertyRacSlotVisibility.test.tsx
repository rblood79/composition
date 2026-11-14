import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  CATALOG_DOM_SLOT_TYPES,
  CATALOG_RAC_SLOT_CONSUMERS,
  catalogHasSlotContract,
} from "../../../../../../packages/shared/src/catalog/racSlotContract";
import { I18nProvider } from "../../../i18n";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { createCatalogQuickConnectHost } from "../../panels/datatable/usage/catalogQuickConnectHost";
import { QuickConnectHostContext } from "../../panels/datatable/usage/quickConnectHost";
import { CatalogPropertiesBody } from "../../panels/properties/catalog/CatalogPropertiesPanel.components";
import { catalogEditContract, catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogWorkspaceProvider } from "../react";

it("모든 팔레트 컴포넌트와 내부 소비자의 context slot은 일반 Property 필드에서 숨긴다", async () => {
  const h = await openAdr296();
  try {
    const types = new Set([
      ...getPaletteItems().map((item) => item.type),
      ...Object.keys(CATALOG_RAC_SLOT_CONSUMERS),
      ...CATALOG_DOM_SLOT_TYPES,
    ]);
    for (const type of types) {
      const definitionId = catalogPaletteDefinitionId(h.graph().library, type);
      const slot = catalogSemanticContracts(definitionId, type).slot;
      if (catalogHasSlotContract(type)) expect(slot, type).toBeDefined();
      if (slot) expect(slot.editorHidden, type).toBe(true);
    }
  } finally {
    h.workspace.dispose();
  }
});

it.each(["Text", "Button", "SegmentedControl", "SelectBoxGroup", "Sheet"])(
  "%s의 저장된 slot 값과 자식 Slot을 유지하며 RAC slot 선택창을 숨긴다",
  async (type) => {
    const h = await openAdr296();
    let ui: ReturnType<typeof render> | undefined;
    try {
      const id = h.add(type, { slot: "provided" });
      const target = { kind: "node" as const, id };
      const item = h.workspace.itemsOfNode(id, 1)[0]!;
      const contract = catalogEditContract(
        h.graph(),
        h.workspace.readModel,
        target,
      );
      ui = render(
        <I18nProvider initialLocale="en-US">
          <CatalogWorkspaceProvider workspace={h.workspace}>
            {/* the builder always provides it — a bindable owner (SelectBoxGroup, ADR-310) shows the data source field */}
            <QuickConnectHostContext.Provider
              value={createCatalogQuickConnectHost(
                h.workspace,
                {
                  apply: async () => ({ applied: [], inverse: [] }),
                  collection: () => undefined,
                },
                (name) => name,
              )}
            >
              <CatalogPropertiesBody
                selection={{
                  first: item,
                  targets: [target],
                  contract,
                  title: type,
                  subpartOwner: undefined,
                  graph: h.graph(),
                  workspace: h.workspace,
                  root: h.workspace.root,
                }}
              />
            </QuickConnectHostContext.Provider>
          </CatalogWorkspaceProvider>
        </I18nProvider>,
      );
      expect(ui.queryByText("RAC slot")).toBeNull();
      // 구획 내용 영역 (Section 의 group — 자식 Slot 구획) 은 RAC slot 선택창이 아니다
      expect(
        ui
          .queryAllByRole("group", { name: /^Slot(?: of .*)?$/ })
          .filter((el) => !el.classList.contains("section-content")),
      ).toEqual([]);
      expect(h.node(id).props.slot).toEqual({ kind: "set", value: "provided" });
      if (type === "SegmentedControl" || type === "SelectBoxGroup") {
        expect(ui.getByRole("button", { name: "Fill slot" })).toBeTruthy();
      }
    } finally {
      ui?.unmount();
      h.workspace.dispose();
    }
  },
);
