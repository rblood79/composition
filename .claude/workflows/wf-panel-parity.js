export const meta = {
  name: "panel-parity-audit",
  description:
    "Property 패널 ↔ Style 패널 정합성 전수 감사 (catalog cutover 컴포넌트의 layout/containerVariants 누락)",
  phases: [
    {
      title: "Audit",
      detail: "13 컴포넌트 × 3 경로(Skia/CSS/StylePanel) layout 반영 검증",
    },
    {
      title: "Verify",
      detail: "각 findings 적대적 재검증 (false positive 제거)",
    },
    { title: "Synthesize", detail: "근본 원인 + 수정 surface 종합" },
  ],
};

// catalog containerVariants 보유 13 컴포넌트 — 모두 spec 삭제(catalog-only).
// 사용자 보고: "labelPosition=top 일 때 Style Panel Layout 섹션이 display:flex/flex-direction:column 을 표시해야 하는데 안 됨"
const COMPONENTS = [
  "CheckboxGroup",
  "ColorField",
  "ComboBox",
  "DateField",
  "DatePicker",
  "DateRangePicker",
  "NumberField",
  "RadioGroup",
  "SearchField",
  "TagGroup",
  "TextArea",
  "TextField",
  "TimeField",
];

const FINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "component",
    "specExists",
    "catalogBaseLayout",
    "catalogContainerVariants",
    "stylePanelLayoutSource",
    "skiaLayoutSource",
    "cssLayoutSource",
    "mismatch",
    "severity",
    "evidence",
  ],
  properties: {
    component: { type: "string" },
    specExists: {
      type: "boolean",
      description: "packages/specs 에 spec.ts 가 남아있는지",
    },
    catalogBaseLayout: {
      type: "string",
      description:
        'catalog rule.containerStyles 의 display/flexDirection/gap (없으면 "none")',
    },
    catalogContainerVariants: {
      type: "string",
      description:
        "catalog rule.containerVariants 요약 (예 label-position.side → flex-direction:row)",
    },
    stylePanelLayoutSource: {
      type: "string",
      description:
        "Style Panel useLayoutValues 가 layout 값을 어디서 얻는지 — specPresetResolver 가 catalog 를 읽는가? 어떤 fallback?",
    },
    skiaLayoutSource: {
      type: "string",
      description:
        "Skia/Taffy layout 이 layout 을 얻는 경로 (resolveActiveContainerVariants / resolveContainerStylesFallback / implicitStyles)",
    },
    cssLayoutSource: {
      type: "string",
      description:
        "CSS DOM 이 layout 을 얻는 경로 (수동 CSS / generated CSS / data-label-position selector)",
    },
    mismatch: {
      type: "string",
      description: '3 경로 중 어디가 어긋나는지 구체 서술. 없으면 "none"',
    },
    severity: {
      type: "string",
      enum: ["none", "low", "medium", "high"],
      description: "사용자 가시 영향 정도",
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      description: "file:line 인용 (3+개)",
    },
  },
};

phase("Audit");
const findings = await pipeline(
  COMPONENTS,
  (c) =>
    agent(
      `composition NoCode 빌더의 Property 패널 ↔ Style 패널 정합성 감사. 대상 컴포넌트: ${c}

배경 (이미 확정된 근본 원인):
- ADR-912 catalog cutover 로 ${c} 의 packages/specs/src/components/${c}.spec.ts 가 삭제됨 (catalog-only).
- 시각/layout SSOT 는 packages/shared/src/catalog/generated/componentRulesTable.ts 의 COMPONENT_RULES_TABLE.${c} (containerStyles + containerVariants).
- Skia/Layout 렌더는 apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts 의 resolveActiveContainerVariants(catalog rule fallback) + resolveContainerStylesFallback(builder wrapper, catalog rule.containerStyles 합성) 로 catalog 를 읽음 → 정상.
- 하지만 Style Panel 의 apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts 의 resolveLayoutSpecPreset 은 TAG_SPEC_MAP[type].composition.containerVariants 와 spec.containerStyles 를 직접 읽음. catalog 로 이동한 ${c} 는 TAG_SPEC_MAP["${c}"]=undefined → containerVariants/containerStyles 를 못 봄 → Layout 섹션이 display:flex/flex-direction:column(또는 side→row) 을 미반영.
- 단 useTransformAuxiliary.ts(부모 display/flexDirection fallback)와 useLayoutAuxiliary 일부는 resolveContainerStylesFallback(catalog-aware) 를 사용 — 축마다 다름.

당신의 임무 — ${c} 에 대해 3 렌더 경로의 layout 반영을 grep 으로 확증:
1. catalog rule.containerStyles 의 base layout (componentRulesTable.ts 의 ${c} 블록) — display/flexDirection/gap 실제 값. 없으면 "none".
2. catalog rule.containerVariants (label-position 등) 실제 매핑.
3. Style Panel useLayoutValues → resolveLayoutSpecPreset → resolveContainerVariants(TAG_SPEC_MAP["${c}"], props) 가 catalog 를 읽는가? specPresetResolver.ts:496-511 의 resolveLayoutSpecPreset 본문 정독. TAG_SPEC_MAP["${c}"] 가 undefined 면 base preset 도 빈 객체 → Layout 섹션 fallback("block"/"row"/"0px") 표시.
4. Skia layout: implicitStyles.ts 의 resolveActiveContainerVariants("${c.toLowerCase()}", props) 가 catalog containerVariants 를 읽는지.
5. CSS DOM: ${c} 의 layout 이 수동 CSS(packages/shared/src/components/styles/${c}.css 의 data-label-position selector) 또는 generated CSS 중 무엇으로 적용되는지.

핵심 질문: Style Panel Layout 섹션이 ${c} 의 base 또는 variant layout 을 표시하는가? 만약 catalog 만 보유하고 Style Panel 이 TAG_SPEC_MAP 직독이면 → mismatch=high.

반드시 실제 파일을 Read/Grep 으로 확인. 추측 금지. file:line 3개 이상 인용. labelPosition 이 binding.accepts 에 없으면 편집 surface 자체가 없다는 점도 확인(packages/shared/src/catalog/bindings/${c}.binding.ts).`,
      {
        label: `audit:${c}`,
        phase: "Audit",
        schema: FINDING_SCHEMA,
        agentType: "Explore",
      },
    ),
  (finding, c) => {
    if (!finding || finding.severity === "none") return finding;
    return agent(
      `적대적 재검증. 다음 정합성 mismatch 주장을 REFUTE 시도하라. 기본값은 "주장이 틀렸다(refuted=true)" — 명확한 증거로만 confirmed.

컴포넌트: ${c}
주장된 mismatch: ${finding.mismatch}
severity: ${finding.severity}
stylePanelLayoutSource: ${finding.stylePanelLayoutSource}
근거: ${(finding.evidence || []).join(" / ")}

검증 포인트:
1. Style Panel 이 정말 catalog 를 못 읽는가? specPresetResolver.ts 외에 useLayoutValues 가 다른 catalog-aware hook(useLayoutAuxiliary, useTransformAuxiliary)을 경유할 가능성? apps/builder/src/builder/panels/styles/ 전체에서 ${c} layout 을 catalog rule 로 복구하는 경로가 정말 없는지 grep.
2. resolveLayoutSpecPreset 이 TAG_SPEC_MAP["${c}"]=undefined 일 때 정말 빈 preset 을 반환하는가? (specPresetResolver.ts:501-511 본문)
3. labelPosition prop 이 binding.accepts 에 있어 실제 편집 가능한가? 없으면 사용자가 애초에 못 바꾸므로 severity 하향.
4. 이게 실제 사용자 가시 버그인가, 아니면 Style Panel Layout 섹션이 의도적으로 fallback("block")을 표시하고 실제 렌더는 정상인 "표시만 다름" 인가?

실제 파일 Read 로 확인. 결론을 schema 로 반환.`,
      {
        label: `verify:${c}`,
        phase: "Verify",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "component",
            "confirmed",
            "refutationReason",
            "correctedSeverity",
            "editableViaBinding",
          ],
          properties: {
            component: { type: "string" },
            confirmed: {
              type: "boolean",
              description: "mismatch 가 실재하는 사용자 가시 버그인가",
            },
            refutationReason: {
              type: "string",
              description: "refute 시도 결과 — 왜 confirmed 또는 refuted 인지",
            },
            correctedSeverity: {
              type: "string",
              enum: ["none", "low", "medium", "high"],
            },
            editableViaBinding: {
              type: "boolean",
              description:
                "layout 결정 prop(labelPosition 등)이 binding.accepts 에 있어 편집 가능한가",
            },
          },
        },
      },
    ).then((v) => ({ ...finding, verdict: v }));
  },
);

phase("Synthesize");
const valid = findings.filter(Boolean);
const confirmed = valid.filter((f) => f.verdict?.confirmed === true);
const summary = await agent(
  `composition 빌더의 Property 패널 ↔ Style 패널 정합성 전수 감사 결과를 종합하라.

감사 대상 13 컴포넌트 (모두 ADR-912 catalog cutover 로 spec 삭제):
${valid.map((f) => `- ${f.component}: mismatch=${f.mismatch} | severity=${f.verdict?.correctedSeverity ?? f.severity} | confirmed=${f.verdict?.confirmed} | editable=${f.verdict?.editableViaBinding} | stylePanelSource=${f.stylePanelLayoutSource}`).join("\n")}

확정된 버그(confirmed=true): ${confirmed.map((f) => f.component).join(", ") || "없음"}

종합 요청:
1. 근본 원인 한 문단 (specPresetResolver 가 TAG_SPEC_MAP 직독 → catalog cutover 컴포넌트의 containerStyles/containerVariants 미반영).
2. 정확한 수정 surface — specPresetResolver.resolveLayoutSpecPreset 이 catalog rule fallback(resolveActiveContainerVariants/resolveContainerStylesFallback 또는 builder catalog map)을 경유하도록 보강. 다른 축(Transform/Appearance)도 동일 패턴 누락이 있는지.
3. 수정 범위 분류: (A) Layout 섹션 base containerStyles(top 케이스) (B) containerVariants(side 케이스) (C) 다른 축.
4. 회귀 가드 테스트 제안.
5. surface-minimization 관점에서 단일 진입점 보강 vs 컴포넌트별 패치 권고.

구체적 file:line 과 함수명으로 답하라.`,
  { label: "synthesize", phase: "Synthesize", effort: "high" },
);

return {
  totalAudited: valid.length,
  confirmedBugs: confirmed.map((f) => f.component),
  findings: valid,
  summary,
};
