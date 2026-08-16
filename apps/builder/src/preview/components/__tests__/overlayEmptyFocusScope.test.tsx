/**
 * 내용이 없는 overlay 가 열려도 트리가 살아 있어야 한다.
 *
 * **Why (2026-08-16 라이브 실측)**: 자식 없는 Modal 을 열자 preview 가 통째로
 * 비었다. `@react-aria/focus` 의 `FocusScope` 는 sentinel 사이의 DOM 노드를 모아
 * `scope` 배열로 두는데, 내용이 없으면 그 배열이 **빈 배열**이 된다. `useAutoFocus`
 * 의 가드는 `scopeRef.current` 존재만 보므로 빈 배열도 통과하고 —
 * `getFirstInScope` 가 `scope[0].previousElementSibling` 에서 죽는다.
 *
 * 빌더에서 "요소를 놓기만 하고 아직 내용을 안 채운 overlay" 는 일상적인 상태다.
 * 그 상태가 미리보기 전체를 날리면 안 된다.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Form, Modal } from "@composition/shared/components";

/** 닫힌 overlay 처럼 자식은 있는데 DOM 노드는 0 인 형태. */
function RendersNothing() {
  return null;
}

describe("내용 없는 overlay 의 FocusScope", () => {
  it("자식이 아예 없는 Modal 을 열어도 죽지 않는다", () => {
    expect(() => render(<Modal isOpen />)).not.toThrow();
  });

  it("자식이 있지만 아무것도 렌더하지 않는 Modal 도 죽지 않는다", () => {
    // React 자식 수는 1 이라 `Children.count` 로는 못 거른다 — DOM 을 봐야 한다.
    expect(() =>
      render(
        <Modal isOpen>
          <RendersNothing />
        </Modal>,
      ),
    ).not.toThrow();
  });

  it("내용이 있으면 종전대로 렌더한다", () => {
    const { getByRole } = render(
      <Modal isOpen>
        <button type="button">확인</button>
      </Modal>,
    );
    expect(getByRole("button", { name: "확인" })).toBeTruthy();
  });

  it("autoFocus 를 켠 빈 Form 도 죽지 않는다", () => {
    expect(() => render(<Form autoFocus />)).not.toThrow();
  });
});
