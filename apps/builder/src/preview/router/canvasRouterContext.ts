/**
 * CanvasRouter 내부 Context 인스턴스
 *
 * Fast Refresh 호환성을 위해 컴포넌트 파일에서 분리.
 * 외부에서 직접 사용하지 말고 훅(useCanvasNavigate, useCanvasParams)을 통해 접근.
 */

import React from "react";
import type { NavigateFunction } from "react-router";

export interface RouterContextValue {
  navigate: NavigateFunction | null;
}

export const RouterContext = React.createContext<RouterContextValue>({
  navigate: null,
});
