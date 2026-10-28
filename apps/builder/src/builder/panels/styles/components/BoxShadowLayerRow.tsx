/**
 * BoxShadowLayerRow — Effect 절 Box Shadows 목록 행 (레이어 하나)
 *
 *   [swatch · 「0 · 4 · 12 · 0」 (팝오버 trigger → BoxShadowEditor) · 제거 −]  |  [inset 토글]
 *
 * Fill 레이어 행과 같은 구조 (2026-10-28 사용자 결정 — 인스펙터 격자 3 · 3 | 1, 제거는 본문 안,
 * 액션 칸은 inset 토글 하나, inset/outer 글자 꼬리표 없음 — 토글 아이콘이 상태를 보인다).
 * inset 전환 · 제거는 topology 변경 — presentation owner 가 거부하므로 절이 canonical commit 으로 보낸다.
 */

import { memo } from "react";
import { DialogTrigger } from "react-aria-components/Dialog";
import { Button as AriaButton } from "react-aria-components/Button";
import { ToggleButton as AriaToggleButton } from "react-aria-components/ToggleButton";
import { Minus, Square } from "lucide-react";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import { SquareOff } from "../../../components/icons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type {
  BoxShadowPresentationLayer,
  BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
import { BoxShadowEditor, type BoxShadowEditorProps } from "./BoxShadowEditor";
import { useSemanticLabel } from "../../../../i18n";
import { parseRacColorOrBlack } from "../utils/colorUtils";

export type BoxShadowLayerAction = "inset" | "remove";

interface BoxShadowLayerRowProps {
  readonly value: BoxShadowPresentationValue;
  readonly layerIndex: number;
  /** 편집기 remount 키 (절이 boxShadow 문자열 + topology 세대로 만든다) — 행 자체는 안정. */
  readonly editorKey: string;
  readonly onAction: (action: BoxShadowLayerAction, layerIndex: number) => void;
  readonly editor: Pick<
    BoxShadowEditorProps,
    "onCancel" | "onCommit" | "onPreview" | "livePreview"
  >;
}

function describeLayer(layer: BoxShadowPresentationLayer): string {
  return [layer.offsetX, layer.offsetY, layer.blur, layer.spread].join(" · ");
}

export const BoxShadowLayerRow = memo(function BoxShadowLayerRow({
  value,
  layerIndex,
  editorKey,
  onAction,
  editor,
}: BoxShadowLayerRowProps) {
  const localize = useSemanticLabel();
  const layer = value.layers[layerIndex];
  if (!layer) return null;

  return (
    <div className="effect-layer-row" data-inset={layer.inset || undefined}>
      <div className="effect-layer-row__body">
        <DialogTrigger>
          <AriaButton
            className="effect-layer-row__trigger"
            aria-label={localize("Edit shadow layer")}
          >
            <ColorSwatch color={parseRacColorOrBlack(layer.color)} />
            <span className="effect-layer-row__value">
              {describeLayer(layer)}
            </span>
          </AriaButton>
          <Popover
            placement="bottom start"
            className="box-shadow-popover"
            hideArrow
          >
            <BoxShadowEditor
              key={editorKey}
              value={value}
              layerIndex={layerIndex}
              onCancel={editor.onCancel}
              onCommit={editor.onCommit}
              onPreview={editor.onPreview}
              livePreview={editor.livePreview}
            />
          </Popover>
        </DialogTrigger>
        {/* 제거 — 목록 행의 「−」 (Fill 행과 같은 자리) */}
        <AriaButton
          className="effect-layer-row__action effect-layer-row__remove"
          onPress={() => onAction("remove", layerIndex)}
          aria-label={localize("Remove shadow layer")}
        >
          <Minus
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
            color={iconProps.color}
          />
        </AriaButton>
      </div>
      {/* 행 액션 칸 — inset 토글 하나 (28 열) */}
      <div className="effect-layer-row__actions">
        <AriaToggleButton
          className="effect-layer-row__action effect-layer-row__inset"
          isSelected={Boolean(layer.inset)}
          onChange={() => onAction("inset", layerIndex)}
          aria-label={
            layer.inset
              ? localize("Outer shadow layer")
              : localize("Inset shadow layer")
          }
        >
          {layer.inset ? (
            <SquareOff
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
              color={iconProps.color}
            />
          ) : (
            <Square
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
              color={iconProps.color}
            />
          )}
        </AriaToggleButton>
      </div>
    </div>
  );
});
