/**
 * Skia selection chrome와 DOM overlay가 함께 소비하는 화면 px geometry.
 * zoom과 무관한 fixed-screen 값이며, page 하단 overlay 간 충돌 계산의 SSOT다.
 */
export const SELECTION_DIMENSION_LABEL_OFFSET_Y = 8;
export const SELECTION_DIMENSION_LABEL_LINE_HEIGHT = 16;
export const SELECTION_DIMENSION_LABEL_PADDING_Y = 3;

/** 선택 bounds 하단부터 dimension label 배경 하단까지의 화면 px 점유 영역 */
export const SELECTION_DIMENSION_LABEL_BOTTOM_EXTENT =
  SELECTION_DIMENSION_LABEL_OFFSET_Y +
  SELECTION_DIMENSION_LABEL_LINE_HEIGHT +
  SELECTION_DIMENSION_LABEL_PADDING_Y * 2;
