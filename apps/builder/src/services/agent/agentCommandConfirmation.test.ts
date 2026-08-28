/**
 * ADR-196 Phase 3 — 승인 채널: host 없으면 거부 (native confirm 으로 물러서지 않는다).
 */
import { describe, expect, it, vi } from "vitest";
import {
  hasAgentCommandConfirmationHost,
  requestAgentCommandConfirmation,
  resolveAgentCommandConfirmation,
  subscribeAgentCommandConfirmation,
  type AgentCommandConfirmationRequest,
} from "./agentCommandConfirmation";

const request: AgentCommandConfirmationRequest = {
  id: "delete",
  summary: "Delete Element",
  mutation: "document",
  undo: "history",
  host: "chrome-mcp",
};

describe("agentCommandConfirmation", () => {
  it("host 가 없으면 승인 요청은 즉시 거부된다 (window.confirm 미사용)", async () => {
    const nativeConfirm = vi.fn(() => true);
    vi.stubGlobal("confirm", nativeConfirm);
    expect(hasAgentCommandConfirmationHost()).toBe(false);
    await expect(requestAgentCommandConfirmation(request)).resolves.toBe(false);
    expect(nativeConfirm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("host 가 있으면 요청이 전달되고 resolve 로 닫힌다", async () => {
    const seen: (AgentCommandConfirmationRequest | null)[] = [];
    const unsubscribe = subscribeAgentCommandConfirmation((r) => seen.push(r));
    expect(hasAgentCommandConfirmationHost()).toBe(true);

    const pending = requestAgentCommandConfirmation(request);
    expect(seen.at(-1)).toMatchObject({ id: "delete", host: "chrome-mcp" });

    resolveAgentCommandConfirmation(true);
    await expect(pending).resolves.toBe(true);
    expect(seen.at(-1)).toBeNull();

    unsubscribe();
    expect(hasAgentCommandConfirmationHost()).toBe(false);
  });

  it("승인 대기 중 새 요청이 오면 앞 요청은 거부로 닫힌다", async () => {
    const unsubscribe = subscribeAgentCommandConfirmation(() => {});
    const first = requestAgentCommandConfirmation(request);
    const second = requestAgentCommandConfirmation({ ...request, id: "cut" });
    await expect(first).resolves.toBe(false);

    resolveAgentCommandConfirmation(true);
    await expect(second).resolves.toBe(true);
    unsubscribe();
  });
});
