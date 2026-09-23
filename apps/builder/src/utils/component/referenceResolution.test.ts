import { describe, expect, it } from "vitest";

import {
  buildReferenceIndex,
  resolveReference,
  type ReferenceResolvable,
} from "./referenceResolution";

/**
 * ADR-234 G4 — ref 해석의 legacy 참조 폴백은 호출 단위 색인 하나로 찾는다. 색인 조회 = `resolveReference`
 * (순회 순서의 첫 일치 — 필드가 달라도 앞 대상이 이긴다). 빈 참조는 색인하지 않는다 (ref 대상은 비어 있지 않다).
 */
describe("buildReferenceIndex", () => {
  const targets: ReferenceResolvable[] = [
    { id: "a", name: "Shared" },
    { id: "b", customId: "Shared", componentName: "Button" },
    { id: "c", metadata: { customId: "legacy-c", componentName: "Button" } },
    { id: "Shared" },
    { id: "d", name: "", customId: "", metadata: { customId: "" } },
  ];

  it.each(["a", "b", "c", "d", "Shared", "Button", "legacy-c", "missing"])(
    "%s → resolveReference 와 같은 대상",
    (reference) => {
      const index = buildReferenceIndex(targets);
      expect(index.get(reference)).toBe(resolveReference(reference, targets));
    },
  );
});
