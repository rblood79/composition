import { afterEach, describe, expect, it, vi } from "vitest";

import {
  publishStoreCommitDescriptors,
  setStoreCommitDescriptorSink,
} from "./storeCommitDescriptorSink";
import type { EditorMutationDescriptor } from "./editorPresentationTypes";

const descriptor: EditorMutationDescriptor = {
  patch: { left: "64px" },
  target: { kind: "canonical-node", nodeId: "el-1" },
  type: "style.patch",
};

describe("storeCommitDescriptorSink", () => {
  afterEach(() => {
    setStoreCommitDescriptorSink(null);
  });

  it("등록된 sink 로 descriptor 와 revision 을 전달한다", () => {
    const sink = vi.fn();
    setStoreCommitDescriptorSink(sink);

    publishStoreCommitDescriptors([descriptor], 42);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith([descriptor], 42);
  });

  it("sink 가 없으면 조용히 no-op 한다 — Skia canvas 미마운트 상태의 편집", () => {
    expect(() =>
      publishStoreCommitDescriptors([descriptor], 42),
    ).not.toThrow();
  });

  it("sink 가 throw 해도 호출자 mutation 을 중단시키지 않는다", () => {
    setStoreCommitDescriptorSink(() => {
      throw new Error("bridge is gone");
    });

    expect(() =>
      publishStoreCommitDescriptors([descriptor], 42),
    ).not.toThrow();
  });

  it("빈 배열은 sink 를 호출하지 않는다 — 한 편집의 모든 mutation 이 거부된 경우", () => {
    const sink = vi.fn();
    setStoreCommitDescriptorSink(sink);

    publishStoreCommitDescriptors([], 42);

    expect(sink).not.toHaveBeenCalled();
  });

  it("여러 descriptor 를 한 번에 전달한다 — pendingCommit 단일 슬롯 덮어쓰기 방지 (R6)", () => {
    const sink = vi.fn();
    setStoreCommitDescriptorSink(sink);
    const second: EditorMutationDescriptor = {
      operation: { payload: { parentId: "p-1" }, type: "add" },
      target: { kind: "canonical-node", nodeId: "el-2" },
      type: "structure.patch",
    };

    publishStoreCommitDescriptors([descriptor, second], 7);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith([descriptor, second], 7);
  });

  it("해제 후에는 더 이상 전달하지 않는다", () => {
    const sink = vi.fn();
    setStoreCommitDescriptorSink(sink);
    setStoreCommitDescriptorSink(null);

    publishStoreCommitDescriptors([descriptor], 42);

    expect(sink).not.toHaveBeenCalled();
  });
});
