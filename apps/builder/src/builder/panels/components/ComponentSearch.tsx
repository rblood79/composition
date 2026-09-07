import { useState, useEffect, useCallback } from "react";
import { SearchField } from "../../components/ui/SearchField";
import { useRecentSearches } from "../../hooks/useRecentSearches";
import "./ComponentSearch.css";

interface ComponentSearchProps {
  onSearchChange: (query: string) => void;
}

/**
 * ComponentSearch - Simple search field for filtering ComponentList
 *
 * Features:
 * - Real-time search query updates
 * - Filters ComponentList in real-time
 */
export function ComponentSearch({ onSearchChange }: ComponentSearchProps) {
  const [query, setQuery] = useState("");
  const { addSearch } = useRecentSearches();

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      onSearchChange(value);
    },
    [onSearchChange],
  );

  // 검색 기록 저장 (debounce: 1초 후 저장)
  useEffect(() => {
    if (!query.trim()) return;

    const timeoutId = setTimeout(() => {
      addSearch(query);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [query, addSearch]);

  return (
    <SearchField
      className="component-search-field"
      appearance="control"
      value={query}
      onChange={handleChange}
      placeholder="Search components..."
      aria-label="Search components"
    />
  );
}
