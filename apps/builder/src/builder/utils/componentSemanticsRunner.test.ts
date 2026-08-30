// @vitest-environment jsdom
/**
 * ADR-199 Phase 3 — 공통 실행 경로의 계약.
 *
 * R2 의 대응이 "4곳 문구를 스냅샷으로 고정" 이므로, 표면이 넘기는 element 만
 * 다르고 규칙은 하나라는 것을 여기서 못박는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../stores";
import {
  resolveComponentSemanticsLabel,
  runComponentSemanticsAction,
} from "./componentSemanticsRunner";
import {
  subscribeEditingSemanticsImpactConfirmation,
  resolveEditingSemanticsImpactConfirmation,
  type EditingSemanticsConfirmationRequest,
} from "./editingSemanticsImpactConfirmation";

type Captured = EditingSemanticsConfirmationRequest | null;

function captureConfirmation(answer: boolean) {
  let seen: Captured = null;
  const unsubscribe = subscribeEditingSemanticsImpactConfirmation((request) => {
    if (!request) return;
    seen = request;
    queueMicrotask(() => resolveEditingSemanticsImpactConfirmation(answer));
  });
  return { get: () => seen, unsubscribe };
}

const ORIGIN = {
  id: "origin-1",
  type: "Button",
  componentName: "PrimaryAction",
  page_id: "page-2",
};
const INSTANCE = { id: "instance-1", type: "ref", ref: "origin-1" };

describe("resolveComponentSemanticsLabel — 패널 규칙 (R2)", () => {
  it("자기 이름이 있으면 그것", () => {
    expect(
      resolveComponentSemanticsLabel(
        { componentName: "Saved", customId: "btn_1", type: "Button" },
        ORIGIN,
        "id",
      ),
    ).toBe("Saved");
  });

  it("자기 이름이 없으면 customId, 그다음 원본 이름을 되짚는다", () => {
    expect(
      resolveComponentSemanticsLabel({ customId: "btn_1" }, ORIGIN, "id"),
    ).toBe("btn_1");
    expect(resolveComponentSemanticsLabel({ type: "ref" }, ORIGIN, "id")).toBe(
      "PrimaryAction",
    );
  });

  it("원본도 없으면 자기 타입, 끝으로 id", () => {
    expect(resolveComponentSemanticsLabel({ type: "ref" }, null, "id")).toBe(
      "ref",
    );
    expect(resolveComponentSemanticsLabel(null, null, "instance-1")).toBe(
      "instance-1",
    );
  });
});

describe("runComponentSemanticsAction", () => {
  const detachInstance = vi.fn();
  const toggleComponentOrigin = vi.fn(async () => undefined);
  const selectElementWithPageTransition = vi.fn();

  beforeEach(() => {
    detachInstance.mockClear();
    toggleComponentOrigin.mockClear();
    selectElementWithPageTransition.mockClear();
    useStore.setState({
      elementsMap: new Map<string, never>([
        [ORIGIN.id, ORIGIN as never],
        [INSTANCE.id, INSTANCE as never],
      ]),
      detachInstance,
      toggleComponentOrigin,
      selectElementWithPageTransition,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("표면이 element 를 안 넘겨도 elementsMap 에서 읽어 같은 문구를 만든다", async () => {
    const confirmation = captureConfirmation(true);
    const ran = await runComponentSemanticsAction("detach-instance", {
      targetId: INSTANCE.id,
    });
    confirmation.unsubscribe();

    expect(ran).toBe(true);
    expect(detachInstance).toHaveBeenCalledWith(INSTANCE.id);
    expect(confirmation.get()).toMatchObject({
      kind: "detach-instance",
      instanceId: INSTANCE.id,
      // 원본을 되짚은 이름 — 종전 메뉴·단축키는 여기서 "ref" 로 멈췄다
      instanceLabel: "PrimaryAction",
      originId: ORIGIN.id,
      originLabel: "PrimaryAction",
    });
  });

  it("표면이 넘긴 element 가 우선한다 (패널은 canonical 을 읽는다)", async () => {
    const confirmation = captureConfirmation(true);
    await runComponentSemanticsAction("detach-instance", {
      targetId: INSTANCE.id,
      // `ref` 가 있어야 인스턴스로 인정된다 — 술어는 사영 불변 필드만 읽는다 (HC3)
      element: { ...INSTANCE, customId: "hero_cta" },
      originElement: ORIGIN,
      originId: ORIGIN.id,
    });
    confirmation.unsubscribe();
    expect(confirmation.get()).toMatchObject({ instanceLabel: "hero_cta" });
  });

  it("확인을 거절하면 store 를 건드리지 않는다", async () => {
    const confirmation = captureConfirmation(false);
    const ran = await runComponentSemanticsAction("detach-instance", {
      targetId: INSTANCE.id,
    });
    confirmation.unsubscribe();
    expect(ran).toBe(false);
    expect(detachInstance).not.toHaveBeenCalled();
  });

  it('confirm: "skip" 은 다이얼로그를 열지 않는다 (agent executor 가 이미 물었다)', async () => {
    const confirmation = captureConfirmation(true);
    const ran = await runComponentSemanticsAction("detach-instance", {
      targetId: INSTANCE.id,
      confirm: "skip",
    });
    confirmation.unsubscribe();
    expect(ran).toBe(true);
    expect(confirmation.get()).toBeNull();
    expect(detachInstance).toHaveBeenCalledWith(INSTANCE.id);
  });

  it("인스턴스가 아니면 아무것도 하지 않는다", async () => {
    const ran = await runComponentSemanticsAction("detach-instance", {
      targetId: ORIGIN.id,
    });
    expect(ran).toBe(false);
    expect(detachInstance).not.toHaveBeenCalled();
  });

  it("go-to-origin 은 해석된 원본의 실 id 로 선택한다 (alias 아님)", async () => {
    const ran = await runComponentSemanticsAction("go-to-origin", {
      targetId: INSTANCE.id,
      element: INSTANCE,
      originElement: ORIGIN,
      // 표면이 customId alias 를 originId 로 넘겨도 선택은 실 id 로
      originId: "PrimaryAction",
    });
    expect(ran).toBe(true);
    expect(selectElementWithPageTransition).toHaveBeenCalledWith(
      ORIGIN.id,
      "page-2",
    );
  });

  it("toggle 은 확인 없이 즉시 실행한다", async () => {
    const ran = await runComponentSemanticsAction("toggle-component-origin", {
      targetId: ORIGIN.id,
    });
    expect(ran).toBe(true);
    expect(toggleComponentOrigin).toHaveBeenCalledWith(ORIGIN.id);
  });

  it("select-instances 는 패널이 소유한다 — 러너는 실행하지 않는다", async () => {
    const ran = await runComponentSemanticsAction("select-instances", {
      targetId: ORIGIN.id,
    });
    expect(ran).toBe(false);
  });
});
