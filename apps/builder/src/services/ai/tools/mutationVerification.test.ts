/**
 * 도구가 **반영 여부를 확인하고** 성공을 보고하는지 검증한다.
 *
 * 배경: `updateElementProps` / `removeElement` 는 반환값이 없고 조기 `return` 경로가
 * 여럿이다 (projection id · 대상 없음 · 빈 patch · 변경 없음 · origin 영향 confirm 거부).
 * 도구가 이를 구분하지 않고 항상 `success: true` 를 돌려주면, 아무것도 바뀌지 않은
 * 요청이 "수정함" 으로 보고돼 모델이 잘못된 전제 위에서 다음 단계를 진행한다.
 * `bind_collection` 은 이미 `applied` 를 확인한다 — 같은 계약을 나머지에 맞춘다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../types/core/store.types";

const model = vi.hoisted(() => ({
  current: null as unknown as ReturnType<
    typeof import("./canonicalToolReadModel").getAiToolReadModel
  >,
}));
const canonicalStub = vi.hoisted(() => ({
  patch: {} as Record<string, unknown>,
  applied: false,
}));

vi.mock("./canonicalToolReadModel", () => ({
  getAiToolReadModel: () => model.current,
}));

vi.mock("./canonicalNodeFields", () => ({
  parseCanonicalFields: () => ({ patch: canonicalStub.patch, rejected: [] }),
  applyCanonicalFields: () => canonicalStub.applied,
}));

vi.mock("../../../builder/stores/aiVisualFeedback", () => ({
  useAIVisualFeedbackStore: { getState: () => ({ addFlashForNode: vi.fn() }) },
}));

import { updateElementTool } from "./updateElement";
import { deleteElementTool } from "./deleteElement";
import { forgetCreatedElements } from "./elementRef";

const ID = "el-1";

function harness(props: Record<string, unknown>, apply: boolean) {
  const element = { id: ID, type: "Button", props } as unknown as Element;
  const elementsById = new Map<string, Element>([[ID, element]]);

  const updateElementProps = vi.fn(
    async (id: string, patch: Record<string, unknown>) => {
      if (!apply) return; // 조용한 조기 return 재현
      const prev = elementsById.get(id)!;
      elementsById.set(id, { ...prev, props: { ...prev.props, ...patch } });
    },
  );
  const removeElement = vi.fn(async (id: string) => {
    if (!apply) return;
    elementsById.delete(id);
  });

  model.current = {
    elements: [element],
    elementsById,
    childrenByParent: new Map(),
    state: { selectedElementId: null, updateElementProps, removeElement },
  } as never;

  return { updateElementProps, removeElement, elementsById };
}

describe("도구는 반영을 확인한 뒤 성공을 보고한다", () => {
  beforeEach(() => {
    forgetCreatedElements();
    canonicalStub.patch = {};
    canonicalStub.applied = false;
  });

  it("update_element — 스토어가 조용히 무시하면 실패로 보고한다", async () => {
    harness({ children: "확인" }, false);

    const result = await updateElementTool.execute({
      elementId: ID,
      props: { children: "제출" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("children");
  });

  it("update_element — 반영되면 성공", async () => {
    harness({ children: "확인" }, true);

    const result = await updateElementTool.execute({
      elementId: ID,
      props: { children: "제출" },
    });

    expect(result.success).toBe(true);
  });

  it("update_element — 이미 요청한 값이면 성공 (변경 없음은 실패가 아니다)", async () => {
    harness({ children: "제출" }, false);

    const result = await updateElementTool.execute({
      elementId: ID,
      props: { children: "제출" },
    });

    expect(result.success).toBe(true);
  });

  it("update_element — canonical 필드를 요청했는데 반영 안 되면 실패", async () => {
    canonicalStub.patch = { clip: true };
    canonicalStub.applied = false;
    harness({ children: "확인" }, true);

    const result = await updateElementTool.execute({
      elementId: ID,
      props: { children: "제출" },
      canonical: { clip: true },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("clip");
  });

  it("delete_element — 요소가 남아 있으면 실패로 보고한다", async () => {
    harness({ children: "확인" }, false);

    const result = await deleteElementTool.execute({ elementId: ID });

    expect(result.success).toBe(false);
  });

  it("delete_element — 삭제되면 성공", async () => {
    harness({ children: "확인" }, true);

    const result = await deleteElementTool.execute({ elementId: ID });

    expect(result.success).toBe(true);
  });
});
