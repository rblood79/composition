/**
 * AIPanel - AI 어시스턴트 패널
 *
 * Tool Calling + Agent Loop 기반 AI 디자인 어시스턴트
 * G.3 시각 피드백 연동 포함
 *
 * 통합된 컴포넌트:
 * - ChatContainer: 메인 채팅 컨테이너
 * - ChatMessage: 개별 메시지 표시
 * - ChatInput: 메시지 입력 필드
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ActionIconButton, PanelHeader } from "../../components";
import { Button } from "@composition/shared/components";
import {
  ArrowRight,
  Bot,
  ImagePlus,
  Send,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useConversationStore } from "../../stores/conversation";
import { useStore } from "../../stores";
import { useAgentLoop } from "./hooks/useAgentLoop";
import { ToolResultMessage } from "./components/ToolResultMessage";
import { AgentControls } from "./components/AgentControls";
import { AgentCommandLogList } from "./components/AgentCommandLogList";
import { AdvancedMode } from "./components/AdvancedMode";
import { ToolCallMessage } from "./components/ToolCallMessage";
import type { ChatMessage as ChatMessageType } from "../../../types/integrations/chat.types";
import "./AIPanel.css";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

function formatElementType(type: string): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/**
 * ChatMessage - 개별 메시지 표시
 */
interface ChatMessageProps {
  message: ChatMessageType;
}

function ChatMessage({ message }: ChatMessageProps) {
  const { role, content, status, timestamp } = message;

  // tool 메시지는 ToolResultMessage로 렌더링
  if (role === "tool") {
    return <ToolResultMessage message={message} />;
  }

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="ai-message" data-role={role} data-status={status}>
      <div className="ai-message-avatar" aria-hidden="true">
        {role === "user" ? <UserRound size={14} /> : <Bot size={14} />}
      </div>

      <div className="ai-message-content">
        <div className="ai-message-bubble">{content}</div>
        <div className="ai-message-timestamp">{formatTimestamp(timestamp)}</div>
      </div>
    </div>
  );
}

/**
 * ChatInput - 메시지 입력 필드
 */
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ChatInput({ onSend, disabled = false, placeholder }: ChatInputProps) {
  const { t } = useI18n();
  const askLabel = placeholder ?? t("ai.askPlaceholder");
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="ai-composer">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={askLabel}
        disabled={disabled}
        rows={3}
        aria-label={askLabel}
      />
      <div className="ai-composer-actions">
        <ActionIconButton
          type="button"
          isDisabled
          aria-label={t("ai.addReferenceImage")}
          tooltip={t("ai.addReferenceImageSoon")}
          tooltipPlacement="top"
        >
          <ImagePlus size={iconProps.size} />
        </ActionIconButton>
        <ActionIconButton
          type="button"
          onPress={handleSend}
          isDisabled={disabled || !value.trim()}
          aria-label={t("ai.submit")}
          tooltip={t("ai.submit")}
          tooltipPlacement="top"
        >
          <Send size={iconProps.size} />
        </ActionIconButton>
      </div>
    </div>
  );
}

/**
 * ChatContainer - 메시지 목록 + 입력
 */
interface ChatContainerProps {
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  isDisabled: boolean;
  selectedElementType?: string;
  /** 실행 중인 도구 이름 — 결과가 나오기 전까지 한 줄로 보인다. */
  runningTool?: string | null;
  /** 에이전트 프로파일이 구성돼 있는가 (R2 온보딩 분기). */
  hasAgent: boolean;
  onOpenAdvanced: () => void;
}

function ChatContainer({
  messages,
  onSendMessage,
  isDisabled,
  selectedElementType,
  runningTool,
  hasAgent,
  onOpenAdvanced,
}: ChatContainerProps) {
  const { t } = useI18n();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const targetLabel = selectedElementType
    ? t("ai.targetSelected", { type: formatElementType(selectedElementType) })
    : t("ai.targetPage");
  const suggestions = [
    t("ai.suggestHierarchy", { target: targetLabel }),
    t("ai.suggestSpacing", { target: targetLabel }),
    t("ai.suggestHowTo", { target: targetLabel }),
  ];

  return (
    <div className="panel-contents ai-contents">
      <div className="ai-transcript" aria-live="polite">
        {messages.length === 0 && !hasAgent ? (
          <div
            className="ai-welcome"
            role="group"
            aria-label={t("ai.welcomeLabel")}
          >
            <p className="ai-intro">{t("ai.welcomeBody")}</p>
            <p className="ai-context-label">{t("ai.welcomeKeyNotice")}</p>
            <div className="ai-suggestions">
              <Button
                className="ai-suggestion"
                variant="secondary"
                size="sm"
                onPress={onOpenAdvanced}
              >
                <Sparkles size={iconProps.size} aria-hidden="true" />
                <span>{t("ai.openAgentSettings")}</span>
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="ai-welcome">
            <p className="ai-intro">{t("ai.intro")}</p>
            <p className="ai-context-label">
              {t("ai.suggestionsIntro", { target: targetLabel })}
            </p>
            <div
              className="ai-suggestions"
              role="group"
              aria-label={t("ai.suggestionsLabel")}
            >
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  className="ai-suggestion"
                  variant="secondary"
                  size="sm"
                  onPress={() => onSendMessage(suggestion)}
                  isDisabled={isDisabled}
                >
                  <ArrowRight size={iconProps.size} aria-hidden="true" />
                  <span>{suggestion}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {runningTool ? (
              <ToolCallMessage name={runningTool} status="running" />
            ) : null}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="ai-composer-region">
        <ChatInput onSend={onSendMessage} disabled={isDisabled} />
        <p className="ai-disclaimer">{t("ai.disclaimer")}</p>
      </div>
    </div>
  );
}

/**
 * AIPanelContent - AI 패널 메인 로직
 */
function AIPanelContent() {
  const { t } = useI18n();
  /**
   * 고급 모드 (ADR-134 Phase 8, D9) — 기본 표면은 입력과 결과만 남기고, 모델 구성·라우팅·
   * 계획 분해는 한 번의 명시적 전환 뒤로 격리한다.
   */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const {
    messages,
    progress,
    runningTool,
    isStreaming,
    isAgentRunning,
    currentTurn,
    hasAgent,
    runAgent,
    stopAgent,
  } = useAgentLoop();

  /**
   * 추천 문구용 타입만 읽는다. AI 에 넘길 컨텍스트는 **턴 시점에** `useAgentLoop` 가
   * 스토어에서 만든다 (`services/ai/builderContext.ts`) — 패널이 감춰져 effect 가
   * 멈춘 동안 제출이 조용히 무시되던 원인이 이 렌더 부수효과였다.
   */
  const selectedElementType = useStore((state) =>
    state.selectedElementId
      ? state.elementsMap?.get(state.selectedElementId)?.type
      : undefined,
  );

  const { clearConversation } = useConversationStore();

  const isDisabled = isStreaming || isAgentRunning;

  return (
    <div className="panel">
      <PanelHeader
        icon={<Bot size={iconProps.size} />}
        title="AI Assistant"
        panelId="ai"
        actions={
          <>
            {isAgentRunning && (
              <AgentControls currentTurn={currentTurn} onStop={stopAgent} />
            )}
            <ActionIconButton
              onPress={() => setAdvancedOpen((open) => !open)}
              type="button"
              aria-label={t("ai.advancedMode")}
              aria-pressed={advancedOpen}
              tooltip={t("ai.advancedModeHint")}
            >
              <Settings2
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
              />
            </ActionIconButton>
            {messages.length > 0 && !isAgentRunning && (
              <ActionIconButton
                onPress={clearConversation}
                type="button"
                aria-label="Clear conversation"
                tooltip={t("ai.resetConversation")}
              >
                <DeleteIcon
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </ActionIconButton>
            )}
          </>
        }
      />
      {advancedOpen ? (
        <div className="panel-contents ai-contents">
          <AdvancedMode progress={progress} />
        </div>
      ) : (
        <>
          <AgentCommandLogList />
          <ChatContainer
            messages={messages}
            onSendMessage={runAgent}
            isDisabled={isDisabled}
            selectedElementType={selectedElementType}
            runningTool={runningTool}
            hasAgent={hasAgent}
            onOpenAdvanced={() => setAdvancedOpen(true)}
          />
        </>
      )}
    </div>
  );
}

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function AIPanel() {
  return <AIPanelContent />;
}
