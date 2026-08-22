import { describe, expect, it } from "vitest";
import { SkiaPresentationProjectionIndexBuilder } from "./skiaPresentationProjectionIndex";

describe("SkiaPresentationProjectionIndex", () => {
  it("canonical semantic target을 O(1) lookup으로 origin/ref projection k개에 fan-out한다", () => {
    const builder = new SkiaPresentationProjectionIndexBuilder();
    builder.addCanonicalProjection("origin-1", "origin-1");
    builder.addCanonicalProjection("origin-1", "projection:ref-a/origin-1");
    builder.addCanonicalProjection("origin-1", "projection:ref-b/origin-1");
    builder.addCanonicalProjection("origin-1", "projection:ref-b/origin-1");
    const index = builder.build();

    expect(
      index.resolve({ kind: "canonical-node", nodeId: "origin-1" }),
    ).toEqual([
      "origin-1",
      "projection:ref-a/origin-1",
      "projection:ref-b/origin-1",
    ]);
    expect(
      index.resolve({
        kind: "ref-descendant",
        pathKey: "child/0",
        refId: "ref-a",
      }),
    ).toEqual([]);

    builder.addRefDescendantProjection("ref-a", "child/0", "ref-a/child/0");
    expect(
      builder.build().resolve({
        kind: "ref-descendant",
        pathKey: "child/0",
        refId: "ref-a",
      }),
    ).toEqual(["ref-a/child/0"]);
  });

  it.each([1, 4, 16])(
    "projection fan-out k=%i는 등록된 render id만 반환한다",
    (count) => {
      const builder = new SkiaPresentationProjectionIndexBuilder();
      for (let index = 0; index < count; index += 1) {
        builder.addCanonicalProjection("origin-1", `render-${index}`);
      }

      expect(
        builder.build().resolve({ kind: "canonical-node", nodeId: "origin-1" }),
      ).toHaveLength(count);
    },
  );
});
