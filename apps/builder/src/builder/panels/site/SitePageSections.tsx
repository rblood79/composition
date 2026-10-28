import { useI18n } from "@/i18n";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";
import { Section as PropertySection } from "../../components/panel/Section";
import { PropertySizeToggle } from "../../components/property/PropertySizeToggle";
import { useCatalogToastPlacement } from "./useCatalogToastPlacement";

/**
 * S2 ToastContainer placement — where the open project's app (Preview · Publish) shows its toasts.
 * S2's one value (`top` · `top end` · `bottom` · `bottom end`) is two fields here, as S2's Toast
 * reads it (`placement` + `align`) — four labels do not fit one row of the panel.
 */
export function SiteAppSection() {
  const { t } = useI18n();
  const toastPlacement = useCatalogToastPlacement();
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
    </PropertySection>
  );
}
