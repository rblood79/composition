/**
 * ADR-199 Phase 1 — 표면 노출 축 descriptor 의 동작 고정.
 *
 * 기준선은 Phase 0 freeze (`docs/adr/evidence/199-surface-inventory.md` §4)
 * 의 **4상태 × 3표면 대조표**다. Phase 2 에서 표면이 이 배열을 소비하기 전에
 * 배열 자신이 그 표를 재현하는지 먼저 못박는다 — 이관 후 항목이 하나 빠지거나
 * 순서가 뒤집혀도 live 까지 가야 알던 것을 여기서 잡는다 (R1).
 */
import { describe, expect, it } from "vitest";
import {
  COMPONENT_SEMANTICS_ACTIONS,
  formatBilingualLabel,
  resolveComponentSemanticsActions,
  type ActionAvailabilityContext,
  type EditingSemanticsTarget,
} from "./componentSemanticsActions";

const ctx = (
  overrides: Partial<ActionAvailabilityContext> = {},
): ActionAvailabilityContext => ({
  hasResolvedOrigin: false,
  instanceCount: 0,
  selectionSize: 1,
  ...overrides,
});

const STANDARD: EditingSemanticsTarget = { id: "e1" };
const ORIGIN: EditingSemanticsTarget = { id: "e2", reusable: true };
const INSTANCE: EditingSemanticsTarget = { id: "e3", ref: "e2" };
const INSTANCE_ORIGIN: EditingSemanticsTarget = {
  id: "e4",
  ref: "e2",
  reusable: true,
};

const ids = (
  surface: Parameters<typeof resolveComponentSemanticsActions>[0],
  target: EditingSemanticsTarget,
  context = ctx(),
) => resolveComponentSemanticsActions(surface, target, context).map((a) => a.id);

const labelOf = (
  target: EditingSemanticsTarget,
  id: string,
  context = ctx(),
) => {
  const action = COMPONENT_SEMANTICS_ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error(`no descriptor: ${id}`);
  return action.label(target, context);
};

describe("COMPONENT_SEMANTICS_ACTIONS — 정의 축", () => {
  it("배열 순서가 노출 순서의 정본 (패널·바 기준)", () => {
    expect(COMPONENT_SEMANTICS_ACTIONS.map((a) => a.id)).toEqual([
      "go-to-origin",
      "detach-instance",
      "select-instances",
      "toggle-component-origin",
    ]);
  });

  it("id 는 중복 없고, 명령 축 연결은 실행 가능한 두 액션에만 있다", () => {
    const all = COMPONENT_SEMANTICS_ACTIONS.map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    expect(
      COMPONENT_SEMANTICS_ACTIONS.filter((a) => a.commandId).map((a) => [
        a.id,
        a.commandId,
      ]),
    ).toEqual([
      ["detach-instance", "detachInstance"],
      ["toggle-component-origin", "toggleComponentOrigin"],
    ]);
  });

  it("select-instances 는 패널 전용 — 메뉴·바 계약에 없다", () => {
    const select = COMPONENT_SEMANTICS_ACTIONS.find(
      (a) => a.id === "select-instances",
    );
    expect(select?.surfaces).toEqual(["properties-panel"]);
  });
});

describe("4상태 × 3표면 (Phase 0 freeze §4)", () => {
  it("Standard — 컴포넌트 축 하나", () => {
    expect(ids("properties-panel", STANDARD)).toEqual([
      "toggle-component-origin",
    ]);
    expect(labelOf(STANDARD, "toggle-component-origin").en).toBe(
      "Create component",
    );
  });

  it("Origin (N=0) — 라벨이 분리로 뒤집히고 select-instances 는 서지 않는다", () => {
    expect(ids("properties-panel", ORIGIN)).toEqual([
      "toggle-component-origin",
    ]);
    expect(labelOf(ORIGIN, "toggle-component-origin").en).toBe(
      "Detach component",
    );
  });

  it("Origin (N>0) — select-instances 가 수를 달고 선다", () => {
    const context = ctx({ instanceCount: 3 });
    expect(ids("properties-panel", ORIGIN, context)).toEqual([
      "select-instances",
      "toggle-component-origin",
    ]);
    expect(labelOf(ORIGIN, "select-instances", context)).toEqual({
      en: "Select instances (3)",
      ko: "인스턴스 선택 (3)",
    });
  });

  it("Instance — 두 축이 함께 선다 (컴포넌트 축은 만들기)", () => {
    const context = ctx({ hasResolvedOrigin: true });
    expect(ids("properties-panel", INSTANCE, context)).toEqual([
      "go-to-origin",
      "detach-instance",
      "toggle-component-origin",
    ]);
    expect(labelOf(INSTANCE, "toggle-component-origin").en).toBe(
      "Create component",
    );
  });

  it("Instance·Origin (N>0) — 4개 전부, 컴포넌트 축은 분리", () => {
    const context = ctx({ hasResolvedOrigin: true, instanceCount: 2 });
    expect(ids("properties-panel", INSTANCE_ORIGIN, context)).toEqual([
      "go-to-origin",
      "detach-instance",
      "select-instances",
      "toggle-component-origin",
    ]);
    expect(labelOf(INSTANCE_ORIGIN, "toggle-component-origin").en).toBe(
      "Detach component",
    );
  });

  it("메뉴·바는 같은 상태에서 select-instances 만 빠진다", () => {
    const context = ctx({ hasResolvedOrigin: true, instanceCount: 2 });
    for (const surface of ["context-menu", "action-bar"] as const) {
      expect(ids(surface, INSTANCE_ORIGIN, context)).toEqual([
        "go-to-origin",
        "detach-instance",
        "toggle-component-origin",
      ]);
    }
  });
});

describe("가용 ≠ 활성 (freeze 발산 D3 보존)", () => {
  it("원본을 못 찾은 인스턴스에서 go-to-origin 은 노출되되 비활성", () => {
    const context = ctx({ hasResolvedOrigin: false });
    expect(ids("properties-panel", INSTANCE, context)).toContain(
      "go-to-origin",
    );
    const goTo = COMPONENT_SEMANTICS_ACTIONS.find(
      (a) => a.id === "go-to-origin",
    );
    expect(goTo?.isEnabled?.(INSTANCE, context)).toBe(false);
    expect(goTo?.isEnabled?.(INSTANCE, ctx({ hasResolvedOrigin: true }))).toBe(
      true,
    );
  });
});

describe("사영 불변식 (HC3)", () => {
  it("type 이 렌더 컴포넌트로 해소된 캔버스 사영에서도 같은 결과", () => {
    const context = ctx({ hasResolvedOrigin: true });
    const canonical = { id: "e5", ref: "e2" };
    // 캔버스 상호작용 map 은 type 을 "Button" 으로 해소하고 ref 만 보존한다.
    const projected = { id: "e5", ref: "e2" };
    const legacyMirror = { id: "e5", componentRole: "instance", masterId: "e2" };
    for (const target of [canonical, projected, legacyMirror]) {
      expect(ids("properties-panel", target, context)).toEqual([
        "go-to-origin",
        "detach-instance",
        "toggle-component-origin",
      ]);
    }
  });
});

describe("라벨 어법", () => {
  it("메뉴 병기는 ko / en 조립 한 곳에서", () => {
    expect(formatBilingualLabel(labelOf(ORIGIN, "toggle-component-origin"))).toBe(
      "컴포넌트 분리 / Detach component",
    );
    expect(
      formatBilingualLabel(labelOf(STANDARD, "toggle-component-origin")),
    ).toBe("컴포넌트 만들기 / Create component");
  });
});
