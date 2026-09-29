import { beforeEach, describe, expect, it } from "vitest";
import { useConversationStore } from "./conversation";

describe("setLastUserTurnContext", () => {
  beforeEach(() => {
    useConversationStore.getState().clearConversation();
  });

  it("마지막 user 메시지에만 턴 컨텍스트를 저장한다", () => {
    const store = useConversationStore.getState();
    store.addUserMessage("첫 요청");
    store.addAssistantMessage("답");
    store.addUserMessage("두 번째 요청");
    store.addAssistantMessage("");

    useConversationStore.getState().setLastUserTurnContext("ctx");

    const messages = useConversationStore.getState().messages;
    expect(messages[0].metadata?.turnContext).toBeUndefined();
    expect(messages[2].metadata?.turnContext).toBe("ctx");
    expect(messages[3].metadata?.turnContext).toBeUndefined();
  });

  it("user 메시지가 없으면 아무것도 바꾸지 않는다", () => {
    useConversationStore.getState().addAssistantMessage("답");
    const before = useConversationStore.getState().messages;

    useConversationStore.getState().setLastUserTurnContext("ctx");

    expect(useConversationStore.getState().messages).toBe(before);
  });
});
