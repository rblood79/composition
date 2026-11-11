import { useI18n } from "@/i18n";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySelect } from "../../components/property/PropertySelect";
import { useCatalogToastPlacement } from "./useCatalogToastPlacement";
import { useCatalogToastShape } from "./useCatalogToastShape";

/**
 * S2 ToastContainer placement — where the open project's app (Preview · Publish) shows its toasts.
 * One select of S2's four values (`top` · `top end` · `bottom` · `bottom end`), as S2's own
 * `placement` prop (user 2026-11-11 — was two toggles, placement + align).
 */
export function SiteAppSection() {
  const { t } = useI18n();
  const toastPlacement = useCatalogToastPlacement();
  const toastShape = useCatalogToastShape();
  if (!toastPlacement) return null;
  const toastPlacementOptions: ReadonlyArray<{
    value: CatalogToastPlacement;
    label: string;
  }> = [
    { value: "top", label: t("settings.toastPlacementTop") },
    { value: "top end", label: t("settings.toastPlacementTopEnd") },
    { value: "bottom", label: t("settings.toastPlacementBottom") },
    { value: "bottom end", label: t("settings.toastPlacementBottomEnd") },
  ];

  return (
    <PropertySection id="site-app" title={t("settings.app")}>
      <PropertySelect
        label={t("settings.toastPlacement")}
        value={toastPlacement.value}
        options={toastPlacementOptions}
        translateOptions={false}
        optionValueMode="literal"
        onChange={(value) =>
          toastPlacement.change(value as CatalogToastPlacement)
        }
      />
      {/* The app's toast shape (user 2026-11-01 — RAC `MyToastRegion`: one shape per app; a `toast`
          Do passes data): the Library's Toast, or a project component whose root is a Toast. */}
      {toastShape && (
        <PropertySelect
          label={t("settings.toastShape")}
          value={toastShape.value}
          options={[
            { value: "", label: t("settings.toastShapeDefault") },
            ...toastShape.options,
          ]}
          translateOptions={false}
          optionValueMode="literal"
          onChange={(value) => toastShape.change(value || undefined)}
        />
      )}
    </PropertySection>
  );
}
