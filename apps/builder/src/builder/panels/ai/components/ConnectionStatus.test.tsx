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
  saveAgentProfiles,
} from "../../../../services/ai/providers/agentProfiles";
import type { AgentProfileConfig } from "../../../../services/ai/providers/AgentProfileRegistry";
import { ConnectionStatus } from "./ConnectionStatus";

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

describe("ConnectionStatus", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    resetAgentProfileRegistry();
    localStorage.clear();
  });

  it("아무것도 없으면 로컬 endpoint 를 안내한다", () => {
    loadProfiles({ main: { ...localCfg("") } });
    render(<ConnectionStatus />);
    expect(screen.getByText(/에이전트 프로파일 미구성/)).toBeTruthy();
    expect(screen.getByText(/localhost:11434/)).toBeTruthy();
  });

  it("역할별 프로파일과 모델을 그린다", () => {
    loadProfiles({
      planner: localCfg("plan-model"),
      executor: localCfg("exec-model"),
      verifier: localCfg("verify-model"),
      fast: localCfg("fast-model"),
    });
    render(<ConnectionStatus />);
    for (const label of ["계획", "실행", "검증", "분류"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/plan-model/)).toBeTruthy();
    expect(screen.getByText(/verify-model/)).toBeTruthy();
  });

  it("내림이 있으면 사유를 보여 준다 (조용한 내림 금지)", () => {
    loadProfiles({ main: localCfg("only-main") });
    render(<ConnectionStatus />);
    // 계획 프로파일이 없어 기본으로 내려간 사실이 문장으로 나온다
    expect(screen.getAllByText(/기본 프로파일로 실행합니다/).length).toBeGreaterThan(0);
  });

  it("로컬·사설망이면 폐쇄망 배지를 붙인다", () => {
    loadProfiles({ main: localCfg("m") });
    render(<ConnectionStatus />);
    expect(screen.getAllByText(/폐쇄망/).length).toBeGreaterThan(0);
  });

  it("원격 endpoint 에는 폐쇄망 배지를 붙이지 않는다", () => {
    loadProfiles({ main: remoteCfg("m") });
    render(<ConnectionStatus />);
    expect(screen.queryByText(/폐쇄망/)).toBeNull();
  });
});
