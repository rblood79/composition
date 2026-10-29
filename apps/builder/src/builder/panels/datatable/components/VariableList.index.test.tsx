// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — Data 탭 Variables: 프로젝트 변수 (편집 가능, 사용처 배지) + 페이지 · 컴포넌트
 * 인덱스 (소유자 열 · 클릭 → 소유자 선택 + Properties 상태 절 포커스 요청).
 * ADR-248 4e-9 C: catalog workspace 의 변수 host 위에서 (옛 store host 는 옛 store 와 함께 제거).
 * ADR-288: 프로젝트 변수와 색인이 한 `VariableTable` — 색인은 읽기 전용 행.
 * 2026-10-29 (사용자 「tables · apis 처럼 left-list」): 목록 열이 묶음 (Project · 페이지) 이고
 * 본문은 고른 묶음 하나 — 페이지 묶음이 그 페이지 · 요소 변수 색인.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  renameNode,
  setFields,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "@/i18n";
import { useDataStore } from "../../../stores/data";
import { useStateSectionFocus } from "../../properties/state/stateSectionFocus";
import { catalogVariableCommands } from "../../../catalogRuntime/stateVariables";
import {
  nodeIdOf,
  openStylesFixture,
} from "../../styles/__tests__/support/catalogStylesFixture";
import { useDataTableEditorStore } from "../stores/dataTableEditorStore";
import { VariableGroupList } from "./VariableGroupList";
import { VariableList } from "./VariableList";

vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: vi.fn(),
}));

const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const PROJECT_ID = "p-vars";

afterEach(() => cleanup());

describe("VariableList — 인덱스 (ADR-214 Phase 5)", () => {
  it("프로젝트 행에 사용처 1 · 인덱스에 페이지 변수 + 요소 변수 행 · 행 클릭 → 소유자 선택 + 포커스 요청", async () => {
    const fixture = await openStylesFixture([
      { id: "list", type: "ListBox" },
      { id: "t1", type: "Text" },
    ]);
    const { workspace } = fixture;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: nodeIdOf("t1") }],
        props: {
          children: { kind: "set", value: "{{ count }} {{ filter }}" },
        },
      } as Parameters<typeof setFields>[0]),
    );
    workspace.execute(renameNode({ id: nodeIdOf("list"), name: "users-list" }));
    workspace.execute(
      catalogVariableCommands.add(HOME, "filter", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.add(
        nodeIdOf("list"),
        "selectedKey",
        workspace.newId,
      ),
    );
    useDataStore.setState({
      variables: new Map([
        [
          "count",
          {
            id: "v-count",
            name: "count",
            type: "number",
            scope: "global",
            project_id: PROJECT_ID,
            persist: false,
            owner: { kind: "project" },
          },
        ],
      ]),
    } as never);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider>{fixture.wrapper({ children })}</I18nProvider>
    );
    const { container, rerender } = render(<VariableList group="project" />, {
      wrapper,
    });
    // ADR-288: the project variable is a row of the shared table, editable in place.
    const projectRow = container.querySelector(
      '[data-variable-group="project"] .variable-table__row[data-variable-id="v-count"]',
    )!;
    // (A grid cell — text until it is edited in place, 2026-10-29.)
    const nameCell = projectRow.querySelector(".variable-table__cell-name")!;
    expect(nameCell.textContent).toBe("count");
    expect(nameCell.getAttribute("data-edit-column")).toBe("name");
    expect(
      projectRow.querySelector(".variable-table__cell-usage")?.textContent,
    ).toBe("1");
    expect(
      container.querySelectorAll(".variable-table__row[data-read-only]"),
    ).toHaveLength(0);

    // The page group (the list column's Home row): its page · element variables, read-only.
    rerender(<VariableList group={HOME} />);
    expect(
      container.querySelector('[data-variable-group="page"]'),
    ).not.toBeNull();
    const indexRows = [
      ...container.querySelectorAll<HTMLElement>(
        ".variable-table__row[data-read-only]",
      ),
    ];
    expect(
      indexRows.map((row) => row.getAttribute("data-variable-id")),
    ).toHaveLength(2);
    expect(indexRows[0]!.textContent).toContain("filter");
    expect(
      indexRows[0]!.querySelector(".variable-table__cell-usage")?.textContent,
    ).toBe("1");
    expect(indexRows[1]!.textContent).toContain("selectedKey");
    expect(indexRows[1]!.textContent).toContain("users-list");

    fireEvent.click(indexRows[1]!.querySelector("button")!);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: nodeIdOf("list") }]);
    expect(useStateSectionFocus.getState().request).toMatchObject({
      ownerNodeId: nodeIdOf("list"),
    });

    fireEvent.click(indexRows[0]!.querySelector("button")!);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: BODY }]);
    expect(useStateSectionFocus.getState().request).toMatchObject({
      ownerNodeId: HOME,
    });
  });
});

describe("VariableGroupList — the Variables list column (2026-10-29)", () => {
  it("rows = Project + each page with variables (counts) · a row opens its group's table", async () => {
    const fixture = await openStylesFixture([{ id: "list", type: "ListBox" }]);
    const { workspace } = fixture;
    workspace.execute(
      catalogVariableCommands.add(HOME, "filter", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.add(nodeIdOf("list"), "picked", workspace.newId),
    );
    useDataStore.setState({
      variables: new Map([
        [
          "count",
          {
            id: "v-count",
            name: "count",
            type: "number",
            scope: "global",
            project_id: PROJECT_ID,
            persist: false,
            owner: { kind: "project" },
          },
        ],
      ]),
    } as never);
    useDataTableEditorStore.setState({ mode: null });

    const { getAllByRole } = render(
      <VariableGroupList projectId={PROJECT_ID} />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider>{fixture.wrapper({ children })}</I18nProvider>
        ),
      },
    );
    const rows = getAllByRole("row");
    expect(rows.map((row) => row.getAttribute("data-variable-group"))).toEqual([
      "project",
      "page",
    ]);
    expect(
      rows.map((row) => row.querySelector(".datatable-tree-meta")?.textContent),
    ).toEqual(["1", "2"]);

    fireEvent.click(rows[1]!.querySelector(".elementItem")!);
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "variables",
      projectId: PROJECT_ID,
      group: HOME,
    });
    fireEvent.click(rows[0]!.querySelector(".elementItem")!);
    expect(useDataTableEditorStore.getState().mode).toEqual({
      type: "variables",
      projectId: PROJECT_ID,
    });
  });
});
