/**
 * Canvas Router Hooks
 *
 * Fast Refresh 호환성을 위해 CanvasRouter.tsx에서 분리.
 */

import React from "react";
import { useParams as useRouterParams } from "react-router";
import { RouterContext } from "./canvasRouterContext";

export function useCanvasNavigate() {
  const ctx = React.useContext(RouterContext);
  return ctx.navigate;
}

// Legacy alias
export const usePreviewNavigate = useCanvasNavigate;

/**
 * 동적 라우트 파라미터에 접근하는 훅
 *
 * @example
 * // Route: /products/:categoryId/items/:itemId
 * // URL: /products/shoes/items/123
 * function ProductDetail() {
 *   const params = useCanvasParams();
 *   // params = { categoryId: 'shoes', itemId: '123' }
 * }
 */
export function useCanvasParams(): Record<string, string | undefined> {
  return useRouterParams();
}

// Legacy alias
export const usePreviewParams = useCanvasParams;
