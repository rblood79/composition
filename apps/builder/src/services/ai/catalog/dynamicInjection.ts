/**
 * Tier 2 동적 주입 (ADR-134 Phase 5, D6 / R3).
 *
 * 전체 카탈로그를 상세까지 펼치면 context 예산을 넘는다 (R3 — 122 컴포넌트 × props).
 * 그래서 **항상 주입하는 것은 Tier 1 (type 목록)** 이고, 상세는 이번 요청에 관련된
 * 컴포넌트만 고른다. 모델이 목록에서 이름을 보고 필요하면 `search_elements` /
 * `get_editor_state` 로 되물을 수 있으므로, 상세 누락이 곧 실패가 아니다.
 *
 * 선택 근거는 4개뿐이고 순서가 곧 우선순위다:
 * 1. 요청문이 직접 부른 type (영문 type 명 또는 한국어 별칭)
 * 2. 요청문이 부른 카테고리 (예: "폼", "컬렉션")
 * 3. 현재 선택된 요소의 type — 수정 요청은 대부분 여기에 걸린다
 * 4. 그래도 비면 core set — 첫 요청에서 가장 자주 쓰이는 컴포넌트
 */
import {
  formatCatalogEntries,
  formatCatalogIndex,
  getAiCatalogEntry,
  getAiComponentCatalog,
  getCatalogByCategory,
  type AiCatalogEntry,
} from "./componentCatalog";

/** 한 번에 상세를 펼치는 최대 컴포넌트 수 — context 예산 상한. */
export const DEFAULT_DETAIL_BUDGET = 12;

/**
 * 한국어 요청어 → catalog type. **손으로 적는 유일한 층** — catalog 는 영문 type 과
 * 영문 label 만 갖고 있어 "버튼" 을 Button 으로 잇는 사전이 SSOT 에 없다.
 * 여기 없는 단어는 영문 type 명 매칭으로 떨어진다 (모델은 Tier 1 목록에서 이름을 본다).
 */
export const KO_ALIASES: Readonly<Record<string, string>> = {
  버튼: "Button",
  토글버튼: "ToggleButton",
  체크박스: "Checkbox",
  라디오: "Radio",
  스위치: "Switch",
  슬라이더: "Slider",
  입력: "TextField",
  입력창: "TextField",
  텍스트필드: "TextField",
  텍스트: "Text",
  제목: "Heading",
  링크: "Link",
  아이콘: "Icon",
  선택: "Select",
  드롭다운: "Select",
  콤보박스: "ComboBox",
  목록: "ListBox",
  리스트: "ListBox",
  표: "Table",
  테이블: "Table",
  트리: "Tree",
  탭: "Tabs",
  카드: "Card",
  달력: "Calendar",
  날짜: "DatePicker",
  날짜선택: "DatePicker",
  모달: "Modal",
  다이얼로그: "Dialog",
  팝오버: "Popover",
  툴팁: "Tooltip",
  메뉴: "Menu",
  진행률: "ProgressBar",
  프레임: "frame",
  컨테이너: "frame",
  태그: "TagGroup",
  배지: "Badge",
  폼: "Form",
  툴바: "Toolbar",
};

/** 한국어 카테고리 요청어 → catalog category. */
export const KO_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  버튼: "buttons",
  폼: "forms",
  양식: "forms",
  컬렉션: "collections",
  목록: "collections",
  레이아웃: "layout",
  구조: "structure",
  오버레이: "overlays",
  날짜: "dateTime",
  색상: "color",
  콘텐츠: "content",
};

/**
 * 요청 문맥이 비었을 때 펼칠 기본 집합. "무엇이든 만들어 줘" 류 첫 요청에서
 * 모델이 최소한의 조립 어휘를 갖도록 한다.
 */
export const CORE_TYPES: readonly string[] = [
  "frame",
  "Button",
  "TextField",
  "Text",
  "Heading",
  "Select",
  "Checkbox",
  "ListBox",
  "Table",
  "Card",
];

export interface InjectionContext {
  /** 이번 턴의 사용자 요청문. */
  request?: string;
  /** 현재 선택된 요소의 type. */
  selectedType?: string;
  /** 현재 페이지에 이미 있는 type 들 (수정 요청의 문맥). */
  presentTypes?: readonly string[];
  /** 상세를 펼칠 최대 개수. */
  budget?: number;
}

export interface InjectionResult {
  /** 상세를 펼친 컴포넌트. */
  selected: readonly AiCatalogEntry[];
  /** 각 선택의 근거 — 디버깅·검증용. */
  reasons: ReadonlyMap<string, "request" | "category" | "selection" | "core">;
  /** 시스템 프롬프트에 붙일 카탈로그 블록. */
  text: string;
}

/**
 * CamelCase type 명 → 요청문 매칭 패턴.
 *
 * 사람은 `ProgressBar` 를 "progress bar" 로, `TextField` 를 "text field" 로 쓴다. 그래서
 * 단어 사이 구분자를 선택적으로 허용한다. 대신 "text field" 가 `Text` 로도 잡히는 문제가
 * 생기므로, 호출부가 **긴 이름부터** 매칭하고 잡은 자리를 지운다.
 */
function typePattern(type: string): RegExp {
  const words = type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  return new RegExp(
    `(^|[^a-z0-9])${words.join("[\\s_-]*")}([^a-z0-9]|$)`,
    "i",
  );
}

/** 요청문에서 type 을 뽑는다 — 영문 type 명 (경계 일치) + 한국어 별칭. */
function typesFromRequest(request: string): string[] {
  const hits: Array<{ type: string; at: number }> = [];

  // 긴 이름 우선 — "text field" 를 TextField 로 잡고 그 자리를 지워 Text 가 겹쳐 잡지
  // 않게 한다. 지운 자리는 공백으로 둬 앞뒤 경계는 보존한다.
  let haystack = request.toLowerCase();
  const byLength = [...getAiComponentCatalog()].sort(
    (a, b) => b.type.length - a.type.length,
  );

  for (const entry of byLength) {
    const match = typePattern(entry.type).exec(haystack);
    if (!match) continue;
    hits.push({ type: entry.type, at: match.index });
    haystack =
      haystack.slice(0, match.index) +
      " ".repeat(match[0].length) +
      haystack.slice(match.index + match[0].length);
  }

  // 요청문에 나온 순서 = 사용자가 먼저 말한 것 — 예산이 모자랄 때의 우선순위.
  hits.sort((a, b) => a.at - b.at);
  const ordered = hits.map((h) => h.type);

  for (const [alias, type] of Object.entries(KO_ALIASES)) {
    if (request.includes(alias) && !ordered.includes(type)) ordered.push(type);
  }
  return ordered;
}

function categoriesFromRequest(request: string): string[] {
  const hits: string[] = [];
  for (const category of getCatalogByCategory().keys()) {
    if (request.toLowerCase().includes(category.toLowerCase())) {
      hits.push(category);
    }
  }
  for (const [alias, category] of Object.entries(KO_CATEGORY_ALIASES)) {
    if (request.includes(alias) && !hits.includes(category)) hits.push(category);
  }
  return hits;
}

/** 이번 요청에 펼칠 컴포넌트를 고른다. */
export function selectCatalogEntries(
  context: InjectionContext = {},
): InjectionResult {
  const budget = context.budget ?? DEFAULT_DETAIL_BUDGET;
  const reasons = new Map<
    string,
    "request" | "category" | "selection" | "core"
  >();
  const order: string[] = [];

  const take = (
    type: string,
    reason: "request" | "category" | "selection" | "core",
  ) => {
    if (reasons.has(type) || order.length >= budget) return;
    if (!getAiCatalogEntry(type)) return;
    reasons.set(type, reason);
    order.push(type);
  };

  const request = context.request ?? "";

  // 1. 요청문이 직접 부른 type
  if (request) for (const type of typesFromRequest(request)) take(type, "request");

  // 2. 요청문이 부른 카테고리
  if (request) {
    const byCategory = getCatalogByCategory();
    for (const category of categoriesFromRequest(request)) {
      for (const type of byCategory.get(category) ?? []) take(type, "category");
    }
  }

  // 3. 현재 선택 + 페이지에 있는 type
  if (context.selectedType) take(context.selectedType, "selection");
  for (const type of context.presentTypes ?? []) take(type, "selection");

  // 4. core set — 위에서 아무것도 못 골랐을 때만
  if (order.length === 0) for (const type of CORE_TYPES) take(type, "core");

  const selected = order
    .map((type) => getAiCatalogEntry(type))
    .filter((e): e is AiCatalogEntry => Boolean(e));

  return { selected, reasons, text: formatCatalogEntries(selected) };
}

/**
 * 시스템 프롬프트에 넣을 카탈로그 절 전체 (Tier 1 + Tier 2).
 * `styles` 로 가는 보편 시각 키는 컴포넌트마다 같으므로 여기 한 번만 적는다.
 */
export function buildCatalogSection(context: InjectionContext = {}): string {
  const { text } = selectCatalogEntries(context);
  return [
    "## 컴포넌트 카탈로그",
    "아래 목록에 있는 type 만 만들 수 있습니다. 상세가 없는 컴포넌트를 쓰려면",
    "`get_editor_state` 로 기존 요소를 보고 props 를 유추하거나, 목록의 이름을 그대로 쓰세요.",
    "",
    "### 전체 목록 (카테고리: type)",
    formatCatalogIndex(),
    "",
    "### 이번 요청에 관련된 컴포넌트 상세",
    text,
  ].join("\n");
}
