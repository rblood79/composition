/**
 * Builder SearchField
 *
 * 빌더 UI 전용 검색 필드 (패널 상단 필터링용)
 * React Aria SearchField 기반, 패널 경계에 맞는 flat 디자인
 */

import { forwardRef } from "react";
import {
  Button,
  Group,
  Input,
  SearchField as AriaSearchField,
  type SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components";
import { getIconData } from "@composition/specs";
import "./SearchField.css";

const SEARCH_ICON = getIconData("search");
const CLEAR_ICON = getIconData("x");

function LucideIcon({
  data,
}: {
  data: NonNullable<ReturnType<typeof getIconData>>;
}) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {data.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {data.circles?.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}

export interface SearchFieldProps extends Omit<
  AriaSearchFieldProps,
  "className"
> {
  placeholder?: string;
  className?: string;
  appearance?: "flat" | "control";
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    { placeholder, className, appearance = "flat", ...props },
    ref,
  ) {
    const rootClassName = [
      "builder-search-field",
      appearance === "control" && "builder-search-field--control",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const input = <Input ref={ref} placeholder={placeholder} />;
    const clearButton = (
      <Button>{CLEAR_ICON && <LucideIcon data={CLEAR_ICON} />}</Button>
    );
    const searchIcon = SEARCH_ICON && (
      <span
        className={
          appearance === "control"
            ? "control-label builder-search-icon"
            : "builder-search-icon"
        }
        aria-hidden="true"
      >
        <LucideIcon data={SEARCH_ICON} />
      </span>
    );

    return (
      <AriaSearchField {...props} className={rootClassName}>
        {appearance === "control" ? (
          <Group className="react-aria-control react-aria-Group">
            {searchIcon}
            {input}
            {clearButton}
          </Group>
        ) : (
          <>
            {input}
            {clearButton}
            {searchIcon}
          </>
        )}
      </AriaSearchField>
    );
  },
);
