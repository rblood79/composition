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
import { ArrowRight, Bot, ImagePlus, Send, UserRound } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useConversationStore } from "../../stores/conversation";
import { useStore } from "../../stores";
import { useAgentLoop } from "./hooks/useAgentLoop";
import { ToolResultMessage } from "./components/ToolResultMessage";
import { AgentControls } from "./components/AgentControls";
import { AgentCommandLogList } from "./components/AgentCommandLogList";
import type {
  BuilderContext,
  ChatMessage as ChatMessageType,
} from "../../../types/integrations/chat.types";
import "./AIPanel.css";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

const EMPTY_ELEMENTS: BuilderContext["elements"] = [];

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

function ChatInput({
  onSend,
  disabled = false,
  placeholder = "무엇이든 물어보세요",
}: ChatInputProps) {
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
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        aria-label="무엇이든 물어보세요"
      />
      <div className="ai-composer-actions">
        <ActionIconButton
          type="button"
          isDisabled
          aria-label="참조 이미지 추가"
          tooltip="참조 이미지 추가 (준비 중)"
          tooltipPlacement="top"
        >
          <ImagePlus size={iconProps.size} />
        </ActionIconButton>
        <ActionIconButton
          type="button"
          onPress={handleSend}
          isDisabled={disabled || !value.trim()}
          aria-label="질문 제출"
          tooltip="질문 제출"
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
}

function ChatContainer({
  messages,
  onSendMessage,
  isDisabled,
  selectedElementType,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const targetLabel = selectedElementType
    ? `선택한 ${formatElementType(selectedElementType)}`
    : "현재 페이지";
  const suggestions = [
    `해주세요: ${targetLabel}의 시각적 계층을 개선해 주세요.`,
    `해주세요: ${targetLabel}의 간격과 정렬을 정리해 주세요.`,
    `보여주세요: ${targetLabel} 편집 방법을 알려 주세요.`,
  ];

  return (
    <div className="panel-contents ai-contents">
      <div className="ai-transcript" aria-live="polite">
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <p className="ai-intro">
              AI와 composition의 강력한 기능을 사용하여 디자인을 개선하세요.
            </p>
            <p className="ai-context-label">
              다음은 {targetLabel}에 대한 맞춤형 아이디어입니다.
            </p>
            <div className="ai-suggestions" role="group" aria-label="추천 요청">
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
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="ai-composer-region">
        <ChatInput onSend={onSendMessage} disabled={isDisabled} />
        <p className="ai-disclaimer">
          AI 생성 응답입니다. 사용하기 전에 확인해야 합니다.
        </p>
      </div>
    </div>
  );
}

/**
 * AIPanelContent - AI 패널 메인 로직
 */
function AIPanelContent() {
  const {
    messages,
    isStreaming,
    isAgentRunning,
    currentTurn,
    runAgent,
    stopAgent,
  } = useAgentLoop();

  // ADR-040: 현재 페이지 요소만 구독 (전체 elements 배열 구독 제거)
  const currentPageId = useStore((state) => state.currentPageId);
  const pageElements =
    useStore((state) =>
      state.currentPageId
        ? state.pageElementsSnapshot[state.currentPageId]
        : undefined,
    ) ?? EMPTY_ELEMENTS;
  const selectedElementId = useStore((state) => state.selectedElementId);
  const selectedElementType = selectedElementId
    ? pageElements.find((element) => element.id === selectedElementId)?.type
    : undefined;

  const { updateContext, clearConversation } = useConversationStore();

  /**
   * Update context whenever builder state changes
   */
  useEffect(() => {
    const context: BuilderContext = {
      currentPageId: currentPageId || "default",
      selectedElementId: selectedElementId || undefined,
      elements: pageElements.map((el) => ({
        id: el.id,
        type: el.type,
        props: el.props as Record<string, unknown>,
        parent_id: el.parent_id ?? null,
      })),
      recentChanges: [],
    };

    updateContext(context);
  }, [pageElements, selectedElementId, currentPageId, updateContext]);

  const isDisabled = isStreaming || isAgentRunning;

  return (
    <div className="panel">
      <PanelHeader
        icon={<Bot size={iconProps.size} />}
        title="AI Assistant"
        actions={
          <>
            {isAgentRunning && (
              <AgentControls currentTurn={currentTurn} onStop={stopAgent} />
            )}
            {messages.length > 0 && !isAgentRunning && (
              <ActionIconButton
                onPress={clearConversation}
                type="button"
                aria-label="Clear conversation"
                tooltip="대화 초기화"
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
      <AgentCommandLogList />
      <ChatContainer
        messages={messages}
        onSendMessage={runAgent}
        isDisabled={isDisabled}
        selectedElementType={selectedElementType}
      />
    </div>
  );
}

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function AIPanel() {
  return <AIPanelContent />;
}
