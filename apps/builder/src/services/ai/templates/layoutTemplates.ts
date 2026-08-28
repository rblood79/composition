/**
 * 레이아웃 템플릿 (ADR-134 Phase 6, D7).
 *
 * "대시보드 만들어줘" 같은 요청에서 계획 담당이 구조를 매번 새로 지어내면 결과가 요청마다
 * 달라진다. 자주 나오는 골격 몇 개를 **단계 목록**으로 고정해 두고, 계획 담당이 그것을
 * 출발점으로 쓴다.
 *
 * 템플릿에 적힌 컴포넌트 type 은 전부 catalog 에 실재해야 한다 — 존재하지 않는 type 을 적어
 * 두면 계획은 그럴듯한데 실행이 조용히 실패한다. `layoutTemplates.test.ts` 가 catalog 대조로
 * 그것을 막는다 (Phase 5 의 별칭 drift 감시와 같은 형태).
 */

export interface LayoutTemplate {
  id: string;
  /** 이 템플릿이 답하는 요청의 모양. */
  when: string;
  /** 골격을 이루는 컴포넌트 type — catalog 대조 대상. */
  types: readonly string[];
  /** 계획 담당이 출발점으로 쓰는 단계. */
  steps: readonly string[];
}

export const LAYOUT_TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: "dashboard",
    when: "대시보드 / 관리 화면 / 현황판",
    types: ["frame", "Heading", "Table", "ProgressBar", "Button"],
    steps: [
      "frame 을 만들어 화면 골격을 잡는다",
      "상단에 Heading 으로 제목을 넣는다",
      "본문에 Table 을 놓고 목록을 보여 준다",
      "요약이 필요하면 ProgressBar 로 지표를 표시한다",
      "주요 동작을 Button 으로 배치한다",
    ],
  },
  {
    id: "form",
    when: "입력 폼 / 등록 / 설정 화면",
    types: ["frame", "Heading", "TextField", "Select", "Checkbox", "Button"],
    steps: [
      "frame 안에 Heading 으로 폼 제목을 넣는다",
      "필드를 TextField / Select / Checkbox 로 만든다 (label 을 반드시 채운다)",
      "제출 Button 을 마지막에 놓는다",
    ],
  },
  {
    id: "list",
    when: "목록 / 리스트 화면",
    types: ["frame", "Heading", "ListBox", "TagGroup"],
    steps: [
      "frame 안에 Heading 으로 목록 제목을 넣는다",
      "ListBox 를 만들고 bind_collection 으로 데이터를 연결한다",
      "분류가 필요하면 TagGroup 을 위에 놓는다",
    ],
  },
  {
    id: "card-grid",
    when: "카드 그리드 / 갤러리 / 상품 목록",
    types: ["frame", "Heading", "Card", "GridList"],
    steps: [
      "frame 을 만들고 Heading 으로 제목을 넣는다",
      "GridList 를 놓고 bind_collection 으로 데이터를 연결한다",
      "개별 항목 표현이 필요하면 Card 를 쓴다",
    ],
  },
];

/** 계획 담당 프롬프트에 붙일 요약 — 골격 이름과 언제 쓰는지만. */
export function formatTemplateHints(): string {
  return LAYOUT_TEMPLATES.map(
    (t) => `- ${t.id} (${t.when}): ${t.types.join(" → ")}`,
  ).join("\n");
}

export function getLayoutTemplate(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === id);
}
