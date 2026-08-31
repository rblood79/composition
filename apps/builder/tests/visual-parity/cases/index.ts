/**
 * ADR-198 파일럿 케이스 목록 (test-only).
 *
 * 순서에 의미가 있다 — 뒤 케이스의 실패는 앞 케이스가 통과했을 때만 해석 가능하다.
 * 1) 뼈대와 단색, 2) catalog 바인딩과 상태, 3) 비동기 리소스.
 */

import type { VisualParityCase } from "../harness/types";
import { basicGeometryPaint } from "./basicGeometryPaint";
import { catalogStatePaint } from "./catalogStatePaint";
import { textRasterResources } from "./textRasterResources";

export { basicGeometryPaint, catalogStatePaint, textRasterResources };

export const PILOT_CASES: readonly VisualParityCase[] = [
  basicGeometryPaint,
  catalogStatePaint,
  textRasterResources,
];
