/**
 * ADR-134 G4 — `bind_collection` 이 만든 바인딩을 **실제 소비자가 렌더**하는가.
 *
 * Preview 가 쓰는 것과 같은 컴포넌트·같은 훅 경로 (`ListBox` → `useResolvedCollectionItems`
 * → `useCollectionData`) 에 도구 산출물을 그대로 넣어 항목이 그려지는지 본다. iframe 전송
 * 계층만 빠진 형태라, "도구가 만든 값이 렌더까지 간다" 를 자기 확인 없이 검증한다
 * (도구가 부르는 함수를 다시 부르는 것이 아니라, 소비자 컴포넌트를 렌더한다).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListBox } from "@composition/shared/components";
import type { SerializedDataBinding } from "@composition/shared";

/** `bind_collection` 이 static source 에 대해 만드는 값과 동일한 형태. */
const AI_BINDING: SerializedDataBinding = {
  type: "collection",
  source: "static",
  config: {
    data: [
      { id: "ai-1", name: "AI 항목 1" },
      { id: "ai-2", name: "AI 항목 2" },
      { id: "ai-3", name: "AI 항목 3" },
    ],
  },
};

describe("bind_collection 산출물 → 컬렉션 렌더 (G4)", () => {
  // 자동 cleanup 이 설정돼 있지 않아 이전 렌더가 DOM 에 남는다 (대조군이 오염된다)
  afterEach(() => cleanup());

  it("ListBox 가 바인딩된 3건을 그린다", async () => {
    render(
      <ListBox aria-label="AI 바인딩 목록" dataBinding={AI_BINDING as never} />,
    );

    await waitFor(() => {
      expect(screen.getByText("AI 항목 1")).toBeTruthy();
    });
    expect(screen.getByText("AI 항목 2")).toBeTruthy();
    expect(screen.getByText("AI 항목 3")).toBeTruthy();
  });

  it("바인딩이 없으면 그 항목들은 그려지지 않는다 (대조군)", () => {
    render(<ListBox aria-label="빈 목록" />);
    expect(screen.queryByText("AI 항목 1")).toBeNull();
  });
});
