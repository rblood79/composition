/**
 * FontFamilyGroup - 패밀리별 폰트 그룹
 *
 * PropertySection + PropertyListItem 패턴:
 * 각 패밀리 = section, 각 face = PropertyListItem (PropertyUnitInput 구조 재사용)
 */

import { Button } from "react-aria-components/Button";
import type { FontFaceAsset } from "@composition/shared";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { useI18n } from "@/i18n";

const DeleteIcon = ACTION_ICONS.delete;

interface FontFamilyGroupProps {
  family: string;
  faces: FontFaceAsset[];
  onDelete: (faceId: string) => void;
}

const WEIGHT_LABELS: Record<string, string> = {
  "100": "Thin",
  "200": "Extra Light",
  "300": "Light",
  "400": "Regular",
  "500": "Medium",
  "600": "Semi Bold",
  "700": "Bold",
  "800": "Extra Bold",
  "900": "Black",
};

function weightLabel(weight?: string): string {
  return weight ? (WEIGHT_LABELS[weight] ?? weight) : "Regular";
}

export function FontFamilyGroup({
  family,
  faces,
  onDelete,
}: FontFamilyGroupProps) {
  const { t } = useI18n();
  // 가족 = legend 18 (이름 · 카운트 mono 10) + 글꼴 행 28 (이름은 자기 서체 ·
  //   weight/format mono 10 · 삭제 28 hover) — 종전 절 32 + PropertyListItem 46 (legend + 필드)
  //   (panel-ui 20, 2026-09-14)
  return (
    <div className="font-family-group">
      <div className="font-family-group__header">
        <span className="font-family-group__name">{family}</span>
        <span className="font-family-group__count">{faces.length}</span>
      </div>
      <div className="font-face-list" role="list">
        {faces.map((face) => {
          const label = `${weightLabel(face.weight)}${face.style === "italic" ? " Italic" : ""}`;
          const meta = [face.weight ?? "400", face.format]
            .filter(Boolean)
            .join(" · ");

          return (
            <div key={face.id} className="font-face-row" role="listitem">
              <span
                className="font-face-row__name"
                style={{
                  fontFamily: `"${family}"`,
                  fontWeight: face.weight ?? 400,
                  fontStyle: face.style ?? "normal",
                }}
                title={face.source.originalFileName ?? face.id}
              >
                {label}
              </span>
              <span className="font-face-row__meta">{meta}</span>
              <Button
                className="font-face-row__delete"
                onPress={() => onDelete(face.id)}
                aria-label={t("fonts.deleteFace", { family, face: label })}
              >
                <DeleteIcon size={iconSmall.size} strokeWidth={iconSmall.strokeWidth} />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
