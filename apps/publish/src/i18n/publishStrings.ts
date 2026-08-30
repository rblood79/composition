/**
 * publish 앱 자신의 문구 (ADR-200 후속).
 *
 * 여기 있는 것은 배포된 페이지의 **셸** 이다 — 프로젝트 로드 실패, 로딩 화면, 파일
 * 드롭존, 빈 페이지 안내. 읽는 사람은 그 페이지의 **방문자**이므로 언어도 방문자를
 * 따른다: provider 를 두지 않고 `useLocalizedStringFormatter` 가 브라우저 locale 로
 * 떨어지게 둔다 (`ko` 처럼 지역 없는 값도 `ko-KR` 로 매칭된다).
 *
 * 컴포넌트가 스스로 그리는 상태 문구는 `@composition/shared` 의 사전이 따로 갖는다 —
 * 이쪽은 셸, 저쪽은 컴포넌트라 수명과 소유가 다르다.
 */
import { useEffect, useMemo } from "react";
import { useLocale, useLocalizedStringFormatter } from "@react-aria/i18n";

type StringVariables = Record<string, string | number | boolean> | undefined;

/** 두 locale 이 같은 키를 갖는지 타입이 강제한다 */
interface PublishStringTable {
  loadTitle: string;
  loadFieldLabel: string;
  loadDetailLabel: string;
  showAllErrors: (args: StringVariables) => string;
  retry: string;
  loadingProject: string;
  jsonOnly: string;
  uploadLabel: string;
  dropInstructions: string;
  or: string;
  chooseFile: string;
  noPages: string;
  pageNotFound: string;
  emptyPage: string;
  pageList: string;
}

export type PublishStringKey = keyof PublishStringTable;

export type PublishTranslate = (
  key: PublishStringKey,
  variables?: StringVariables,
) => string;

export const PUBLISH_STRINGS: Record<"en-US" | "ko-KR", PublishStringTable> = {
  "en-US": {
    loadTitle: "Couldn't open this project",
    loadFieldLabel: "Field:",
    loadDetailLabel: "Details:",
    showAllErrors: (args) => `Show all errors (${args?.count ?? 0})`,
    retry: "Try again",
    loadingProject: "Opening the project…",
    jsonOnly: "Only JSON files can be uploaded",
    uploadLabel: "Upload a project file",
    dropInstructions: "Drop a JSON file here, or press Enter to choose one",
    or: "or",
    chooseFile: "Choose a file",
    noPages: "This project has no pages",
    pageNotFound: "That page doesn't exist",
    emptyPage: "This page has no elements",
    pageList: "Pages",
  },
  "ko-KR": {
    loadTitle: "프로젝트를 불러올 수 없습니다",
    loadFieldLabel: "필드:",
    loadDetailLabel: "상세:",
    showAllErrors: (args) => `모든 오류 보기 (${args?.count ?? 0}개)`,
    retry: "다시 시도",
    loadingProject: "프로젝트를 불러오는 중...",
    jsonOnly: "JSON 파일만 업로드할 수 있습니다",
    uploadLabel: "프로젝트 파일 업로드",
    dropInstructions: "JSON 파일을 드래그하거나 Enter 키를 눌러 파일을 선택하세요",
    or: "또는",
    chooseFile: "파일 선택",
    noPages: "페이지가 없습니다",
    pageNotFound: "페이지를 찾을 수 없습니다",
    emptyPage: "이 페이지에 요소가 없습니다",
    pageList: "페이지 목록",
  },
};

/** 방문자 locale 로 셸 문구를 푸는 해소기 */
export function usePublishStrings(): PublishTranslate {
  const formatter = useLocalizedStringFormatter(
    PUBLISH_STRINGS,
    "@composition/publish",
  );
  return useMemo(
    () => (key, variables) => formatter.format(key, variables),
    [formatter],
  );
}

/**
 * 문서가 실제 언어를 말하게 한다.
 *
 * `index.html` 은 `lang="ko"` 로 고정돼 있었다 — 배포된 페이지가 어떤 방문자에게나
 * 한국어라고 주장하면 스크린리더 발음과 브라우저 번역 제안이 어긋난다. 문구를 고르는
 * 것과 **같은 locale** 을 쓰도록 `useLocale()` 에서 받아 세운다.
 */
export function usePublishDocumentLanguage(): void {
  const { locale, direction } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);
}
