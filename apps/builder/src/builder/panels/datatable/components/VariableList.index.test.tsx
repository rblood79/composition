// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — Data 탭 Variables: 프로젝트 변수 (편집 가능, 사용처 배지) + 페이지 · 컴포넌트
 * 인덱스 (소유자 열 · 클릭 → 페이지 활성화 + 요소 선택 + Properties 상태 절 포커스 요청).
 */
import type { ReactElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import { useStore } from "../../../stores";
import { useDataStore } from "../../../stores/data";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useStateSectionFocus } from "../../properties/state/stateSectionFocus";
import { VariableList } from "./VariableList";

vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: vi.fn(),
}));

const PROJECT_ID = "p-vars";

const doc: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "home",
      type: "frame",
      name: "Home",
      metadata: { type: "page" },
      state: [{ id: "v-filter", name: "filter", type: "string", defaultValue: "" }],
      children: [
        {
          id: "list",
          type: "ListBox",
          name: "users-list",
          state: [
            { id: "v-sel", name: "selectedKey", type: "string", source: { prop: "selectedKeys" } },
          ],
          children: [],
        },
        { id: "t1", type: "Text", props: { children: "{{ count }} {{ filter }}" } },
      ],
    },
  ],
} as unknown as CompositionDocument;

const renderWithI18n = (ui: ReactElement) => render(ui, { wrapper: I18nProvider });

describe("VariableList — 인덱스 (ADR-214 Phase 5)", () => {
  beforeEach(() => {
    useCanonicalDocumentStore.setState({ documents: new Map(), currentProjectId: null, documentVersion: 0 });
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
    useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
    useStore.setState({
      pages: [{ id: "home", title: "Home", slug: "/", project_id: PROJECT_ID, parent_id: null }],
      currentPageId: "home",
      lazyLoadingEnabled: false,
      pageElementsSnapshot: { home: [{ id: "body-1", type: "body" }] },
      activatePage: vi.fn(),
    } as never);
    useDataStore.setState({
      variables: new Map([
        ["count", { id: "v-count", name: "count", type: "number", scope: "global", project_id: PROJECT_ID, persist: false, owner: { kind: "project" } }],
      ]),
    } as never);
  });
  afterEach(() => cleanup());

  it("프로젝트 행에 사용처 1 · 인덱스에 페이지 변수 + 요소 변수 (암묵) 행 · 요소 행 클릭 → activatePage(home, list) + 포커스 요청", () => {
    const { container } = renderWithI18n(<VariableList projectId={PROJECT_ID} />);
    const projectRow = container.querySelector('[data-variable-group="project"] .list-item');
    expect(projectRow?.textContent).toContain("count");
    expect(projectRow?.textContent).toContain("Used in 1");

    const indexRows = [...container.querySelectorAll(".variable-index-item")];
    expect(indexRows.map((row) => row.getAttribute("data-owner-kind"))).toEqual(["page", "element"]);
    expect(indexRows[0].textContent).toContain("filter");
    expect(indexRows[0].textContent).toContain("Used in 1");
    expect(indexRows[1].textContent).toContain("selectedKey");
    expect(indexRows[1].textContent).toContain("implicit selectedKeys");
    expect(indexRows[1].querySelector(".list-item-badge")?.textContent).toBe("users-list");

    fireEvent.click(indexRows[1]);
    expect(useStore.getState().activatePage).toHaveBeenCalledWith("home", "list");
    expect(useStateSectionFocus.getState().request).toMatchObject({ ownerNodeId: "list", variableId: "v-sel" });

    fireEvent.click(indexRows[0]);
    expect(useStore.getState().activatePage).toHaveBeenCalledWith("home", "body-1");
    expect(useStateSectionFocus.getState().request).toMatchObject({ ownerNodeId: "home", variableId: "v-filter" });
  });
});
