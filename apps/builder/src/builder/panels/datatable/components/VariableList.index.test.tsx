// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — Data 탭 Variables: 프로젝트 변수 (편집 가능, 사용처 배지) + 페이지 · 컴포넌트
 * 인덱스 (소유자 열 · 클릭 → 소유자 선택 + Properties 상태 절 포커스 요청).
 * ADR-248 4e-9 C: catalog workspace 의 변수 host 위에서 (옛 store host 는 옛 store 와 함께 제거).
 * ADR-288: 프로젝트 변수와 색인이 한 `VariableTable` — 색인은 「모든 변수」 보기에서 읽기 전용 행.
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

    const { container, getByRole } = render(
      <VariableList projectId={PROJECT_ID} />,
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider>{fixture.wrapper({ children })}</I18nProvider>
        ),
      },
    );
    // ADR-288: the project variable is a row of the shared table, editable in place.
    const projectRow = container.querySelector(
      '[data-variable-group="project"] .variable-table__row[data-variable-id="v-count"]',
    )!;
    expect(
      projectRow.querySelector<HTMLInputElement>(".variable-table__cell-name input")!.value,
    ).toBe("count");
    expect(projectRow.querySelector(".variable-table__cell-usage")?.textContent).toBe("1");
    expect(container.querySelectorAll(".variable-table__row[data-read-only]")).toHaveLength(0);

    // 「모든 변수」 (사용자 결정 2): the page · element index joins the table as read-only rows.
    fireEvent.click(getByRole("button", { name: /보기|View/ }));
    fireEvent.click(getByRole("option", { name: /모든 변수|All variables/ }));
    const indexRows = [
      ...container.querySelectorAll<HTMLElement>(".variable-table__row[data-read-only]"),
    ];
    expect(indexRows.map((row) => row.getAttribute("data-variable-id"))).toHaveLength(2);
    expect(indexRows[0]!.textContent).toContain("filter");
    expect(indexRows[0]!.querySelector(".variable-table__cell-usage")?.textContent).toBe("1");
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
