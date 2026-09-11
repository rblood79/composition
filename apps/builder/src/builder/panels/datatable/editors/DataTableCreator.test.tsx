// @vitest-environment jsdom
/**
 * ADR-212 Phase 1 — 생성 진입 6종. 붙여넣기는 규칙 파서 → 스키마 미리보기 → createDataTable
 * (152 wrapper, HC1) 한 번 · 결과는 role=status 와 편집기 열림. "AI 로 설명" 은 AI 입력창
 * 초안 + AI 패널 표시 (전송 0).
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createDataTable, openApiCreator, openTableEditor, setVisibility } =
  vi.hoisted(() => ({
    createDataTable: vi.fn(async (input: { name: string }) => ({
      id: "new-1",
      name: input.name,
    })),
    openApiCreator: vi.fn(),
    openTableEditor: vi.fn(),
    setVisibility: vi.fn(),
  }));

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ createDataTable }),
}));
vi.mock("../stores/dataTableEditorStore", () => ({
  useDataTableEditorStore: (
    selector: (s: Record<string, unknown>) => unknown,
  ) => selector({ openApiCreator, openTableEditor }),
}));
vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: setVisibility,
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { DataTableCreator } from "./DataTableCreator";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";
import { useAiComposerDraftStore } from "../../ai/aiComposerDraft";

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);
const press = (el: Element) => {
  fireEvent.pointerDown(el, { pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(el, { pointerType: "mouse", button: 0 });
  fireEvent.click(el);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useDataPanelStatusStore.setState({ status: null });
  useAiComposerDraftStore.setState({ draft: null });
});

describe("DataTableCreator (ADR-212 Phase 1)", () => {
  it("시작 방법 6 이 radio 로 있고 기본은 프리셋", () => {
    const { getAllByRole } = render(
      wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
    );
    const radios = getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("value"))).toEqual([
      "empty",
      "preset",
      "paste",
      "file",
      "api",
      "ai",
    ]);
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
  });

  it("붙여넣기: 규칙 파서 → 미리보기 → createDataTable 1회 → status + 편집기 열림", async () => {
    const { container, getByLabelText, getByText } = render(
      wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
    );
    fireEvent.click(getByLabelText("Paste"));
    fireEvent.change(getByLabelText("Table Name"), {
      target: { value: "Members" },
    });
    fireEvent.change(getByLabelText("Paste rows"), {
      target: { value: "name\temail\nAna\tana@x.test\nBo\tbo@x.test" },
    });
    expect(getByText(/Preview — 2 fields · 2 rows/)).toBeTruthy();
    const create = [...container.querySelectorAll(".creator-footer button")].at(
      -1,
    )!;
    press(create);
    await vi.waitFor(() => expect(createDataTable).toHaveBeenCalledTimes(1));
    const input = createDataTable.mock.calls[0][0] as unknown as {
      name: string;
      schema: { key: string }[];
      mockData: unknown[];
    };
    expect(input.name).toBe("Members");
    expect(input.schema.map((f) => f.key)).toEqual(["name", "email"]);
    expect(input.mockData).toHaveLength(2);
    await vi.waitFor(() =>
      expect(useDataPanelStatusStore.getState().status?.message).toMatch(
        /Members/,
      ),
    );
    expect(openTableEditor).toHaveBeenCalledWith("new-1");
  });

  it("빈 테이블은 id 필드 하나로 만든다", async () => {
    const { container, getByLabelText } = render(
      wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
    );
    fireEvent.click(getByLabelText("Empty table"));
    press([...container.querySelectorAll(".creator-footer button")].at(-1)!);
    await vi.waitFor(() => expect(createDataTable).toHaveBeenCalledTimes(1));
    expect(
      (createDataTable.mock.calls[0][0] as unknown as { schema: unknown[] })
        .schema,
    ).toEqual([{ key: "id", type: "string", required: true }]);
  });

  it("AI 로 설명: 초안을 AI 입력창에 넣고 AI 패널을 연다 — createDataTable 0", () => {
    const onClose = vi.fn();
    const { container, getByLabelText } = render(
      wrap(<DataTableCreator projectId="p" onClose={onClose} />),
    );
    fireEvent.click(getByLabelText("Describe to AI"));
    fireEvent.change(getByLabelText("Table Name"), {
      target: { value: "Posts" },
    });
    fireEvent.change(getByLabelText("Describe the table"), {
      target: { value: "blog posts with title and tags" },
    });
    press([...container.querySelectorAll(".creator-footer button")].at(-1)!);
    expect(useAiComposerDraftStore.getState().draft).toBe(
      'Create a table "Posts": blog posts with title and tags',
    );
    expect(setVisibility).toHaveBeenCalledWith("ai", true);
    expect(createDataTable).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("API 에서: API 생성 패널로 넘긴다", () => {
    const { container, getByLabelText } = render(
      wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
    );
    fireEvent.click(getByLabelText("From API"));
    press([...container.querySelectorAll(".creator-footer button")].at(-1)!);
    expect(openApiCreator).toHaveBeenCalledWith("p");
  });
});
