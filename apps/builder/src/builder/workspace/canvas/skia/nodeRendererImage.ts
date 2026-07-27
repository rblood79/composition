import type { CanvasKit, Canvas, FontMgr } from "canvaskit-wasm";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import { createRoundRectPath } from "./nodeRendererClip";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { DEFAULT_FONT_FEATURES } from "../layout/engines/cssResolver";

export function renderImage(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  fontMgr?: FontMgr | null,
): void {
  const scope = new SkiaDisposable();
  try {
    const br = node.box?.borderRadius ?? 0;
    const isArrayRadius = Array.isArray(br);
    const hasRadius = isArrayRadius
      ? (br as number[]).some((r) => r > 0)
      : (br as number) > 0;

    if (hasRadius) {
      canvas.save();
      if (isArrayRadius) {
        const clipPath = createRoundRectPath(
          ck,
          0,
          0,
          node.width,
          node.height,
          br as [number, number, number, number],
        );
        canvas.clipPath(clipPath, ck.ClipOp.Intersect, true);
        clipPath.delete();
      } else {
        const r = Math.min(br as number, Math.min(node.width, node.height) / 2);
        const rrect = ck.RRectXY(
          ck.LTRBRect(0, 0, node.width, node.height),
          r,
          r,
        );
        canvas.clipRRect(rrect, ck.ClipOp.Intersect, true);
      }
    }

    if (!node.image?.skImage) {
      if (node.box) {
        const placeholderPaint = acquireScopedPaint(scope, ck);
        placeholderPaint.setAntiAlias(true);
        placeholderPaint.setStyle(ck.PaintStyle.Fill);
        placeholderPaint.setColor(node.box.fillColor);
        canvas.drawRect(
          ck.LTRBRect(0, 0, node.width, node.height),
          placeholderPaint,
        );

        // 산/해 placeholder 아이콘
        const iconSize = Math.min(node.width, node.height) * 0.3;
        const iconX = (node.width - iconSize) / 2;
        const iconY = (node.height - iconSize) / 2;
        const iconPaint = acquireScopedPaint(scope, ck);
        iconPaint.setAntiAlias(true);
        iconPaint.setStyle(ck.PaintStyle.Fill);
        iconPaint.setColor(ck.Color(156, 163, 175, 1)); // gray-400

        // 산 모양
        const mountainPath = scope.track(new ck.Path());
        mountainPath.moveTo(iconX, iconY + iconSize);
        mountainPath.lineTo(iconX + iconSize * 0.3, iconY + iconSize * 0.5);
        mountainPath.lineTo(iconX + iconSize * 0.5, iconY + iconSize * 0.7);
        mountainPath.lineTo(iconX + iconSize * 0.7, iconY + iconSize * 0.3);
        mountainPath.lineTo(iconX + iconSize, iconY + iconSize);
        mountainPath.close();
        canvas.drawPath(mountainPath, iconPaint);
      }
      const altText = node.image?.altText;
      if (altText && fontMgr) {
        const altFontSize = Math.max(11, Math.min(14, node.width * 0.06));
        // CanvasKit ParagraphStyle 생성자는 default textStyle 을 요구한다 — 누락 시
        //   textStyle.color 접근에서 크래시("Cannot read properties of undefined").
        //   nodeRendererText.ts:366 과 동일하게 textStyle 을 명시(아래 pushStyle 과 동일 값).
        const paraStyle = new ck.ParagraphStyle({
          textAlign: ck.TextAlign.Center,
          maxLines: 2,
          ellipsis: "…",
          textStyle: {
            color: ck.Color(156, 163, 175, 1),
            fontSize: altFontSize,
            fontFamilies: ["Pretendard", "sans-serif"],
          },
        });
        const builder = ck.ParagraphBuilder.Make(paraStyle, fontMgr);
        builder.pushStyle(
          new ck.TextStyle({
            color: ck.Color(156, 163, 175, 1),
            fontSize: altFontSize,
            fontFamilies: ["Pretendard", "sans-serif"],
            fontFeatures: DEFAULT_FONT_FEATURES,
          }),
        );
        builder.addText(altText);
        const para = builder.build();
        const maxW = node.width * 0.8;
        para.layout(maxW);
        const paraH = para.getHeight();
        const paraX = (node.width - maxW) / 2;
        const paraY = Math.max(node.height * 0.65, node.height - paraH - 8);
        canvas.drawParagraph(para, paraX, paraY);
        para.delete();
        builder.delete();
      }
      if (hasRadius) canvas.restore();
      return;
    }

    const needsOverflowClip =
      !hasRadius &&
      (node.image.contentWidth > node.width ||
        node.image.contentHeight > node.height ||
        node.image.contentX < 0 ||
        node.image.contentY < 0);
    if (needsOverflowClip) {
      canvas.save();
      canvas.clipRect(
        ck.LTRBRect(0, 0, node.width, node.height),
        ck.ClipOp.Intersect,
        true,
      );
    }

    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);

    const srcRect = ck.LTRBRect(
      0,
      0,
      node.image.skImage.width(),
      node.image.skImage.height(),
    );
    const dstRect = ck.LTRBRect(
      node.image.contentX,
      node.image.contentY,
      node.image.contentX + node.image.contentWidth,
      node.image.contentY + node.image.contentHeight,
    );

    canvas.drawImageRect(node.image.skImage, srcRect, dstRect, paint);

    if (needsOverflowClip) canvas.restore();
    if (hasRadius) canvas.restore();
  } finally {
    scope.dispose();
  }
}
