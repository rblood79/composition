// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — Data 탭 Variables: 프로젝트 변수 (편집 가능, 사용처 배지) + 페이지 · 컴포넌트
 * 인덱스 (소유자 열 · 클릭 → 소유자 선택 + Properties 상태 절 포커스 요청).
 * ADR-248 4e-9 C: catalog workspace 의 변수 host 위에서 (옛 store host 는 옛 store 와 함께 제거).
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

    const { container } = render(<VariableList projectId={PROJECT_ID} />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider>{fixture.wrapper({ children })}</I18nProvider>
      ),
    });
    const projectRow = container.querySelector(
      '[data-variable-group="project"] .list-item',
    );
    expect(projectRow?.textContent).toContain("count");
    expect(projectRow?.textContent).toContain("Used in 1");

    const indexRows = [...container.querySelectorAll(".variable-index-item")];
    expect(indexRows.map((row) => row.getAttribute("data-owner-kind"))).toEqual(
      ["page", "element"],
    );
    expect(indexRows[0]!.textContent).toContain("filter");
    expect(indexRows[0]!.textContent).toContain("Used in 1");
    expect(indexRows[1]!.textContent).toContain("selectedKey");

    fireEvent.click(indexRows[1]!);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: nodeIdOf("list") }]);
    expect(useStateSectionFocus.getState().request).toMatchObject({
      ownerNodeId: nodeIdOf("list"),
    });

    fireEvent.click(indexRows[0]!);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: BODY }]);
    expect(useStateSectionFocus.getState().request).toMatchObject({
      ownerNodeId: HOME,
    });
  });
});
