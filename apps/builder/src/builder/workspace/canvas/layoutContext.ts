/**
 * Layout Computed Size Context
 *
 * LayoutContainer가 레이아웃 엔진 레이아웃 엔진 계산 후 실제 pixel 크기를
 * 하위 컴포넌트에 전달합니다.
 * ElementSprite가 이 값을 사용하여 퍼센트 기반 width/height를 해석합니다.
 *
 * 순환 참조 방지를 위해 BuilderCanvas와 ElementSprite 모두에서 import 가능한
 * 별도 파일로 분리되었습니다.
 */

import { createContext } from 'react';

export const LayoutComputedSizeContext = createContext<{ width: number; height: number } | null>(null);
