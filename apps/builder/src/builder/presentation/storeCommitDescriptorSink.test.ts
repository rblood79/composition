import { afterEach, describe, expect, it, vi } from "vitest";

import {
  publishStoreCommitDescriptor,
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

    publishStoreCommitDescriptor(descriptor, 42);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(descriptor, 42);
  });

  it("sink 가 없으면 조용히 no-op 한다 — Skia canvas 미마운트 상태의 편집", () => {
    expect(() => publishStoreCommitDescriptor(descriptor, 42)).not.toThrow();
  });

  it("sink 가 throw 해도 호출자 mutation 을 중단시키지 않는다", () => {
    setStoreCommitDescriptorSink(() => {
      throw new Error("bridge is gone");
    });

    expect(() => publishStoreCommitDescriptor(descriptor, 42)).not.toThrow();
  });

  it("해제 후에는 더 이상 전달하지 않는다", () => {
    const sink = vi.fn();
    setStoreCommitDescriptorSink(sink);
    setStoreCommitDescriptorSink(null);

    publishStoreCommitDescriptor(descriptor, 42);

    expect(sink).not.toHaveBeenCalled();
  });
});
