/**
 * ADR-111 P3-γ — selectReusableLayout 의 frame editing indicator 갱신 통합 테스트
 *
 * 본 테스트는 `selectReusableLayout(frameId)` 호출이 canonical frame selection store 의
 * `selectedReusableLayoutId` 필드를 정확히 갱신하는지 (mock 없이) 검증한다.
 *
 * P3-γ 결정 (옵션 B): frame editing indicator 는 `selectedReusableLayoutId` 가 SSOT.
 * `editingContextId` 는 element-id-typed 이므로 frameId 직접 대입 시 click target
 * 분해 (resolveClickTarget) 실패 → 자동 exit 회귀 위험 → 별도 필드 유지.
 *
 * 캔버스 read path 통합은 P3-δ Skia render 에서 진행 (dead read 회피).
 */

import { describe, it, expect, beforeEach } from "vitest";

import { useReusableLayoutSelectionStore } from "@/builder/stores/canonical/reusableLayoutStore";
import { selectReusableLayout } from "../reusableLayoutActions";

describe("ADR-111 P3-γ selectReusableLayout → selectedReusableLayoutId 갱신", () => {
  beforeEach(() => {
    useReusableLayoutSelectionStore.setState({
      selectedReusableLayoutId: null,
    });
  });

  it("frameId 전달 시 selectedReusableLayoutId 가 frameId 로 갱신", () => {
    selectReusableLayout("frame-A");

    expect(
      useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
    ).toBe("frame-A");
  });

  it("null 전달 시 selectedReusableLayoutId 가 해제", () => {
    useReusableLayoutSelectionStore.setState({
      selectedReusableLayoutId: "frame-existing",
    });

    selectReusableLayout(null);

    expect(
      useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
    ).toBeNull();
  });

  it("연속 호출 시 마지막 frameId 가 유지 (toggle 시나리오)", () => {
    selectReusableLayout("frame-A");
    selectReusableLayout("frame-B");
    selectReusableLayout("frame-C");

    expect(
      useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
    ).toBe("frame-C");
  });

  it("store 에 currentLayoutId backward-compat alias 를 다시 만들지 않는다", () => {
    selectReusableLayout("frame-X");

    expect(
      "currentLayoutId" in useReusableLayoutSelectionStore.getState(),
    ).toBe(false);
  });
});
