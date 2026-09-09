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
