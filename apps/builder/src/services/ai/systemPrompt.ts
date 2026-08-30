/**
 * AI System Prompt
 *
 * Tool Calling 기반 Agent Loop용 시스템 프롬프트 생성.
 *
 * **ADR-134 Phase 5 (D6)**: 컴포넌트 목록을 손으로 적던 자리를 catalog SSOT 파생 카탈로그로
 * 교체했다. 구 목록은 24개를 하드코딩해 catalog 122개와 갈라져 있었고, props / variant / size
 * 는 아예 없어 모델이 값을 지어내는 원인이었다. 상세는 요청 문맥에 맞춰 골라 넣는다 (R3).
 */

import { UNIVERSAL_STYLE_CONTRACTS } from "@composition/shared";
import type { BuilderContext } from "../../types/integrations/chat.types";
import { buildCatalogSection } from "./catalog";
import type { PromptTranslate } from "./promptTranslate";

/** `styles` 인자가 받는 보편 시각 키 — 컴포넌트마다 같아서 한 번만 적는다. */
function universalStyleKeys(): string {
  return Object.keys(UNIVERSAL_STYLE_CONTRACTS).join(", ");
}

/**
 * Agent Loop용 시스템 프롬프트 생성.
 *
 * @param request 이번 턴의 사용자 요청문 — 카탈로그 상세 선택 (Tier 2) 에 쓴다.
 */
export function buildSystemPrompt(
  context: BuilderContext,
  t: PromptTranslate,
  request?: string,
): string {
  const { currentPageId, selectedElementId, elements } = context;

  // 상세(props)는 context 가 최신 소스에서 채워 준다 — `elements` 목록에서 뽑지 않는다
  // (구조 전용 캐시라 props 가 낡는다. chat.types.ts `selectedElement` 주석 참조).
  const selectedElement = context.selectedElement ?? null;

  const catalogSection = buildCatalogSection({
    request,
    selectedType: selectedElement?.type,
    presentTypes: [...new Set(elements.map((el) => el.type))],
  });

  // 문장은 카탈로그가 고른다 (ADR-200 후속) — 특히 "응답 언어" 규칙이 여기에 있어서,
  // 빌더가 en-US 인데 프롬프트만 한국어를 지시하던 어긋남이 사라진다.
  const selectedLine = selectedElement
    ? `${selectedElement.type} (ID: ${selectedElementId})`
    : t("aiPrompt.stateNone");

  const selectedBlock = selectedElement
    ? `
${t("aiPrompt.selectedHeading")}
${t("aiPrompt.selectedTag", { type: selectedElement.type })}
${t("aiPrompt.selectedProps", { props: JSON.stringify(selectedElement.props, null, 2) })}
${t("aiPrompt.selectedParent", { parent: selectedElement.parent_id || "root" })}
`
    : "";

  return `${t("aiPrompt.role")}

${catalogSection}

${t("aiPrompt.frameNote")}

${t("aiPrompt.stylesHeading")}
${t("aiPrompt.stylesBody")}
${universalStyleKeys()}
${t("aiPrompt.stylesFills")}

${t("aiPrompt.mockHeading")}
/countries, /cities, /timezones, /products, /categories,
/status, /priorities, /tags, /languages, /currencies,
/users, /departments, /projects, /component-tree

${t("aiPrompt.stateHeading")}
${t("aiPrompt.statePageId", { id: String(currentPageId) })}
${t("aiPrompt.stateSelected", { value: selectedLine })}
${t("aiPrompt.stateCount", { count: elements.length })}
${selectedBlock}
${t("aiPrompt.rulesHeading")}
${t("aiPrompt.rule1")}
${t("aiPrompt.rule2")}
${t("aiPrompt.rule3")}
${t("aiPrompt.rule4")}
${t("aiPrompt.rule5")}
${t("aiPrompt.rule6")}

${t("aiPrompt.canonicalHeading")}
${t("aiPrompt.canonicalBody")}

${t("aiPrompt.bindingHeading")}
${t("aiPrompt.bindingBody")}

${t("aiPrompt.eventsHeading")}
${t("aiPrompt.eventsBody")}`;
}
