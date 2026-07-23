/**
 * CanvasKit 이펙트 파이프라인
 *
 * saveLayer 기반으로 Opacity, Background Blur, Drop Shadow, Color Matrix를 적용한다.
 * Pencil §10.9.5 패턴을 따른다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.6 이펙트 파이프라인
 */

import type { CanvasKit, Canvas, ImageFilter } from "canvaskit-wasm";
import type { EffectStyle } from "./types";
import { SkiaDisposable } from "./disposable";

/**
 * 이 이펙트가 beginRenderEffects 에서 saveLayer 를 여는가(=endRenderEffects 가 restore 해야 하는가).
 *
 * inset(inner) drop-shadow 는 콘텐츠 실루엣 기반 MakeDropShadow 로 그릴 수 없어 saveLayer 를 열지
 * 않는다 — box RRect 지오메트리를 아는 renderBox(nodeRendererBorders.renderInnerBoxShadows)가
 * 직접 그린다. opener(beginRenderEffects)와 counter(countEffectLayers)가 이 단일 predicate 를
 * 공유해야 restore 횟수가 어긋나지 않는다(어긋나면 over-restore → canvas save 스택 붕괴 →
 * 이후 요소 transform/clip 오염).
 */
export function effectOpensLayer(effect: EffectStyle): boolean {
  if (effect.type === "drop-shadow" && effect.inner) return false;
  return true;
}

/**
 * beginRenderEffects 가 실제로 열 saveLayer 수. command-stream 경로(renderCommands.ts)는
 * BEGIN/END 가 분리돼 beginRenderEffects 의 반환값을 END 시점에 쓸 수 없으므로, 빌드 시점에
 * 이 함수로 동일 규칙의 count 를 계산해 CMD_ELEMENT_END.effectLayerCount 에 싣는다.
 */
export function countEffectLayers(effects: EffectStyle[]): number {
  let n = 0;
  for (const effect of effects) if (effectOpensLayer(effect)) n++;
  return n;
}

/**
 * 이펙트를 시작한다 (saveLayer 스택에 레이어 추가).
 *
 * 각 이펙트는 `canvas.saveLayer()`를 호출하여 오프스크린 레이어를 생성하고,
 * Paint의 알파/필터를 통해 하위 콘텐츠에 효과를 적용한다.
 *
 * @returns 스택에 추가된 레이어 수 — endRenderEffects()에서 동일 횟수만큼 restore() 해야 한다.
 */
export function beginRenderEffects(
  ck: CanvasKit,
  canvas: Canvas,
  effects: EffectStyle[],
): number {
  let layerCount = 0;
  const scope = new SkiaDisposable();

  if (import.meta.env.DEV && effects.length > 0) {
    console.log(
      "[Skia Effects] beginRenderEffects:",
      effects.map((e) => e.type),
    );
  }

  try {
    for (const effect of effects) {
      // inset(inner) drop-shadow 는 saveLayer 를 열지 않는다(renderBox 가 지오메트리로 그림).
      //   countEffectLayers 와 동일 predicate 공유 → restore 횟수 정합(over-restore 방지).
      if (!effectOpensLayer(effect)) continue;
      switch (effect.type) {
        case "opacity": {
          const paint = scope.track(new ck.Paint());
          paint.setAlphaf(effect.value);
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }

        case "background-blur": {
          const filter = scope.track(
            ck.ImageFilter.MakeBlur(
              effect.sigma,
              effect.sigma,
              ck.TileMode.Clamp,
              null,
            ),
          );
          const paint = scope.track(new ck.Paint());
          paint.setImageFilter(filter);
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }

        case "backdrop-filter": {
          const paint = scope.track(new ck.Paint());
          if (effect.sigma > 0) {
            const filter = scope.track(
              ck.ImageFilter.MakeBlur(
                effect.sigma,
                effect.sigma,
                ck.TileMode.Clamp,
                null,
              ),
            );
            paint.setImageFilter(filter);
          }
          if (effect.colorMatrix) {
            const colorFilter = scope.track(
              ck.ColorFilter.MakeMatrix(effect.colorMatrix),
            );
            paint.setColorFilter(colorFilter);
          }
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }

        case "layer-blur": {
          const filter = scope.track(
            ck.ImageFilter.MakeBlur(
              effect.sigma,
              effect.sigma,
              ck.TileMode.Clamp,
              null,
            ),
          );
          const paint = scope.track(new ck.Paint());
          paint.setImageFilter(filter);
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }

        case "drop-shadow": {
          // outer drop-shadow 만 도달한다(inner 는 loop 상단 effectOpensLayer 에서 skip →
          //   renderBox 가 지오메트리로 그림). MakeDropShadow 는 saveLayer 에 캡처된 콘텐츠
          //   실루엣에서 casting 하므로 inner edge 를 표현 못 한다(I-CR1: MakeDropShadowOnly 는
          //   소스를 제거해 콘텐츠가 사라짐).

          // M-2: spread → dilate/erode filter 체인으로 근사
          let inputFilter: ImageFilter | null = null;
          if (effect.spread && effect.spread !== 0) {
            inputFilter =
              effect.spread > 0
                ? scope.track(
                    ck.ImageFilter.MakeDilate(
                      effect.spread,
                      effect.spread,
                      null,
                    ),
                  )
                : scope.track(
                    ck.ImageFilter.MakeErode(
                      -effect.spread,
                      -effect.spread,
                      null,
                    ),
                  );
          }

          if (import.meta.env.DEV) {
            console.log("[Skia Effects] MakeDropShadow params:", {
              dx: effect.dx,
              dy: effect.dy,
              sigmaX: effect.sigmaX,
              sigmaY: effect.sigmaY,
              color: Array.from(effect.color),
              inner: effect.inner,
              spread: effect.spread,
            });
          }

          const filter = scope.track(
            ck.ImageFilter.MakeDropShadow(
              effect.dx,
              effect.dy,
              effect.sigmaX,
              effect.sigmaY,
              effect.color,
              inputFilter,
            ),
          );
          const paint = scope.track(new ck.Paint());
          paint.setImageFilter(filter);
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }

        case "color-matrix": {
          // CSS filter(brightness, contrast, saturate, hue-rotate)에서
          // 합성된 4x5 색상 행렬을 CanvasKit ColorFilter로 적용한다.
          const colorFilter = scope.track(
            ck.ColorFilter.MakeMatrix(effect.matrix),
          );
          const paint = scope.track(new ck.Paint());
          paint.setColorFilter(colorFilter);
          canvas.saveLayer(paint);
          layerCount++;
          break;
        }
      }
    }
  } finally {
    // Paint/Filter 네이티브 객체를 즉시 해제.
    // saveLayer()가 내부적으로 참조를 복사하므로 JS 측 객체는 바로 삭제 가능.
    scope.dispose();
  }

  return layerCount;
}

/**
 * beginRenderEffects()에서 추가한 레이어를 모두 복원한다.
 *
 * 각 restore()는 오프스크린 레이어를 부모 캔버스에 합성하면서
 * 해당 레이어의 이펙트(알파, 필터)를 적용한다.
 */
export function endRenderEffects(canvas: Canvas, layerCount: number): void {
  for (let i = 0; i < layerCount; i++) {
    canvas.restore();
  }
}
