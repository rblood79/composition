/**
 * search_elements Tool
 *
 * type, prop name/value, style 속성으로 요소 검색
 */

import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { getAiToolReadModel } from "./canonicalToolReadModel";

export const searchElementsTool: ToolExecutor = {
  name: "search_elements",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const tagFilter = args.type as string | undefined;
    const propName = args.propName as string | undefined;
    const propValue = args.propValue as string | undefined;
    const styleProp = args.styleProp as string | undefined;
    const limit = typeof args.limit === "number" ? args.limit : 20;

    try {
      const {
        elements,
        state: { currentPageId },
      } = getAiToolReadModel();

      // 현재 페이지 요소만 대상
      let results = elements.filter((el) => el.page_id === currentPageId);

      // type 필터
      if (tagFilter) {
        const tagLower = tagFilter.toLowerCase();
        results = results.filter((el) => el.type.toLowerCase() === tagLower);
      }

      // prop name 필터
      if (propName) {
        results = results.filter((el) => {
          const props = el.props as Record<string, unknown> | undefined;
          if (!props) return false;
          if (!(propName in props)) return false;

          // propValue도 지정된 경우 값 비교
          if (propValue !== undefined) {
            return String(props[propName]) === propValue;
          }
          return true;
        });
      }

      // style 속성 필터
      if (styleProp) {
        results = results.filter((el) => {
          const style = (el.props as Record<string, unknown>)?.style as
            | Record<string, unknown>
            | undefined;
          return style != null && styleProp in style;
        });
      }

      // limit 적용
      const limited = results.slice(0, limit);

      return {
        success: true,
        data: {
          total: results.length,
          returned: limited.length,
          elements: limited.map((el) => ({
            id: el.id,
            type: el.type,
            parentId: el.parent_id,
            propKeys: Object.keys(
              (el.props as Record<string, unknown>) || {},
            ).filter((k) => k !== "style"),
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
