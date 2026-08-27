// @vitest-environment node
/**
 * ADR-158 Phase 3 — 실행 override 층 계약.
 *
 * **Why (2026-08-16 라이브 실측)**: dispatcher 는 성공을 돌려주는데 화면이 안
 * 바뀌었다. canonical 렌더 경로(`CanonicalNodeRenderer`)가 `elements` 배열이
 * 아니라 **문서 노드 props** 를 읽기 때문이다. 그래서 두 가지가 필요했다 —
 *
 *   1. patch 를 쌓을 별도 층 (`interactionOverrides`) 과 렌더 시점 병합
 *   2. 대상 조회를 legacy `elementsById` 가 아니라 **렌더가 읽는 것과 같은 트리**
 *      에서 하기 (실측 실패 사유: "대상 요소 없음")
 *
 * 두 결함 모두 단위 테스트가 없으면 조용히 재발한다 — dispatcher 자체는 계속
 * `ok: true` 를 돌려주기 때문이다.
 */
import { describe, expect, it } from "vitest";
import { createRuntimeStore } from "../../store/runtimeStore";

describe("interactionOverrides — 실행 patch 보관", () => {
  it("patch 를 elementId 별로 누적한다", () => {
    const store = createRuntimeStore();
    store.getState().patchInteractionOverride("a", { isOpen: true });
    store
      .getState()
      .patchInteractionOverride("a", { style: { display: "none" } });

    expect(store.getState().interactionOverrides.a).toEqual({
      isOpen: true,
      style: { display: "none" },
    });
  });

  it("빈 patch 는 무시한다 (불필요한 렌더 방지)", () => {
    const store = createRuntimeStore();
    const before = store.getState().interactionOverrides;
    store.getState().patchInteractionOverride("a", {});
    expect(store.getState().interactionOverrides).toBe(before);
  });

  it("문서가 새로 오면 override 를 버린다", () => {
    const store = createRuntimeStore();
    store.getState().patchInteractionOverride("a", { isOpen: true });
    store.getState().setCanonicalDocument({ version: "x" } as never);

    // 편집 결과를 실행 잔재가 덮은 채로 남으면 사용자가 방금 바꾼 값이
    // preview 에서 무시되는 것처럼 보인다.
    expect(store.getState().interactionOverrides).toEqual({});
  });

  it("다른 요소의 override 는 서로 간섭하지 않는다", () => {
    const store = createRuntimeStore();
    store.getState().patchInteractionOverride("a", { isOpen: true });
    store.getState().patchInteractionOverride("b", { isOpen: false });

    expect(store.getState().interactionOverrides).toEqual({
      a: { isOpen: true },
      b: { isOpen: false },
    });
  });

  it("clear 로 전체를 비운다", () => {
    const store = createRuntimeStore();
    store.getState().patchInteractionOverride("a", { isOpen: true });
    store.getState().clearInteractionOverrides();
    expect(store.getState().interactionOverrides).toEqual({});
  });
});
