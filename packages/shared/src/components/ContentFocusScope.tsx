import type { ReactNode } from "react";
import { FocusScope } from "@react-aria/focus";

export interface ContentFocusScopeProps {
  /** 포커스를 scope 안에 가둔다 (Tab 순환). */
  contain?: boolean;
  /** 마운트 시 scope 안 첫 포커스 대상으로 이동한다. */
  autoFocus?: boolean;
  /** 언마운트 시 직전 포커스 위치로 되돌린다. */
  restoreFocus?: boolean;
  children?: ReactNode;
}

/**
 * 내용이 비어도 안전한 `FocusScope`.
 *
 * **Why (2026-08-16 라이브 실측 — preview 백지)**: 자식 없는 Modal 을 열면 미리보기
 * 트리가 통째로 죽었다. `@react-aria/focus` 의 `FocusScope` 는 자기가 렌더한 두
 * sentinel `<span>` 사이의 DOM 노드를 모아 `scope` 배열로 들고 있는데, 사이에
 * 아무것도 없으면 그 배열이 **빈 배열**이 된다. 그런데 `useAutoFocus` 의 가드는
 * `scopeRef.current` 의 존재만 보므로 `[]` 도 통과하고, 이어지는
 * `getFirstInScope` 가 `scope[0].previousElementSibling` 에서 죽는다
 * (`getScopeRoot` 의 `scope[0].parentElement` 도 같은 형태).
 *
 * 그래서 **scope 가 비지 않도록 보이지 않는 노드 하나를 항상 넣는다.** 대안이던
 * `React.Children.count(children) === 0` 판정은 부족하다 — 닫힌 overlay 처럼
 * *자식은 있는데 DOM 노드를 하나도 만들지 않는* 형태가 그대로 남는다 (실측: 세
 * 형태 모두 같은 `previousElementSibling` 에서 동일하게 죽었다).
 *
 * 앵커는 `hidden` 이라 레이아웃·접근성 트리·포커스 탐색 어디에도 참여하지 않고,
 * `FocusScope` 자신이 이미 같은 자리에 sentinel `<span hidden>` 두 개를 렌더하고
 * 있어 `:first-child` 가 사용자 내용을 가리키지 않는 상태도 종전 그대로다.
 *
 * 빌더에서 "요소만 놓고 아직 내용을 안 채운 overlay" 는 일상적인 중간 상태다 —
 * 그 상태가 미리보기 전체를 날리면 안 된다.
 *
 * 회귀 감시: `apps/builder/src/preview/components/__tests__/overlayEmptyFocusScope.test.tsx`
 */
export function ContentFocusScope({
  contain,
  autoFocus,
  restoreFocus,
  children,
}: ContentFocusScopeProps) {
  return (
    <FocusScope
      contain={contain}
      autoFocus={autoFocus}
      restoreFocus={restoreFocus}
    >
      <span hidden data-focus-scope-anchor="true" />
      {children}
    </FocusScope>
  );
}
