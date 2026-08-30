import type { PromptTranslate } from "../promptTranslate";

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
  /** 쓰임새 설명 **키** — 표시/전송 시점에 해소한다 (ADR-200 후속). */
  when: string;
  /** 골격을 이루는 컴포넌트 type — catalog 대조 대상. */
  types: readonly string[];
  /** 계획 담당이 출발점으로 쓰는 단계. */
  /** 단계 설명 **키** 목록. */
  steps: readonly string[];
}

export const LAYOUT_TEMPLATES: readonly LayoutTemplate[] = [
  {
    id: "dashboard",
    when: "aiTemplate.dashboardWhen",
    types: ["frame", "Heading", "Table", "ProgressBar", "Button"],
    steps: [
      "aiTemplate.dashboard1",
      "aiTemplate.dashboard2",
      "aiTemplate.dashboard3",
      "aiTemplate.dashboard4",
      "aiTemplate.dashboard5",
    ],
  },
  {
    id: "form",
    when: "aiTemplate.formWhen",
    types: ["frame", "Heading", "TextField", "Select", "Checkbox", "Button"],
    steps: ["aiTemplate.form1", "aiTemplate.form2", "aiTemplate.form3"],
  },
  {
    id: "list",
    when: "aiTemplate.listWhen",
    types: ["frame", "Heading", "ListBox", "TagGroup"],
    steps: ["aiTemplate.list1", "aiTemplate.list2", "aiTemplate.list3"],
  },
  {
    id: "card-grid",
    when: "aiTemplate.gridWhen",
    types: ["frame", "Heading", "Card", "GridList"],
    steps: ["aiTemplate.grid1", "aiTemplate.grid2", "aiTemplate.grid3"],
  },
];

/** 계획 담당 프롬프트에 붙일 요약 — 골격 이름과 언제 쓰는지만. */
export function formatTemplateHints(t: PromptTranslate): string {
  return LAYOUT_TEMPLATES.map(
    (template) =>
      `- ${template.id} (${t(template.when)}): ${template.types.join(" → ")}`,
  ).join("\n");
}

export function getLayoutTemplate(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === id);
}
