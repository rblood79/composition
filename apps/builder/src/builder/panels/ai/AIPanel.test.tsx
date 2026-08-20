// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunAgent = vi.hoisted(() => vi.fn());
const mockStopAgent = vi.hoisted(() => vi.fn());
const mockUpdateContext = vi.hoisted(() => vi.fn());
const mockClearConversation = vi.hoisted(() => vi.fn());

const mockBuilderState = vi.hoisted(() => ({
  currentPageId: "page-1",
  selectedElementId: "button-1",
  pageElementsSnapshot: {
    "page-1": [
      {
        id: "button-1",
        type: "Button",
        parent_id: null,
        props: {},
      },
    ],
  },
}));

vi.mock("../../stores", () => ({
  useStore: <T,>(selector: (state: typeof mockBuilderState) => T): T =>
    selector(mockBuilderState),
}));

vi.mock("../../stores/conversation", () => ({
  useConversationStore: () => ({
    updateContext: mockUpdateContext,
    clearConversation: mockClearConversation,
  }),
}));

vi.mock("./hooks/useAgentLoop", () => ({
  useAgentLoop: () => ({
    messages: [],
    isStreaming: false,
    isAgentRunning: false,
    currentTurn: 0,
    runAgent: mockRunAgent,
    stopAgent: mockStopAgent,
  }),
}));

vi.mock("../../components", () => ({
  PanelHeader: ({
    title,
    actions,
  }: {
    title: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h2>{title}</h2>
      {actions}
    </header>
  ),
  ActionIconButton: ({
    children,
    isDisabled,
    onPress,
    tooltip: _tooltip,
    tooltipPlacement: _tooltipPlacement,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
    onPress?: () => void;
    tooltip?: string;
    tooltipPlacement?: string;
  }) => (
    <button {...props} disabled={isDisabled} onClick={onPress} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@composition/shared/components", () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
    onPress?: () => void;
    variant?: string;
    size?: string;
  }) => (
    <button {...props} disabled={isDisabled} onClick={onPress} type="button">
      {children}
    </button>
  ),
}));

import { AIPanel } from "./AIPanel";

describe("AIPanel Photoshop-style initial experience", () => {
  beforeEach(() => {
    mockRunAgent.mockReset();
    mockStopAgent.mockReset();
    mockUpdateContext.mockReset();
    mockClearConversation.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows contextual recommendations and the persistent composer", () => {
    render(<AIPanel />);

    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeTruthy();
    expect(
      screen.getByText("다음은 선택한 Button에 대한 맞춤형 아이디어입니다."),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "추천 요청" })).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /선택한 Button의 시각적 계층을 개선해 주세요/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "무엇이든 물어보세요" }),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "참조 이미지 추가",
      }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "질문 제출" })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("AI 생성 응답입니다. 사용하기 전에 확인해야 합니다."),
    ).toBeTruthy();
  });

  it("routes recommendations and typed prompts through the existing agent loop", () => {
    render(<AIPanel />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /선택한 Button의 시각적 계층을 개선해 주세요/,
      }),
    );
    expect(mockRunAgent).toHaveBeenCalledWith(
      "해주세요: 선택한 Button의 시각적 계층을 개선해 주세요.",
    );

    const composer = screen.getByRole("textbox", {
      name: "무엇이든 물어보세요",
    });
    fireEvent.change(composer, { target: { value: "간격을 정리해 줘" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: false });

    expect(mockRunAgent).toHaveBeenLastCalledWith("간격을 정리해 줘");
    expect((composer as HTMLTextAreaElement).value).toBe("");
  });
});
