import { createElement, type CSSProperties, type ReactElement } from "react";
import { useLocale } from "react-aria-components/I18nProvider";
import { ProgressCircle } from "../../components/ProgressCircle";

/**
 * S2 체크리스트 부록 D.1 대조 (2026-11-24) — the spinner in a collection's load-more item as each S2
 * collection draws it: `tree` (S2 `TreeViewLoadMoreItem` — M in a centered wrapper, margin 4 above ·
 * below), `list` (S2 ListView — M centered, 8 above · below), `table` (S2 TableView — M centered),
 * `menu` (S2 ComboBox · Picker · Menu — S). S2 CardView draws none (its sentinel is empty — not here).
 */
export type CatalogLoadMoreLook = "tree" | "list" | "table" | "menu";

/** S2 intl `*.loadingMore` (the same words in each collection) — en · ko · ja · zh. */
function loadingMoreLabel(locale: string): string {
  const tag = locale.toLowerCase();
  if (tag.startsWith("ko")) return "추가 로드 중…";
  if (tag.startsWith("ja")) return "さらに読み込み中...";
  if (tag.startsWith("zh"))
    return /-(tw|hk|mo|hant)\b/.test(tag) ? "正在載入更多…" : "正在加载更多...";
  return "Loading more…";
}

const CENTERED: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
};

export function CatalogLoadMoreSpinner({
  look,
}: {
  look: CatalogLoadMoreLook;
}): ReactElement {
  const { locale } = useLocale();
  const circle = createElement(ProgressCircle, {
    isIndeterminate: true,
    size: look === "menu" ? "S" : "M",
    "aria-label": loadingMoreLabel(locale),
  });
  if (look === "menu") return circle;
  return createElement(
    "div",
    {
      "data-load-more": look,
      style: {
        ...CENTERED,
        ...(look === "tree" ? { marginBlock: 4 } : {}),
        ...(look === "list" ? { paddingBlock: 8 } : {}),
        boxSizing: "border-box",
      },
    },
    circle,
  );
}
