/**
 * ADR-212 Phase 2 R1 — 셀 편집 키 충돌 매트릭스. RAC Table (`keyboardNavigationBehavior="tab"`)
 * 이 처리하는 키 (Arrow · Home/End · Tab · Esc) 와 편집기가 가로채는 키가 편집/비편집 상태에서
 * 어느 쪽으로 가는지 순수 함수 하나가 정한다 — 컴포넌트는 그 결과만 실행한다.
 */
import { describe, expect, it } from "vitest";
import { resolveGridKey, type GridKeyInput } from "./gridKeys";

const key = (
  k: string,
  mods: Partial<Omit<GridKeyInput, "key">> = {},
): GridKeyInput => ({
  key: k,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

describe("resolveGridKey — 비편집 (포커스가 gridcell)", () => {
  const ctx = { editing: false, targetIsCell: true };
  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"])(
    "%s 는 RAC 에 그대로 (pass)",
    (k) => {
      expect(resolveGridKey(key(k), ctx)).toEqual({ type: "pass" });
    },
  );
  it("Enter · F2 는 편집 진입", () => {
    expect(resolveGridKey(key("Enter"), ctx)).toEqual({ type: "start-edit" });
    expect(resolveGridKey(key("F2"), ctx)).toEqual({ type: "start-edit" });
  });
  it("문자 타이핑은 그 글자로 편집 진입 (RAC typeahead 보다 먼저)", () => {
    expect(resolveGridKey(key("a"), ctx)).toEqual({
      type: "start-edit",
      initialDraft: "a",
    });
    expect(resolveGridKey(key("7"), ctx)).toEqual({
      type: "start-edit",
      initialDraft: "7",
    });
  });
  it("Space 는 편집 진입이 아니다 (RAC 선택 키)", () => {
    expect(resolveGridKey(key(" "), ctx)).toEqual({ type: "pass" });
  });
  it("Delete · Backspace 는 셀 비우기", () => {
    expect(resolveGridKey(key("Delete"), ctx)).toEqual({ type: "clear-cell" });
    expect(resolveGridKey(key("Backspace"), ctx)).toEqual({
      type: "clear-cell",
    });
  });
  it("Tab · Esc 는 RAC 에 (단일 tab stop · 선택 해제)", () => {
    expect(resolveGridKey(key("Tab"), ctx)).toEqual({ type: "pass" });
    expect(resolveGridKey(key("Escape"), ctx)).toEqual({ type: "pass" });
  });
  it("⌘Z · ⌘⇧Z · ⌘C 같은 조합은 전역 단축키로 (pass)", () => {
    expect(resolveGridKey(key("z", { metaKey: true }), ctx)).toEqual({
      type: "pass",
    });
    expect(
      resolveGridKey(key("z", { metaKey: true, shiftKey: true }), ctx),
    ).toEqual({ type: "pass" });
    expect(resolveGridKey(key("c", { ctrlKey: true }), ctx)).toEqual({
      type: "pass",
    });
  });
  it("포커스가 셀이 아니면 (툴바 버튼 등) 전부 pass", () => {
    const other = { editing: false, targetIsCell: false };
    expect(resolveGridKey(key("Enter"), other)).toEqual({ type: "pass" });
    expect(resolveGridKey(key("a"), other)).toEqual({ type: "pass" });
    expect(resolveGridKey(key("Delete"), other)).toEqual({ type: "pass" });
  });
});

describe("resolveGridKey — 편집 중 (포커스가 셀 안 input)", () => {
  const ctx = { editing: true, targetIsCell: false };
  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"])(
    "%s 는 caret 이동 — RAC 전파 차단 (stop)",
    (k) => {
      expect(resolveGridKey(key(k), ctx)).toEqual({ type: "stop" });
    },
  );
  it("Enter 는 commit + 아래, ⇧Enter 는 commit + 위", () => {
    expect(resolveGridKey(key("Enter"), ctx)).toEqual({
      type: "commit",
      move: "down",
    });
    expect(resolveGridKey(key("Enter", { shiftKey: true }), ctx)).toEqual({
      type: "commit",
      move: "up",
    });
  });
  it("Tab 은 commit + 오른쪽, ⇧Tab 은 commit + 왼쪽", () => {
    expect(resolveGridKey(key("Tab"), ctx)).toEqual({
      type: "commit",
      move: "right",
    });
    expect(resolveGridKey(key("Tab", { shiftKey: true }), ctx)).toEqual({
      type: "commit",
      move: "left",
    });
  });
  it("Esc 는 취소 (셀로 포커스 복귀)", () => {
    expect(resolveGridKey(key("Escape"), ctx)).toEqual({ type: "cancel" });
  });
  it("⌘Z 는 초안 되돌리기 (전역 History 로 가지 않음) · ⌘⇧Z 는 stop", () => {
    expect(resolveGridKey(key("z", { metaKey: true }), ctx)).toEqual({
      type: "revert-draft",
    });
    expect(resolveGridKey(key("z", { ctrlKey: true }), ctx)).toEqual({
      type: "revert-draft",
    });
    expect(
      resolveGridKey(key("z", { metaKey: true, shiftKey: true }), ctx),
    ).toEqual({ type: "stop" });
  });
  it("타이핑 · Delete · Backspace · F2 · Space 는 input 기본 동작 (stop)", () => {
    for (const k of ["a", "Delete", "Backspace", "F2", " "]) {
      expect(resolveGridKey(key(k), ctx)).toEqual({ type: "stop" });
    }
  });
  it("⌘C · ⌘V 같은 편집 조합은 input 기본 동작 (pass — 전역 단축키가 input 을 존중)", () => {
    expect(resolveGridKey(key("c", { metaKey: true }), ctx)).toEqual({
      type: "pass",
    });
    expect(resolveGridKey(key("v", { metaKey: true }), ctx)).toEqual({
      type: "pass",
    });
  });
});
