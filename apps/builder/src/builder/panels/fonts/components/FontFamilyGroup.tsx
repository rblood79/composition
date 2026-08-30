/**
 * FontFamilyGroup - 패밀리별 폰트 그룹
 *
 * PropertySection + PropertyListItem 패턴:
 * 각 패밀리 = section, 각 face = PropertyListItem (PropertyUnitInput 구조 재사용)
 */

import { FileTypeCorner } from "lucide-react";
import type { FontFaceAsset } from "@composition/shared";
import { PropertySection, PropertyListItem } from "../../../components";
import { useI18n } from "@/i18n";

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
  return (
    <PropertySection title={`${family} (${faces.length})`}>
      {faces.map((face) => {
        const label = `${weightLabel(face.weight)}${face.style === "italic" ? " Italic" : ""}`;

        return (
          <PropertyListItem
            key={face.id}
            label={label}
            icon={FileTypeCorner}
            value={face.source.originalFileName ?? face.id}
            onDelete={() => onDelete(face.id)}
            deleteLabel={t("fonts.deleteFace", { family, face: label })}
          />
        );
      })}
    </PropertySection>
  );
}
