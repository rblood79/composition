import { describe, expect, it } from "vitest";

import { FieldSpec } from "../components/Field.spec";

/**
 * ADR-912 6 registry collapse — T1 Field catalog cutover, RED #2.
 *
 * Field 는 데이터 매핑 internal 컴포넌트 — render.shapes 가 `() => []`(Skia 0 shape).
 * catalog cutover 후에도 이 invariant 가 유지되어야 한다(escape 불필요, generic 0 shape).
 * Skia 는 catalog 게이트 통과 + 빈 shapes 를 정상 처리(빈 노드). DOM 은
 * rendererMap.Field=renderDataField 위임 유지.
 *
 * spec 물리 삭제(별도 gate) 전까지 spec 자체가 shapes [] 를 emit 함을 고정.
 */
describe("FieldSpec render.shapes — ADR-912 T1 cutover (Skia 0 shape)", () => {
  it("render.shapes 는 빈 배열 (escape 불필요, generic 0 shape)", () => {
    const size = FieldSpec.sizes![FieldSpec.defaultSize!]!;
    const shapes = FieldSpec.render!.shapes!(
      { key: "id", label: "ID", visible: true, type: "string" },
      size,
      "default",
    );
    expect(shapes).toEqual([]);
  });

  it("skipCSSGeneration=true (시각 shapes 없음 — generated CSS 불필요)", () => {
    expect(FieldSpec.skipCSSGeneration).toBe(true);
  });
});
