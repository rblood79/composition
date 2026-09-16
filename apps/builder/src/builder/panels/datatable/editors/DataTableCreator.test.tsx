// @vitest-environment jsdom
/**
 * ADR-212 Phase 1 — 생성 진입 6종. 붙여넣기는 규칙 파서 → 스키마 미리보기 → createDataTable
 * (152 wrapper, HC1) 한 번 · 결과는 role=status 와 편집기 열림. "AI 로 설명" 은 AI 입력창
 * 초안 + AI 패널 표시 (전송 0).
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createDataTable,
  createAndBindDataTable,
  openApiCreator,
  openTableEditor,
  setVisibility,
  quickConnect,
} = vi.hoisted(() => ({
  createDataTable: vi.fn(async (input: { name: string }) => ({
    id: "new-1",
    name: input.name,
  })),
  createAndBindDataTable: vi.fn(
    async ({ input }: { input: { name: string } }) => ({
      id: "new-qc",
      name: input.name,
    }),
  ),
  openApiCreator: vi.fn(),
  openTableEditor: vi.fn(),
  setVisibility: vi.fn(),
  quickConnect: {
    precheck: vi.fn(() => ({ ok: true }) as { ok: boolean; reason?: string }),
    readBack: vi.fn(() => true),
  },
}));

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ createDataTable }),
}));
vi.mock("../utils/quickConnect", () => ({
  executeQuickConnect: createAndBindDataTable,
  planTableColumns: () => null,
  unmatchedColumnKeys: () => [],
  precheckQuickConnectTarget: quickConnect.precheck,
  readBackQuickConnect: quickConnect.readBack,
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

  it("프리셋: 카드 선택 → 생성 조건 (seed · blank %) → 라벨 해소된 스키마 + seed 재현 행", async () => {
    const run = async (seedValue: string, blank: string) => {
      const { container, getByRole, getByText } = render(
        wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
      );
      press(getByText("Contacts").closest("button")!);
      fireEvent.change(getByRole("textbox", { name: "Seed" }), {
        target: { value: seedValue },
      });
      fireEvent.change(getByRole("spinbutton", { name: "Blank %" }), {
        target: { value: blank },
      });
      press([...container.querySelectorAll(".creator-footer button")].at(-1)!);
      await vi.waitFor(() => expect(createDataTable).toHaveBeenCalled());
      const input = createDataTable.mock.calls.at(-1)![0] as unknown as {
        name: string;
        schema: { key: string; label?: string }[];
        mockData: Record<string, unknown>[];
      };
      cleanup();
      return input;
    };
    const a = await run("demo", "0");
    expect(a.name).toBe("Contacts");
    expect(a.schema.find((f) => f.key === "email")?.label).toBe("Email");
    expect(a.mockData).toHaveLength(15);
    const b = await run("demo", "0");
    expect(b.mockData).toEqual(a.mockData);
    // blank 90% — required 아닌 email 은 대부분 비고 required name 은 전부 채워진다
    const c = await run("demo", "90");
    expect(c.mockData.every((row) => row.name !== null)).toBe(true);
    expect(
      c.mockData.filter((row) => row.email === null).length,
    ).toBeGreaterThan(7);
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

// ADR-013 — Properties Data 행에서 연 연결 모드
describe("DataTableCreator — 연결 모드 (ADR-013)", () => {
  const connect = {
    elementId: "lb-1",
    pageId: "pg-1",
    elementType: "ListBox",
    elementLabel: "ListBox_1",
    binding: {},
  };
  const createButton = (container: HTMLElement) =>
    [...container.querySelectorAll(".creator-footer button")].at(-1)!;

  it("대상 안내 + 「Create & connect」 · 빈 테이블은 createAndBindDataTable 1회 (createDataTable 0) → read-back → status 에 대상 이름", async () => {
    const { container, getByLabelText, getByRole } = render(
      wrap(
        <DataTableCreator projectId="p" connect={connect} onClose={() => {}} />,
      ),
    );
    expect(getByRole("note").textContent).toMatch(/ListBox_1/);
    fireEvent.click(getByLabelText("Empty table"));
    expect(createButton(container).textContent).toBe("Create & connect");
    press(createButton(container));
    await vi.waitFor(() =>
      expect(createAndBindDataTable).toHaveBeenCalledTimes(1),
    );
    expect(createDataTable).not.toHaveBeenCalled();
    expect(quickConnect.precheck).toHaveBeenCalledWith(connect, "p");
    const [call] = createAndBindDataTable.mock.calls[0] as unknown as [
      {
        input: { name: string; project_id: string };
        target: unknown;
        projectId: string;
        replaceColumns: boolean;
      },
    ];
    expect(call.input.project_id).toBe("p");
    expect(call.target).toEqual(connect);
    expect(call.replaceColumns).toBe(false);
    expect(quickConnect.readBack).toHaveBeenCalledWith("lb-1", "new-qc");
    await vi.waitFor(() =>
      expect(useDataPanelStatusStore.getState().status?.message).toMatch(
        /ListBox_1/,
      ),
    );
    expect(openTableEditor).toHaveBeenCalledWith("new-qc");
  });

  it("실행 직전 검증 실패 (대상 삭제 등) 는 무변경 중단 — 어느 생성 액션도 부르지 않는다", async () => {
    quickConnect.precheck.mockReturnValueOnce({ ok: false, reason: "missing" });
    const { container, getByLabelText } = render(
      wrap(
        <DataTableCreator projectId="p" connect={connect} onClose={() => {}} />,
      ),
    );
    fireEvent.click(getByLabelText("Empty table"));
    press(createButton(container));
    await Promise.resolve();
    expect(createAndBindDataTable).not.toHaveBeenCalled();
    expect(createDataTable).not.toHaveBeenCalled();
    expect(openTableEditor).not.toHaveBeenCalled();
  });

  it("API/AI 는 연결 모드 미지원 — 사유 note + 「Continue without connecting」 로만 일반 인계", () => {
    const { container, getByLabelText, getAllByRole } = render(
      wrap(
        <DataTableCreator projectId="p" connect={connect} onClose={() => {}} />,
      ),
    );
    fireEvent.click(getByLabelText("From API"));
    expect(
      getAllByRole("note").some((n) =>
        /Not available in connect mode/.test(n.textContent ?? ""),
      ),
    ).toBe(true);
    expect(createButton(container).textContent).toBe(
      "Continue without connecting",
    );
    press(createButton(container));
    expect(openApiCreator).toHaveBeenCalledWith("p");
    expect(createAndBindDataTable).not.toHaveBeenCalled();
  });

  it("connect 없이 열면 종전 그대로 — note 0 · 「Create」 · createDataTable", () => {
    const { container, queryByRole } = render(
      wrap(<DataTableCreator projectId="p" onClose={() => {}} />),
    );
    expect(queryByRole("note")).toBeNull();
    expect(createButton(container).textContent).toBe("Create");
  });
});
