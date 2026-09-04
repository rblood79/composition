// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentProgress } from "../hooks/agentProgress";

vi.mock("./AgentProfileSettings", () => ({
  AgentProfileSettings: () => <div>프로파일 설정 자리</div>,
}));

vi.mock("./ConnectionStatus", () => ({
  ConnectionStatus: () => <div>연결 상태 자리</div>,
}));

import { AdvancedMode } from "./AdvancedMode";
import { trimLabelEcho } from "./advancedModeUtils";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";

const empty: AgentProgress = { plan: null, agents: [], repairs: [] };

afterEach(cleanup);

/** 표시 계층이 `useI18n` 을 쓰므로 provider 밑에서 그린다 (ADR-200 R7). */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("고급 모드", () => {
  it("프로파일 설정과 연결 상태를 함께 담는다 — 여기가 L4 표면", () => {
    renderWithI18n(<AdvancedMode progress={empty} />);
    expect(screen.getByText("프로파일 설정 자리")).toBeTruthy();
    expect(screen.getByText("연결 상태 자리")).toBeTruthy();
  });

  it("계획 단계를 보여준다", () => {
    renderWithI18n(
      <AdvancedMode
        progress={{
          plan: {
            goal: "제목이 있는 프레임",
            steps: [
              { index: 1, instruction: "frame 생성" },
              { index: 2, instruction: "Heading 추가" },
            ],
          },
          agents: [],
          repairs: [],
        }}
      />,
    );
    expect(screen.getByText("제목이 있는 프레임")).toBeTruthy();
    expect(screen.getByText(/frame 생성/)).toBeTruthy();
    expect(screen.getByText(/Heading 추가/)).toBeTruthy();
  });

  it("역할별 진행과 수리 시도를 보여준다", () => {
    renderWithI18n(
      <AdvancedMode
        progress={{
          plan: null,
          agents: [
            {
              agent: "planner",
              labelKey: "ai.rolePlanner",
              status: "done",
              ok: true,
            },
            {
              agent: "executor",
              labelKey: "ai.roleExecutor",
              status: "running",
            },
          ],
          repairs: [{ attempt: 1, max: 2, issues: ["Heading 이 비었다"] }],
        }}
      />,
    );
    expect(screen.getByText("Planner")).toBeTruthy();
    expect(screen.getByText("Executor")).toBeTruthy();
    expect(screen.getByText(/Heading 이 비었다/)).toBeTruthy();
  });

  it("진행이 없으면 진행 영역을 만들지 않는다", () => {
    renderWithI18n(<AdvancedMode progress={empty} />);
    expect(screen.queryByRole("group", { name: "에이전트 진행" })).toBeNull();
  });
});

describe("요약이 역할 이름을 되풀이하지 않는다", () => {
  it("앞뒤 어느 쪽에 붙어도 지운다", () => {
    expect(trimLabelEcho("실행", "2건 실행")).toBe("2건");
    expect(trimLabelEcho("수리", "수리 1회")).toBe("1회");
    expect(trimLabelEcho("계획", "2단계")).toBe("2단계");
    expect(trimLabelEcho("검증", "이상 없음")).toBe("이상 없음");
  });
});
