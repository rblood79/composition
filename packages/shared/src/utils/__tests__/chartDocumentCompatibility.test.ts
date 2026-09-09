import { describe, expect, it } from "vitest";
import { createChartInitialProps } from "@composition/specs";
import type {
  CompositionDocument,
  RefNode,
} from "../../types/composition-document.types";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
} from "../export.utils";

describe("ADR-209 Chart 문서·ref 호환", () => {
  for (const kind of ["area", "bar", "line", "pie", "radar", "radial"] as const)
    it(`${kind}: export/import는 원본·ref override·숨긴 옵션과 바인딩을 보존한다`, () => {
      const props = {
        ...createChartInitialProps(kind),
        gridType: "circle",
        innerRadius: 42,
        dataBinding: { source: "dataTable", name: "sales" },
      };
      const document: CompositionDocument = {
        version: "composition-1.0",
        children: [
          {
            id: "chart-origin",
            type: "Chart",
            name: "Revenue",
            reusable: true,
            props,
          },
          {
            id: "page-home",
            type: "frame",
            name: "Home",
            children: [
              {
                id: "chart-ref",
                type: "ref",
                ref: "chart-origin",
                props: {
                  isAnimationActive: false,
                  animationDuration: 875,
                  showGrid: false,
                },
              } as RefNode,
              {
                id: "legacy",
                type: "Chart",
                props: { data: [{ category: "A", value: 1 }] },
              },
            ],
          },
        ],
      };
      const before = JSON.stringify(document);
      const result = parseProjectData(
        serializeProjectData(
          "00000000-0000-0000-0000-000000000209",
          "Charts",
          document,
          "page-home",
        ),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.document).toEqual(document);
      const model = deriveProjectRenderModelFromDocument(
        result.data.document,
        result.data.project.id,
        "page-home",
      );
      const instance = model.elements.find(
        (element) => element.id === "chart-ref",
      )!;
      expect(instance.type).toBe("Chart");
      expect(instance.props).toMatchObject({
        ...props,
        isAnimationActive: false,
        animationDuration: 875,
        showGrid: false,
      });
      expect(
        model.elements.find((element) => element.id === "legacy")!.props,
      ).not.toHaveProperty("chartType");
      expect(JSON.stringify(document)).toBe(before);
    });
});

/**
 * ADR-209 후속 — 명시적 시리즈 해제(`color: ""`)의 저장/직렬화 계약.
 *
 * 해제를 `undefined`(삭제)로 표현하면 ref 가 origin 의 시리즈를 다시 상속한다. 그래서
 * 저장 형태는 빈 문자열이며, export/import 를 지나도 그 구분이 남아야 한다.
 */
describe("ADR-209 후속 — 시리즈 해제의 빈 값 보존", () => {
  const originProps = {
    ...createChartInitialProps("bar"),
    dimension: "category",
    metric: "value",
    color: "series",
    dataBinding: { source: "dataTable", name: "sales" },
  };
  const document: CompositionDocument = {
    version: "composition-1.0",
    children: [
      {
        id: "chart-origin",
        type: "Chart",
        reusable: true,
        props: originProps,
      },
      {
        id: "page-home",
        type: "frame",
        children: [
          // 명시적으로 해제한 인스턴스.
          {
            id: "chart-released",
            type: "ref",
            ref: "chart-origin",
            props: { color: "" },
          } as RefNode,
          // 해제하지 않은 인스턴스 — origin 의 시리즈를 그대로 상속한다.
          { id: "chart-kept", type: "ref", ref: "chart-origin" } as RefNode,
        ],
      },
    ],
  };

  it("빈 값 override 는 삭제와 구별되어 왕복한다", () => {
    const result = parseProjectData(
      serializeProjectData(
        "00000000-0000-0000-0000-000000000209",
        "Charts",
        document,
        "page-home",
      ),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.document).toEqual(document);
    const model = deriveProjectRenderModelFromDocument(
      result.data.document,
      result.data.project.id,
      "page-home",
    );
    const released = model.elements.find((e) => e.id === "chart-released")!;
    const kept = model.elements.find((e) => e.id === "chart-kept")!;
    expect(released.props.color).toBe("");
    expect(kept.props.color).toBe("series");
    // 해제는 시리즈 축만 비운다 — 나머지 매핑과 연결은 그대로다.
    expect(released.props).toMatchObject({
      dimension: "category",
      metric: "value",
      dataBinding: { source: "dataTable", name: "sales" },
    });
  });

  it("미편집 문서는 강제 재직렬화되지 않는다", () => {
    const before = JSON.stringify(document);
    parseProjectData(
      serializeProjectData(
        "00000000-0000-0000-0000-000000000209",
        "Charts",
        document,
        "page-home",
      ),
    );
    expect(JSON.stringify(document)).toBe(before);
  });
});
