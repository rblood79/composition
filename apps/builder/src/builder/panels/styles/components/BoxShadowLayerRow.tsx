/**
 * BoxShadowLayerRow — Effect 절 Box Shadows 목록 행 (레이어 하나)
 *
 *   [swatch 16 · 「0 · 4 · 12 · 0」 · OUTER|INSET]  (팝오버 trigger → BoxShadowEditor)  |  [⋮]
 *
 * Fill 레이어 행과 같은 lrow 어법 (panel-ui 02, 2026-09-14). 28 열 ⋮ 는 inset/outer 전환 · 제거
 * (topology 변경 — presentation owner 가 거부하므로 절이 canonical commit 으로 보낸다).
 */

import { memo } from "react";
import { DialogTrigger } from "react-aria-components/Dialog";
import { Button as AriaButton } from "react-aria-components/Button";
import { parseColor, type Color } from "react-aria-components/ColorPicker";
import { Square, Trash2 } from "lucide-react";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import { PropertyRowMenu } from "../../../components";
import { SquareOff } from "../../../components/icons";
import type {
  BoxShadowPresentationLayer,
  BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
import { BoxShadowEditor, type BoxShadowEditorProps } from "./BoxShadowEditor";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

export type BoxShadowLayerAction = "inset" | "remove";

interface BoxShadowLayerRowProps {
  readonly value: BoxShadowPresentationValue;
  readonly layerIndex: number;
  /** 편집기 remount 키 (절이 boxShadow 문자열 + topology 세대로 만든다) — 행 자체는 안정. */
  readonly editorKey: string;
  readonly onAction: (action: BoxShadowLayerAction, layerIndex: number) => void;
  readonly editor: Pick<
    BoxShadowEditorProps,
    "onCancel" | "onCommit" | "onPreview" | "presentationOwnsFrameScheduling"
  >;
}

function safeColor(value: string): Color {
  try {
    return parseColor(value);
  } catch {
    return parseColor("#000000");
  }
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
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const layer = value.layers[layerIndex];
  if (!layer) return null;

  const menuItems = [
    {
      id: "inset",
      label: layer.inset
        ? localize("Outer shadow layer")
        : localize("Inset shadow layer"),
      icon: layer.inset ? Square : SquareOff,
    },
    { id: "remove", label: localize("Remove shadow layer"), icon: Trash2 },
  ];

  return (
    <div className="effect-layer-row" data-inset={layer.inset || undefined}>
      <DialogTrigger>
        <AriaButton
          className="effect-layer-row__trigger"
          aria-label={localize("Edit shadow layer")}
        >
          <ColorSwatch color={safeColor(layer.color)} />
          <span className="effect-layer-row__value">
            {describeLayer(layer)}
          </span>
          <span className="effect-layer-row__tag" aria-hidden="true">
            {layer.inset ? "inset" : "outer"}
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
            presentationOwnsFrameScheduling={
              editor.presentationOwnsFrameScheduling
            }
          />
        </Popover>
      </DialogTrigger>
      <div className="fieldset-actions actions-icon">
        <PropertyRowMenu
          label={localize("Shadow layer actions")}
          items={menuItems}
          onAction={(id) => onAction(id as BoxShadowLayerAction, layerIndex)}
        />
      </div>
    </div>
  );
});
