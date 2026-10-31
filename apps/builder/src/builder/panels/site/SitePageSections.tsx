import { useI18n } from "@/i18n";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySelect } from "../../components/property/PropertySelect";
import { PropertySizeToggle } from "../../components/property/PropertySizeToggle";
import { useCatalogToastPlacement } from "./useCatalogToastPlacement";
import { useCatalogToastShape } from "./useCatalogToastShape";

/**
 * S2 ToastContainer placement — where the open project's app (Preview · Publish) shows its toasts.
 * S2's one value (`top` · `top end` · `bottom` · `bottom end`) is two fields here, as S2's Toast
 * reads it (`placement` + `align`) — four labels do not fit one row of the panel.
 */
export function SiteAppSection() {
  const { t } = useI18n();
  const toastPlacement = useCatalogToastPlacement();
  const toastShape = useCatalogToastShape();
  if (!toastPlacement) return null;
  const toastVertical = toastPlacement.value.startsWith("top")
    ? "top"
    : "bottom";
  const toastAlign = toastPlacement.value.endsWith("end") ? "end" : "center";
  const changeToast = (vertical: string, align: string) =>
    toastPlacement.change(
      (align === "end" ? `${vertical} end` : vertical) as CatalogToastPlacement,
    );
  const toastPlacementOptions = [
    { id: "top", label: t("settings.toastPlacementTop") },
    { id: "bottom", label: t("settings.toastPlacementBottom") },
  ];
  const toastAlignOptions = [
    { id: "center", label: t("settings.toastAlignCenter") },
    { id: "end", label: t("settings.toastAlignEnd") },
  ];

  return (
    <PropertySection id="site-app" title={t("settings.app")}>
      <div className="fieldset-row settings-row">
        <PropertySizeToggle
          label={t("settings.toastPlacement")}
          value={toastVertical}
          onChange={(value: string) => changeToast(value, toastAlign)}
          options={toastPlacementOptions}
          className="settings-toast-placement-toggle"
        />
        <PropertySizeToggle
          label={t("settings.toastAlign")}
          value={toastAlign}
          onChange={(value: string) => changeToast(toastVertical, value)}
          options={toastAlignOptions}
          className="settings-toast-align-toggle"
        />
      </div>
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
