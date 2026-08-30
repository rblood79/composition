/**
 * agent 명령 승인 다이얼로그 host (ADR-196 Phase 3).
 *
 * `confirm: true` 명령을 agent 가 부르면 여기서 사용자에게 묻는다. 기존
 * `EditingSemanticsImpactDialogHost` 와 같은 구조지만 별도 채널인 이유: 저쪽은 origin
 * 편집 영향/detach 라는 특정 편집 의미를 설명하는 다이얼로그이고, 이쪽은 "agent 가 무엇을
 * 하려는가" 를 보여 준다 (호출자·명령 id·되돌림 가능 여부).
 */
import { useEffect, useState } from "react";
import { SHORTCUT_DEFINITIONS } from "../../config/keyboardShortcuts";
import { formatShortcut } from "../../hooks/useKeyboardShortcutsRegistry";
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
import { useI18n } from "@/i18n";
import "./AgentCommandConfirmDialog.css";

/** 호출자 표기 — 키만 두고 문구는 카탈로그가 갖는다 (ADR-200 후속). */
const HOST_LABEL_KEYS: Record<string, string> = {
  "ai-panel": "agentConfirm.hostAiPanel",
  "chrome-mcp": "agentConfirm.hostChromeMcp",
  mcp: "agentConfirm.hostMcp",
};

/**
 * 본문은 한 문장이라 통째로 번역한다 — 조각으로 쪼개면 어순이 다른 언어에서
 * 문장이 깨진다. `<strong>` 을 유지하려고 요약 자리에 sentinel 을 넣고 자른다.
 */
const SUMMARY_SLOT = "\u0000";

export function AgentCommandConfirmDialogHost() {
  const { t } = useI18n();
  const [request, setRequest] =
    useState<AgentCommandConfirmationRequest | null>(null);

  useEffect(() => subscribeAgentCommandConfirmation(setRequest), []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && request) resolveAgentCommandConfirmation(false);
  };

  // 표기는 정의에서 파생한다 — 하드코딩하면 바인딩이 바뀔 때 조용히 어긋난다
  // (ADR-182 후속에서 실제로 3건이 어긋나 있었다).
  const undoLabel = formatShortcut(SHORTCUT_DEFINITIONS.undo);

  const hostLabel = t(
    HOST_LABEL_KEYS[request?.host ?? ""] ?? "agentConfirm.hostUnknown",
  );
  const [bodyBefore, bodyAfter] = t("agentConfirm.body", {
    host: hostLabel,
    summary: SUMMARY_SLOT,
  }).split(SUMMARY_SLOT);

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
              {t("agentConfirm.title")}
            </Heading>
          </div>
          <div className="agent-confirm-body">
            <p>
              {bodyBefore}
              <strong>{request?.summary ?? ""}</strong>
              {bodyAfter}
            </p>
            <p className="agent-confirm-meta" data-testid="agent-confirm-meta">
              {request?.id} · {request?.mutation} ·{" "}
              {request?.undo === "history"
                ? t("agentConfirm.undoable", { shortcut: undoLabel })
                : t("agentConfirm.notUndoable")}
            </p>
          </div>
          <div className="agent-confirm-actions">
            <Button
              className="control-button"
              onPress={() => resolveAgentCommandConfirmation(false)}
            >
              {t("agentConfirm.reject")}
            </Button>
            <Button
              autoFocus
              className="control-button"
              data-variant="primary"
              onPress={() => resolveAgentCommandConfirmation(true)}
            >
              {t("agentConfirm.approve")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
