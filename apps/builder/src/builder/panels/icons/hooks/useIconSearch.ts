/**
 * useIconSearch - 아이콘 검색/필터 훅
 *
 * Lucide 아이콘 레지스트리에서 이름 기반 fuzzy search
 */

import { useMemo, useState, useDeferredValue } from "react";
import { LUCIDE_ICON_NAMES } from "@composition/rendering";

export function useIconSearch() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredIcons = useMemo(() => {
    if (!deferredQuery.trim()) return LUCIDE_ICON_NAMES;

    const lower = deferredQuery.toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 0);

    return LUCIDE_ICON_NAMES.filter((name) => {
      const lowerName = name.toLowerCase();
      return words.every((word) => lowerName.includes(word));
    });
  }, [deferredQuery]);

  return { query, setQuery, filteredIcons };
}
