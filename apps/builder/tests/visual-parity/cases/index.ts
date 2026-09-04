/**
 * ADR-198 파일럿 케이스 목록 (test-only).
 *
 * 순서에 의미가 있다 — 뒤 케이스의 실패는 앞 케이스가 통과했을 때만 해석 가능하다.
 * 1) 뼈대와 단색, 2) catalog 바인딩과 상태, 3) 자간 축, 4) 비동기 리소스.
 */

import type { VisualParityCase } from "../harness/types";
import { basicGeometryPaint } from "./basicGeometryPaint";
import { catalogStatePaint } from "./catalogStatePaint";
import { textLetterSpacing } from "./textLetterSpacing";
import { textRasterResources } from "./textRasterResources";

export {
  basicGeometryPaint,
  catalogStatePaint,
  textLetterSpacing,
  textRasterResources,
};

export const PILOT_CASES: readonly VisualParityCase[] = [
  basicGeometryPaint,
  catalogStatePaint,
  // ADR-205 G3 — ls≠0 을 실제로 실행하는 유일한 케이스 (다른 3종에는 ls 가 없다).
  // 비동기 리소스 케이스보다 **앞**에 둔다: 텍스트+단색만 쓰므로 폰트·디코드 축이
  // 섞이지 않고, 뒤에 두면 앞 케이스가 남긴 Preview 콘솔 에러(<paragraph> 미인식)를
  // 이 케이스의 identity 판정이 물려받는다.
  textLetterSpacing,
  textRasterResources,
];
