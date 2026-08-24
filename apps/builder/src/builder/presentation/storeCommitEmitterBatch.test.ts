import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  setStoreCommitDescriptorSink,
  type StoreCommitDescriptorSink,
} from "./storeCommitDescriptorSink";
import {
  emitStoreStructureCommitDescriptors,
  emitStoreStyleCommitDescriptors,
} from "./storeCommitEmitter";

/**
 * ADR-190 Phase 3 — 한 편집이 만든 여러 mutation 의 배치 전달 계약.
 *
 * commit lane 의 `pendingCommit` 은 단일 슬롯이라, mutation 마다 따로 queue 하면
 * 앞선 patch 가 조용히 유실된다 (R6). 그래서 배치 emitter 는 **정확히 한 번**
 * sink 를 호출해야 하고, 하나라도 서술 불가능하면 **전체**를 버려야 한다
 * (부분 emit 시 한 프레임에 patch/full 두 경로가 섞여 revision 원자성 훼손).
 */
describe("store commit emitter — batch", () => {
  let sink: ReturnType<typeof vi.fn<StoreCommitDescriptorSink>>;

  beforeEach(() => {
    sink = vi.fn<StoreCommitDescriptorSink>();
    setStoreCommitDescriptorSink(sink);
  });

  afterEach(() => {
    setStoreCommitDescriptorSink(null);
  });

  it("단일 항목 batch 는 style.patch 로 전달한다", () => {
    emitStoreStyleCommitDescriptors([
      { elementId: "el-1", patch: { style: { left: "10px" } } },
    ]);

    expect(sink).toHaveBeenCalledTimes(1);
    const [descriptors] = sink.mock.calls[0];
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toMatchObject({
      patch: { left: "10px" },
      target: { kind: "canonical-node", nodeId: "el-1" },
      type: "style.patch",
    });
  });

  it("다중 항목은 보내지 않는다 — style dirty root 가 요소마다 생겨 patcher 가 어차피 full rebuild 로 수렴한다", () => {
    emitStoreStyleCommitDescriptors([
      { elementId: "el-1", patch: { style: { left: "10px" } } },
      { elementId: "el-2", patch: { style: { top: "20px" } } },
    ]);

    expect(sink).not.toHaveBeenCalled();
  });

  it("단일 항목이라도 서술 불가능하면 버린다", () => {
    emitStoreStyleCommitDescriptors([
      { elementId: "el-1", patch: { style: { someUnknownKey: "1px" } } },
    ]);
    emitStoreStyleCommitDescriptors([
      { elementId: "el-1", patch: { items: [{ id: "i1" }] } },
    ]);

    expect(sink).not.toHaveBeenCalled();
  });

  it("빈 목록은 sink 를 호출하지 않는다", () => {
    emitStoreStyleCommitDescriptors([]);
    emitStoreStructureCommitDescriptors([]);

    expect(sink).not.toHaveBeenCalled();
  });

  it("structure 배치도 한 번의 호출로 전달한다", () => {
    emitStoreStructureCommitDescriptors([
      { elementId: "el-1", parentId: "p-1" },
      { elementId: "el-2", parentId: "p-1" },
    ]);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toHaveLength(2);
  });

  it("structure 배치도 부모 미상 항목 하나로 전체를 버린다", () => {
    emitStoreStructureCommitDescriptors([
      { elementId: "el-1", parentId: "p-1" },
      { elementId: "el-2", parentId: null },
    ]);

    expect(sink).not.toHaveBeenCalled();
  });
});
