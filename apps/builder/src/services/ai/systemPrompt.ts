/**
 * AI System Prompt
 *
 * Tool Calling 기반 Agent Loop용 시스템 프롬프트 생성.
 *
 * **ADR-134 Phase 5 (D6)**: 컴포넌트 목록을 손으로 적던 자리를 catalog SSOT 파생 카탈로그로
 * 교체했다. 구 목록은 24개를 하드코딩해 catalog 122개와 갈라져 있었고, props / variant / size
 * 는 아예 없어 모델이 값을 지어내는 원인이었다. 상세는 요청 문맥에 맞춰 골라 넣는다 (R3).
 *
 * **고정 system + 턴 컨텍스트 분리 (2026-09-03, Fable 5.1 레퍼런스 대조)**: Claude 5 계열은
 * 요청 간에 `system` 이 바뀌면 prompt cache 가 그 지점부터 깨지고, replay 된 thinking 블록의
 * prefix binding 이 어긋나 400 이 난다. 그래서 요청과 무관한 부분 (역할 · Tier 1 목록 · 규칙)
 * 은 `buildSystemPrompt` 로 세션 동안 고정하고, 턴마다 달라지는 부분 (Tier 2 상세 · 페이지 ·
 * 선택 요소) 은 `buildTurnContext` 로 이번 턴 user 메시지 앞에 붙인다 — 이력은 append-only.
 */

import { UNIVERSAL_STYLE_CONTRACTS } from "@composition/shared";
import type { BuilderContext } from "../../types/integrations/chat.types";
import { buildCatalogDetailSection, buildCatalogIndexSection } from "./catalog";
import type { PromptTranslate } from "./promptTranslate";

/** `styles` 인자가 받는 보편 시각 키 — 컴포넌트마다 같아서 한 번만 적는다. */
function universalStyleKeys(): string {
  return Object.keys(UNIVERSAL_STYLE_CONTRACTS).join(", ");
}

/**
 * 세션 동안 고정되는 시스템 프롬프트 — 역할 · Tier 1 카탈로그 · 스타일 · mock · 규칙.
 * 빌더 상태나 이번 요청문에 의존하는 문장은 넣지 않는다 (`buildTurnContext`).
 */
export function buildSystemPrompt(t: PromptTranslate): string {
  // 문장은 카탈로그가 고른다 (ADR-200 후속) — 특히 "응답 언어" 규칙이 여기에 있어서,
  // 빌더가 en-US 인데 프롬프트만 한국어를 지시하던 어긋남이 사라진다.
  return `${t("aiPrompt.role")}

${buildCatalogIndexSection(t)}

${t("aiPrompt.frameNote")}

${t("aiPrompt.stylesHeading")}
${t("aiPrompt.stylesBody")}
${universalStyleKeys()}
${t("aiPrompt.stylesFills")}

${t("aiPrompt.mockHeading")}
/countries, /cities, /timezones, /products, /categories,
/status, /priorities, /tags, /languages, /currencies,
/users, /departments, /projects, /component-tree

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

/**
 * 이번 턴의 컨텍스트 — Tier 2 카탈로그 상세 + 빌더 상태 (페이지 · 선택 요소 · 개수).
 * 이번 턴 user 메시지 앞에 붙는다.
 *
 * @param request 이번 턴의 사용자 요청문 — 카탈로그 상세 선택 (Tier 2) 에 쓴다.
 */
export function buildTurnContext(
  context: BuilderContext,
  t: PromptTranslate,
  request?: string,
): string {
  const { currentPageId, selectedElementId, elements } = context;

  // 상세(props)는 context 가 최신 소스에서 채워 준다 — `elements` 목록에서 뽑지 않는다
  // (구조 전용 캐시라 props 가 낡는다. chat.types.ts `selectedElement` 주석 참조).
  const selectedElement = context.selectedElement ?? null;

  const detailSection = buildCatalogDetailSection(
    {
      request,
      selectedType: selectedElement?.type,
      presentTypes: [...new Set(elements.map((el) => el.type))],
    },
    t,
  );

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

  return `${detailSection}

${t("aiPrompt.stateHeading")}
${t("aiPrompt.statePageId", { id: String(currentPageId) })}
${t("aiPrompt.stateSelected", { value: selectedLine })}
${t("aiPrompt.stateCount", { count: elements.length })}
${selectedBlock}`.trimEnd();
}
