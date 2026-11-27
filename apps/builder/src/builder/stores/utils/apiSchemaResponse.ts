import type { ApiRunRecord } from "../../../types/builder/data.types";

/** 잘린 실행 스냅샷에 대응하는 스키마 입력. 스냅샷이 교체되면 함께 회수되며 진단 데이터에는 직렬화되지 않는다. */
export const apiSchemaResponse = new WeakMap<
  NonNullable<ApiRunRecord["response"]>,
  unknown
>();
