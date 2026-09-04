/**
 * ADR-134 Phase 7 (D8) — 내림이 화면에 보이는가.
 *
 * Phase 6 의 실제 문제는 계획 프로파일을 설정했다고 믿는데 기본 프로파일이 계획을 세우던
 * 것이었다. 그래서 이 컴포넌트가 확인할 것은 "무엇이 어디로 가는지" 가 실제로 그려지는가다.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAgentProfileRegistry,
  resetAgentProfileRegistry,
} from "../../../../services/ai/providers/agentProfiles";
import type { AgentProfileConfig } from "../../../../services/ai/providers/AgentProfileRegistry";
import { ConnectionStatus } from "./ConnectionStatus";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";

const localCfg = (model: string): AgentProfileConfig => ({
  provider: "openai-compatible",
  baseUrl: "http://localhost:11434/v1",
  model,
});

const remoteCfg = (model: string): AgentProfileConfig => ({
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  model,
});

function loadProfiles(map: Record<string, AgentProfileConfig>) {
  resetAgentProfileRegistry();
  localStorage.setItem("composition.ai.profiles", JSON.stringify(map));
  getAgentProfileRegistry();
}

/** 표시 계층이 `useI18n` 을 쓰므로 provider 밑에서 그린다 (ADR-200 R7). */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("ConnectionStatus", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    resetAgentProfileRegistry();
    localStorage.clear();
  });

  it("아무것도 없으면 로컬 endpoint 를 안내한다", () => {
    loadProfiles({ main: { ...localCfg("") } });
    renderWithI18n(<ConnectionStatus />);
    expect(screen.getByText(/No agent profile configured/)).toBeTruthy();
    expect(screen.getByText(/localhost:11434/)).toBeTruthy();
  });

  it("역할별 프로파일과 모델을 그린다", () => {
    loadProfiles({
      planner: localCfg("plan-model"),
      executor: localCfg("exec-model"),
      verifier: localCfg("verify-model"),
      fast: localCfg("fast-model"),
    });
    renderWithI18n(<ConnectionStatus />);
    for (const label of ["Plan", "Execute", "Verify", "Classify"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/plan-model/)).toBeTruthy();
    expect(screen.getByText(/verify-model/)).toBeTruthy();
  });

  it("내림이 있으면 사유를 보여 준다 (조용한 내림 금지)", () => {
    loadProfiles({ main: localCfg("only-main") });
    renderWithI18n(<ConnectionStatus />);
    // 계획 프로파일이 없어 기본으로 내려간 사실이 문장으로 나온다
    expect(
      screen.getAllByText(/running on the main profile/).length,
    ).toBeGreaterThan(0);
  });

  it("로컬·사설망이면 폐쇄망 배지를 붙인다", () => {
    loadProfiles({ main: localCfg("m") });
    renderWithI18n(<ConnectionStatus />);
    expect(screen.getAllByText(/Private/).length).toBeGreaterThan(0);
  });

  it("원격 endpoint 에는 폐쇄망 배지를 붙이지 않는다", () => {
    loadProfiles({ main: remoteCfg("m") });
    renderWithI18n(<ConnectionStatus />);
    expect(screen.queryByText(/Private/)).toBeNull();
  });
});
