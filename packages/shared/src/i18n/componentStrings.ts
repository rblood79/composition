/**
 * 공유 컴포넌트가 스스로 그리는 상태 문구 (ADR-200 후속).
 *
 * 이 문구들은 **빌더 크롬이 아니다** — 로딩·오류·빈 상태는 컴포넌트가 직접 그리고,
 * 그대로 사용자가 배포한 페이지에 실려 나간다. 그래서 언어를 고르는 주체가 다르다:
 *
 * - 배포된 페이지: 그 페이지를 **보는 사람**의 locale (브라우저)
 * - 빌더 Preview: 편집 중인 **작성자**가 고른 locale
 *
 * 두 경우를 하나로 다루는 방법이 RAC 의 ambient locale 이다. `useLocalizedStringFormatter`
 * 는 가장 가까운 `I18nProvider` 의 locale 을 쓰고, 없으면 브라우저 locale 로 떨어진다 —
 * Preview 는 root 에서 작성자 locale 로 provider 를 두고 (`preview/index.tsx`), publish 는
 * 아무것도 두지 않아 방문자 locale 이 그대로 쓰인다.
 *
 * 빌더 카탈로그(`apps/builder/src/i18n`)를 쓰지 않는 이유: 의존 방향이 반대다
 * (builder → shared). 사전을 여기 두면 publish 도 빌더를 끌어오지 않고 같은 문구를 쓴다.
 */
import { useMemo } from "react";
import { useLocalizedStringFormatter } from "@react-aria/i18n";

/**
 * 함수형 항목이 받는 변수 — `useLocalizedStringFormatter` 가 넘기는 형태 그대로다
 * (넘기지 않고 부를 수도 있어 `undefined` 를 포함한다).
 */
type StringVariables = Record<string, string | number | boolean> | undefined;

/**
 * 등재 항목. **인터페이스로 두는 것이 요점이다** — 두 locale 이 같은 키를 갖는지
 * 타입이 강제한다 (한쪽에만 넣으면 그 locale 에서 키가 그대로 화면에 나온다).
 */
interface ComponentStringTable {
  loadingData: string;
  loadingDataPlain: string;
  loading: string;
  loadingPlain: string;
  loadingLabel: string;
  error: string;
  errorLabel: string;
  errorWithMessage: (args: StringVariables) => string;
  loadFailed: string;
  retry: string;
  emptyData: string;
  required: string;
  collectionValue: string;
  itemInfo: (args: StringVariables) => string;
  timeLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  previousPage: string;
  nextPage: string;
  nextPageLabel: string;
  goToPage: (args: StringVariables) => string;
  pageOfTotal: (args: StringVariables) => string;
  totalItems: (args: StringVariables) => string;
  /** ADR-923 r20m2 — 보이는 글자가 없고 호출자 aria 도 없는 Menu trigger 의 접근성 이름 (속성만). */
  menuTriggerLabel: string;
}

/** 사전에 등재된 키 */
export type ComponentStringKey = keyof ComponentStringTable;

/** 문구 해소기 — 변수는 함수형 항목에만 전달된다 */
export type ComponentTranslate = (
  key: ComponentStringKey,
  variables?: Record<string, string | number>,
) => string;

/**
 * 이 패키지가 화면에 그리는 문구 전부.
 *
 * `en-US` 가 fallback 이다 — 등재되지 않은 locale 은 여기로 떨어진다.
 * 변수를 받는 항목만 함수다 (문자열 값은 그대로 반환되며 `{var}` 가 치환되지 않는다).
 */
export const COMPONENT_STRINGS: Record<
  "en-US" | "ko-KR",
  ComponentStringTable
> = {
  "en-US": {
    loadingData: "⏳ Loading data…",
    loadingDataPlain: "Loading data…",
    loading: "⏳ Loading…",
    loadingPlain: "Loading…",
    loadingLabel: "Loading",
    error: "❌ Error",
    errorLabel: "Error",
    errorWithMessage: (args: StringVariables) =>
      `❌ Error: ${args?.message ?? ""}`,
    loadFailed: "Couldn't load the data",
    retry: "Try again",
    emptyData: "No data to show",
    required: "Required",
    collectionValue: "Collection value",
    itemInfo: (args: StringVariables) => `${args?.title ?? ""} info`,
    timeLabel: "Time",
    startTimeLabel: "Start time",
    endTimeLabel: "End time",
    previousPage: "Previous",
    nextPage: "Next",
    nextPageLabel: "Next page",
    goToPage: (args: StringVariables) => `Go to page ${args?.page ?? ""}`,
    pageOfTotal: (args: StringVariables) =>
      `Page ${args?.current ?? ""} / ${args?.total ?? ""}`,
    totalItems: (args: StringVariables) => `${args?.count ?? 0} items total`,
    menuTriggerLabel: "Menu",
  },
  "ko-KR": {
    loadingData: "⏳ 데이터 로딩 중...",
    loadingDataPlain: "데이터 로딩 중...",
    loading: "⏳ 로딩 중...",
    loadingPlain: "로딩 중...",
    loadingLabel: "로딩 중",
    error: "❌ 오류",
    errorLabel: "오류",
    errorWithMessage: (args: StringVariables) =>
      `❌ 오류: ${args?.message ?? ""}`,
    loadFailed: "데이터를 불러오지 못했습니다",
    retry: "다시 시도",
    emptyData: "표시할 데이터가 없습니다",
    required: "필수",
    collectionValue: "컬렉션 값",
    itemInfo: (args: StringVariables) => `${args?.title ?? ""} 정보`,
    timeLabel: "시간",
    startTimeLabel: "시작 시간",
    endTimeLabel: "종료 시간",
    previousPage: "이전",
    nextPage: "다음",
    nextPageLabel: "다음 페이지",
    goToPage: (args: StringVariables) => `페이지 ${args?.page ?? ""}로 이동`,
    pageOfTotal: (args: StringVariables) =>
      `페이지 ${args?.current ?? ""} / ${args?.total ?? ""}`,
    totalItems: (args: StringVariables) => `총 ${args?.count ?? 0}개 항목`,
    menuTriggerLabel: "메뉴",
  },
};

/**
 * 주변 locale 로 문구를 푸는 해소기.
 *
 * 기본값 prop (`message = "표시할 데이터가 없습니다"`) 자리에서는 훅을 부를 수 없다 —
 * 그런 자리는 기본값을 `undefined` 로 두고 본문에서 `?? t("...")` 로 채운다.
 */
export function useComponentStrings(): ComponentTranslate {
  const formatter = useLocalizedStringFormatter(
    COMPONENT_STRINGS,
    "@composition/shared",
  );
  return useMemo(
    () => (key, variables) => formatter.format(key, variables),
    [formatter],
  );
}
