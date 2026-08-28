/**
 * agent 명령 승인 다이얼로그 host (ADR-196 Phase 3).
 *
 * `confirm: true` 명령을 agent 가 부르면 여기서 사용자에게 묻는다. 기존
 * `EditingSemanticsImpactDialogHost` 와 같은 구조지만 별도 채널인 이유: 저쪽은 origin
 * 편집 영향/detach 라는 특정 편집 의미를 설명하는 다이얼로그이고, 이쪽은 "agent 가 무엇을
 * 하려는가" 를 보여 준다 (호출자·명령 id·되돌림 가능 여부).
 */
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ShieldAlert } from "lucide-react";
import {
  resolveAgentCommandConfirmation,
  subscribeAgentCommandConfirmation,
  type AgentCommandConfirmationRequest,
} from "../../../services/agent/agentCommandConfirmation";
import "./AgentCommandConfirmDialog.css";

const HOST_LABEL: Record<string, string> = {
  "ai-panel": "AI 패널",
  "chrome-mcp": "외부 agent (Chrome MCP)",
  mcp: "외부 agent (MCP)",
};

export function AgentCommandConfirmDialogHost() {
  const [request, setRequest] =
    useState<AgentCommandConfirmationRequest | null>(null);

  useEffect(() => subscribeAgentCommandConfirmation(setRequest), []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && request) resolveAgentCommandConfirmation(false);
  };

  return (
    <ModalOverlay
      className="agent-confirm-overlay"
      isDismissable
      isOpen={Boolean(request)}
      onOpenChange={handleOpenChange}
    >
      <Modal className="agent-confirm-modal">
        <Dialog aria-label="Agent command approval">
          <div className="agent-confirm-header">
            <ShieldAlert aria-hidden="true" size={18} />
            <Heading className="agent-confirm-title" slot="title">
              명령 실행 승인
            </Heading>
          </div>
          <div className="agent-confirm-body">
            <p>
              {HOST_LABEL[request?.host ?? ""] ?? "agent"} 가{" "}
              <strong>{request?.summary ?? ""}</strong> 를 실행하려 합니다.
            </p>
            <p className="agent-confirm-meta" data-testid="agent-confirm-meta">
              {request?.id} · {request?.mutation} ·{" "}
              {request?.undo === "history"
                ? "실행 후 되돌리기(⌘Z) 1회로 복원"
                : "되돌릴 수 없음"}
            </p>
          </div>
          <div className="agent-confirm-actions">
            <Button
              className="agent-confirm-button agent-confirm-button--secondary"
              onPress={() => resolveAgentCommandConfirmation(false)}
            >
              거부
            </Button>
            <Button
              autoFocus
              className="agent-confirm-button agent-confirm-button--primary"
              onPress={() => resolveAgentCommandConfirmation(true)}
            >
              실행
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
