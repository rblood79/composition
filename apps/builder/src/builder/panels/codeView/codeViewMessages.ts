/**
 * ADR-285 G4 — the code view's refusal messages (why · what to do instead), KO / EN. They live in
 * the panel's chunk, not the Builder's initial dictionary: only the 「코드」 panel's edit shows
 * them. Typed by the reason union, so a new reason without both lines does not compile.
 */
import type { CatalogCodeViewReason } from "../../catalogRuntime/codeViewEdit";
import type { CatalogCodeViewSnippetKind } from "../../catalogRuntime/codeViewSnippets";

interface CodeViewMessage {
  readonly reason: string;
  readonly alternative: string;
}

type CodeViewMessages = Readonly<
  Record<CatalogCodeViewReason, CodeViewMessage>
>;

const KO: CodeViewMessages = {
  unparsable: {
    reason: "코드로 읽을 수 없음 (괄호 · 태그 · 따옴표를 확인)",
    alternative: "닫히지 않은 태그 · 괄호를 닫으세요.",
  },
  outsideVocabulary: {
    reason: "코드 보기의 어휘 밖 (임의 함수 · 계산식 · 새 hook)",
    alternative:
      "요소 · prop · useState · filter 항 · 이벤트만 적을 수 있습니다. 계산은 Data · Interactions 패널에서 조건 · Do 로.",
  },
  unknownTag: {
    reason: "팔레트에 없는 요소",
    alternative:
      "팔레트의 컴포넌트 이름 (Text · Button · TextField …) 이나 div 를 쓰세요.",
  },
  unknownReference: {
    reason: "선언되지 않은 이름",
    alternative:
      "useState 로 선언한 변수 · 그 setter · 연결된 데이터 이름만 읽을 수 있습니다.",
  },
  notInCode: {
    reason: "문서로 옮겨지지 않는 부분",
    alternative:
      "크기 · 색 · 배치는 Design 패널에서, 데이터 연결은 Data 패널에서 고치세요.",
  },
  commandRefused: {
    reason: "문서가 이 변경을 받지 않음",
    alternative:
      "그 요소가 받는 자식 · prop 인지 확인하세요 (Layers · Properties 패널).",
  },
  derivedChanged: {
    reason: "문서에서 만들어지는 줄",
    alternative: "이 줄은 되돌리세요. 데이터 원본은 items={…} 에서 바꿉니다.",
  },
  ambiguousIdentity: {
    reason: "구별되지 않는 요소",
    alternative: "붙여넣기 대신 그 줄만 고치거나, Layers 에서 지우세요.",
  },
  staleBaseline: {
    reason: "편집을 시작한 뒤 문서가 바뀌었습니다",
    alternative: "「다시 불러오기」 로 지금 코드를 열고 초안을 옮기세요.",
  },
};

const EN: CodeViewMessages = {
  unparsable: {
    reason: "not readable as code (check brackets, tags, quotes)",
    alternative: "Close the open tag or bracket.",
  },
  outsideVocabulary: {
    reason:
      "outside the code view's vocabulary (a function, a calculation, a new hook)",
    alternative:
      "Write elements, props, useState, filter terms and events only. Calculations are conditions and Dos in the Data and Interactions panels.",
  },
  unknownTag: {
    reason: "not a palette element",
    alternative:
      "Use a palette component name (Text, Button, TextField …) or div.",
  },
  unknownReference: {
    reason: "a name that is not declared",
    alternative:
      "Only variables declared with useState, their setters and connected data are read.",
  },
  notInCode: {
    reason: "a part that does not go back to the document",
    alternative:
      "Change size, color and layout in the Design panel, data connections in the Data panel.",
  },
  commandRefused: {
    reason: "the document does not take this change",
    alternative:
      "Check that the element takes that child or prop (Layers · Properties).",
  },
  derivedChanged: {
    reason: "a line the document makes",
    alternative: "Undo this line. The data source changes at items={…}.",
  },
  ambiguousIdentity: {
    reason: "elements the code cannot tell apart",
    alternative:
      "Edit that line instead of pasting over it, or delete in Layers.",
  },
  staleBaseline: {
    reason: "the document changed after you started editing",
    alternative:
      "Use Reload current code to open the current code and carry your draft over.",
  },
};

export const CODE_VIEW_MESSAGES = { "ko-KR": KO, "en-US": EN } as const;

/** The snippets' names (the Data panel's actions) and the menu's. */
type SnippetLabels = Readonly<
  Record<CatalogCodeViewSnippetKind | "menu" | "none", string>
>;
const SNIPPETS_KO: SnippetLabels = {
  menu: "스니펫",
  none: "데이터를 연결한 목록이 없습니다",
  search: "검색 추가",
  radio: "라디오로 거르기",
  sortFollow: "정렬 따라가기",
  resultCount: "결과 수 표시",
  requestParam: "API 요청 매개변수",
};
const SNIPPETS_EN: SnippetLabels = {
  menu: "Snippets",
  none: "No list is connected to data",
  search: "Add search",
  radio: "Filter with radios",
  sortFollow: "Follow the sort",
  resultCount: "Show result count",
  requestParam: "API request parameter",
};
export const CODE_VIEW_SNIPPET_LABELS = {
  "ko-KR": SNIPPETS_KO,
  "en-US": SNIPPETS_EN,
} as const;

export function codeViewSnippetLabels(locale: string): SnippetLabels {
  return locale.startsWith("en") ? SNIPPETS_EN : SNIPPETS_KO;
}

/** The messages for a locale (Korean unless English). */
export function codeViewMessages(locale: string): CodeViewMessages {
  return locale.startsWith("en") ? EN : KO;
}
