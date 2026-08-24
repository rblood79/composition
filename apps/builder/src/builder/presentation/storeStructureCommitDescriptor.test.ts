import { describe, expect, it } from "vitest";

import { createStoreStructureCommitDescriptor } from "./storeStructureCommitDescriptor";

/**
 * ADR-190 Phase 2 — structure mutation 의 descriptor 변환 계약.
 *
 * style 축과 달리 dirty root 가 **부모**다 (자식 추가/제거/순서는 부모의
 * subtree span 길이를 바꾼다). 그래서 부모를 특정하지 못하면 emit 자체가
 * 성립하지 않는다 — 특히 `remove` 는 post-commit 트리에서 대상 노드가 이미
 * 사라져 payload 의 parentId 가 유일한 단서다.
 */
describe("createStoreStructureCommitDescriptor", () => {
  it("add 를 structure.patch descriptor 로 변환하고 parentId 를 payload 에 싣는다", () => {
    expect(
      createStoreStructureCommitDescriptor({
        elementId: "el-1",
        operation: "add",
        parentId: "parent-1",
      }),
    ).toEqual({
      operation: { payload: { parentId: "parent-1" }, type: "add" },
      target: { kind: "canonical-node", nodeId: "el-1" },
      type: "structure.patch",
    });
  });

  it("remove 도 같은 형태로 변환한다 — 부모 참조가 유일 단서", () => {
    expect(
      createStoreStructureCommitDescriptor({
        elementId: "el-1",
        operation: "remove",
        parentId: "parent-1",
      }),
    ).toEqual({
      operation: { payload: { parentId: "parent-1" }, type: "remove" },
      target: { kind: "canonical-node", nodeId: "el-1" },
      type: "structure.patch",
    });
  });

  it("order 를 변환한다 — 형제 재배치는 부모 span 만 바뀐다", () => {
    const descriptor = createStoreStructureCommitDescriptor({
      elementId: "el-1",
      operation: "order",
      parentId: "parent-1",
    });

    expect(descriptor?.type).toBe("structure.patch");
    expect(
      descriptor && "operation" in descriptor
        ? descriptor.operation.type
        : null,
    ).toBe("order");
  });

  it("parentId 가 없으면 거부한다 — dirty root 를 특정할 수 없다", () => {
    for (const parentId of [null, undefined, ""]) {
      expect(
        createStoreStructureCommitDescriptor({
          elementId: "el-1",
          operation: "remove",
          parentId,
        }),
      ).toBeNull();
    }
  });

  it("projected render id 는 대상이든 부모든 거부한다", () => {
    expect(
      createStoreStructureCommitDescriptor({
        elementId: "page-1::page-frame::slot-header",
        operation: "add",
        parentId: "parent-1",
      }),
    ).toBeNull();
    expect(
      createStoreStructureCommitDescriptor({
        elementId: "el-1",
        operation: "add",
        parentId: "page-1::page-frame::slot-header",
      }),
    ).toBeNull();
  });
});
