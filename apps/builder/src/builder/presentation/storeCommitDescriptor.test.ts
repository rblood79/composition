import { describe, expect, it } from "vitest";

import { createStoreStyleCommitDescriptor } from "./storeCommitDescriptor";

/**
 * ADR-190 Phase 1 — generic store commit 의 descriptor 변환 계약.
 *
 * 핵심은 "얼마나 많이 emit 하는가" 가 아니라 **해석 불가 입력을 확실히
 * 거부하는가** 다 (R1 fidelity). emit 실패의 결과는 현행 full rebuild 이므로
 * 안전 하한이 유지되지만, 잘못 emit 하면 dirty root 가 과소 산출되어 stale
 * 화면이 남는다.
 */
describe("createStoreStyleCommitDescriptor", () => {
  const nodeId = "el-1";

  it("registry 에 등재된 style 키만 담긴 patch 를 style.patch descriptor 로 변환한다", () => {
    const descriptor = createStoreStyleCommitDescriptor({
      elementId: nodeId,
      patch: { style: { left: "64px", width: "120px" } },
    });

    expect(descriptor).toEqual({
      patch: { left: "64px", width: "120px" },
      target: { kind: "canonical-node", nodeId },
      type: "style.patch",
    });
  });

  it("style 외 최상위 prop 키가 섞이면 거부한다 — prop 축은 style.patch 로 서술할 수 없다", () => {
    expect(
      createStoreStyleCommitDescriptor({
        elementId: nodeId,
        patch: { label: "Next", style: { left: "64px" } },
      }),
    ).toBeNull();
  });

  it("items 같은 prop 축 단독 patch 를 거부한다 — elements.ts 내부 재진입(addItem/removeItem) 경로", () => {
    expect(
      createStoreStyleCommitDescriptor({
        elementId: nodeId,
        patch: { items: [{ id: "i1" }] },
      }),
    ).toBeNull();
  });

  it("registry 에 규칙이 없는 style 키가 하나라도 있으면 patch 전체를 거부한다", () => {
    expect(
      createStoreStyleCommitDescriptor({
        elementId: nodeId,
        patch: { style: { left: "64px", someUnknownFutureKey: "1px" } },
      }),
    ).toBeNull();
  });

  it("빈 patch / 빈 style 을 거부한다", () => {
    expect(
      createStoreStyleCommitDescriptor({ elementId: nodeId, patch: {} }),
    ).toBeNull();
    expect(
      createStoreStyleCommitDescriptor({
        elementId: nodeId,
        patch: { style: {} },
      }),
    ).toBeNull();
  });

  it("projected render id 를 거부한다 — canonical 문서에 없는 합성 id (ADR-135)", () => {
    expect(
      createStoreStyleCommitDescriptor({
        elementId: "page-1::page-frame::slot-header",
        patch: { style: { left: "64px" } },
      }),
    ).toBeNull();
  });

  it("inherited-subtree 로 전파되는 style 키는 그 propagation 을 descriptor 에 싣는다", () => {
    const descriptor = createStoreStyleCommitDescriptor({
      elementId: nodeId,
      patch: { style: { fontSize: "18px" } },
    });

    expect(descriptor).toEqual({
      patch: { fontSize: "18px" },
      propagation: "inherited-subtree",
      target: { kind: "canonical-node", nodeId },
      type: "style.patch",
    });
  });

  it("self 전파 키와 inherited 키가 섞이면 inherited 로 승격한다 — 좁은 쪽으로 축소 금지", () => {
    const descriptor = createStoreStyleCommitDescriptor({
      elementId: nodeId,
      patch: { style: { fontSize: "18px", width: "120px" } },
    });

    expect(descriptor?.type).toBe("style.patch");
    expect(
      descriptor && "propagation" in descriptor
        ? descriptor.propagation
        : undefined,
    ).toBe("inherited-subtree");
  });

  it("self 전파 키만 있으면 propagation 을 싣지 않는다", () => {
    const descriptor = createStoreStyleCommitDescriptor({
      elementId: nodeId,
      patch: { style: { width: "120px" } },
    });

    expect(descriptor).not.toBeNull();
    expect(descriptor && "propagation" in descriptor).toBe(false);
  });
});
