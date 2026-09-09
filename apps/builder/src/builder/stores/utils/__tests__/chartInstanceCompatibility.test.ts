import { afterEach, beforeEach, expect, it } from "vitest";
import { withComponentOriginMirror } from "@/adapters/canonical/componentSemanticsMirror";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
} from "@composition/shared";
import {
  PANEL_FIXTURE_PROJECT_ID,
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { useStore } from "../../elements";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";

beforeEach(() => {
  resetPanelFixture();
  historyManager.setCurrentPage("page-1");
  useStore.setState({ currentPageId: "page-1" });
});
afterEach(resetPanelFixture);
it("Chart ref 편집·Undo·재저장은 원본과 optional runtime 설정을 보존한다", async () => {
  const props = {
    chartType: "area",
    data: [{ category: "A", value: 12 }],
    dataBinding: { source: "dataTable", name: "sales" },
    showGrid: true,
    innerRadius: 42,
    isAnimationActive: true,
    animationDuration: 875,
    animationEasing: "ease-out",
  };
  seedPanelElements([
    { id: "body", type: "body", props: {}, parent_id: null, page_id: "page-1" },
    withComponentOriginMirror({
      id: "chart-origin",
      type: "Chart",
      props,
      parent_id: "body",
      page_id: "page-1",
    }),
  ]);
  const instance = useStore
    .getState()
    .createInstance("chart-origin", "body", "page-1")!;
  expect(instance).toBeTruthy();
  await useStore
    .getState()
    .updateElementProps(instance.id, { showGrid: false });
  const read = () =>
    useCanonicalDocumentStore.getState().getDocument(PANEL_FIXTURE_PROJECT_ID)!;
  const resolved = () =>
    deriveProjectRenderModelFromDocument(
      read(),
      "00000000-0000-0000-0000-000000000209",
      "page-1",
    ).elements.find((e) => e.id === instance.id)!.props;
  expect(resolved()).toMatchObject({ ...props, showGrid: false });
  await useStore.getState().undo();
  expect(resolved()).toMatchObject(props);
  await useStore.getState().redo();
  expect(resolved()).toMatchObject({ ...props, showGrid: false });
  const saved = parseProjectData(
    serializeProjectData(
      "00000000-0000-0000-0000-000000000209",
      "Charts",
      read(),
      "page-1",
    ),
  );
  expect(saved.success).toBe(true);
  if (!saved.success) return;
  useCanonicalDocumentStore
    .getState()
    .setDocument(PANEL_FIXTURE_PROJECT_ID, saved.data.document);
  expect(resolved()).toMatchObject({ ...props, showGrid: false });
  expect(
    useStore.getState().elementsMap.get("chart-origin")!.props,
  ).toMatchObject(props);
});
