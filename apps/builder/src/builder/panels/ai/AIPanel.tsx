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
import type { PanelProps } from "../core/types";
import { PanelHeader } from "../../components";
import { Button } from "@composition/shared/components";
import { MessageCircle, Trash2, Bot } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useConversationStore } from "../../stores/conversation";
import { useStore } from "../../stores";
import { useAgentLoop } from "./hooks/useAgentLoop";
import { ToolResultMessage } from "./components/ToolResultMessage";
import { AgentControls } from "./components/AgentControls";
import type {
  BuilderContext,
  ChatMessage as ChatMessageType,
} from "../../../types/integrations/chat.types";
import "./AIPanel.css";

const EMPTY_ELEMENTS: BuilderContext["elements"] = [];

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

  const getAvatarLabel = () => {
    if (role === "user") return "U";
    if (role === "assistant") return "AI";
    return "?";
  };

  return (
    <div className="chat-message" data-role={role} data-status={status}>
      <div className="avatar">{getAvatarLabel()}</div>

      <div className="content">
        <div className="bubble">{content}</div>
        <div className="timestamp">{formatTimestamp(timestamp)}</div>
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
  placeholder = "메시지를 입력하세요... (Shift+Enter로 줄바꿈)",
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
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="메시지 입력"
      />
      <Button
        onPress={handleSend}
        isDisabled={disabled || !value.trim()}
        aria-label="전송"
        variant="primary"
        size="sm"
      >
        전송
      </Button>
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
}

function ChatContainer({
  messages,
  onSendMessage,
  isDisabled,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const suggestions = ["빨간 버튼 추가", "테이블 생성", "선택한 요소 수정"];

  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={32} strokeWidth={1} />
            <p>AI 어시스턴트에게 디자인을 요청하세요</p>
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="suggestion-btn"
                  onClick={() => onSendMessage(s)}
                  type="button"
                >
                  {s}
                </button>
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

      <ChatInput onSend={onSendMessage} disabled={isDisabled} />
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
    <div className="ai-panel">
      <PanelHeader
        icon={<Bot size={iconProps.size} />}
        title="AI Assistant"
        actions={
          <>
            {isAgentRunning && (
              <AgentControls currentTurn={currentTurn} onStop={stopAgent} />
            )}
            {messages.length > 0 && !isAgentRunning && (
              <button
                className="iconButton"
                onClick={clearConversation}
                type="button"
                aria-label="Clear conversation"
                title="대화 초기화"
              >
                <Trash2
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </button>
            )}
          </>
        }
      />
      <ChatContainer
        messages={messages}
        onSendMessage={runAgent}
        isDisabled={isDisabled}
      />
    </div>
  );
}

export function AIPanel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;
  }

  return <AIPanelContent />;
}
