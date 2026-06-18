# ADR-913: catalog 컴포넌트 레퍼런스 기준 재구축

## Status

Proposed — 2026-06-18

## Context

ADR-912 (Implemented 2026-06-18) 로 컴포넌트 시각 SSOT 가 `*.spec.ts` 에서 catalog `COMPONENT_RULES_TABLE` 단일 정본으로 전환됐다. 그러나 이 정본의 **값** 자체는 catalog/spec 이 없던 초기에 react-aria-starter 를 여러 번 **수동 가공**해 만든 누적분이다 ([[project-catalog-reference-rebuild-framing]]). RAC/RSC 라이브러리 업데이트 대응 개념 없이 누적된 수동 drift 라, ADR-912 완료 후에도 다음 문제가 남는다:

- catalog rule 값이 starter 구조 + design.md/token reference 대비 drift 되어 **레퍼런스 디자인 갭이 크다** (본 ADR 처방의 표적).
- CSS preview (Preview/Publish DOM) 와 Skia 렌더 (Builder canvas) 는 같은 `COMPONENT_RULES_TABLE` 을 읽는 **대등 consumer** 이므로, rule 값 재정렬 시 양쪽이 함께 이동해야 한다 (정합 불일치는 처방의 표적이 아니라 동반 결과). 잔여 consumer 해석 차이(token 환원·hover/pressed 색 모델)는 R1/R3 위험 + G1/G3 Gate 로 관리한다.
- 한 컴포넌트만 부분 패치하면 공유 토큰 scale·횡단 표준(field-height/group-seam) 연계성으로 **레퍼런스 갭이 오히려 증폭**된다.

본 ADR 은 catalog 컴포넌트 시각 값을 레퍼런스(starter 구조 + design.md/css-tokens 토큰값) 기준으로 **family 단위 재구축**하는 전략을 결정한다.

**3-Domain 분류 (ssot-hierarchy.md)**: 본 ADR 은 **D3 (시각 스타일)** 내부 작업. catalog rule = D3 SSOT 의 값 재정렬. D1(RAC DOM/ARIA) / D2(binding props) 미변경. starter = D3 저작의 입력 레퍼런스(정본 아님, design.md line 5 "reference baseline, not runtime SSOT" 자기 선언).

**Hard Constraints**:

1. `ComponentRule` schema (`composition-document.types.ts:98-381`) **변경 금지** — 값만 재작성 (schema 확장은 별도 ADR).
2. radius/typography/spacing 수치 토큰 정본 = composition primitives(Skia `primitives/*.ts`)/shared-tokens(CSS) **유지** — starter 값(radius sm 6 ≠ primitives 4)으로 re-scale 금지.
3. 공유 토큰 변경 시 blast radius 0 — slice 외 family 의 generated CSS byte diff 0 + Skia snapshot 불변.
4. 각 slice 는 CSS↔Skia 시각 대칭(/cross-check) 통과 필수 (D3 symmetric consumer 계약).
5. 현 catalog custom variant (premium/genai 등 S2 외) 소실 0건.

**Soft Constraints**:

- 자동화율 실측: 적대적 검증(Workflow wc24s1828) 결과 "결정론 변환" 영역이 color base 값 + 스칼라 추출까지로 축소 — 변환 도구 ROI 낮음.
- family 간 manual 비중 편차 큼 (Button 중 ~ Collection 최대).

## Alternatives Considered

### 대안 A: starter→catalog 반자동 변환기 신규 구축

- 설명: starter CSS + design.md Mapping 을 입력으로 rule(variants/sizes/fill)을 (반)자동 생성하는 스크립트 제작. RAC 업데이트 시 재실행.
- 근거: ADR-912 가 제거한 `generate-rules.ts`(spec→table) 의 자리를 starter→table 변환기로 대체하려는 발상. 체계적 RAC 대응이 동기.
- 위험:
  - 기술: **HIGH** — 적대적 검증 3렌즈 모두 `proof-overclaims`. "starter theme.css 값 → rule TokenRef 결정론 lookup" 변환 방향이 **존재하지 않음**: `{radius.sm}` 실제 정본은 starter 가 아니라 composition primitives(Skia sm 4)/shared-tokens(CSS var), starter 값(sm 6)은 양쪽 모두와 불일치. variant 축은 starter 와 **불일치**(starter Button = primary/secondary/quiet 3축 — `Button.tsx:12` `variant?` + `utilities.css:47-51` `[data-variant]`; Button.css 자체엔 data-variant 0) — 축 불일치라 1:1 결정론 변환 불가. 자동화 가능 영역이 color base + 스칼라로 축소.
  - 성능: LOW — build-time 도구, 런타임 영향 없음.
  - 유지보수: **HIGH** — 자동화율이 낮은 도구는 출력 검수 비용 + 도구 자체 유지 비용이 이중. variant 구조/size scale/state 파생/elevation 전부 수동 보정 필요 → 도구가 "md 1단 color 초안 생성기" 에 그침.
  - 마이그레이션: MEDIUM — 도구 출력을 신뢰했다가 정정 반복 시 rollback.

### 대안 B: 변환 체크리스트(문서) + family 단위 수동 재작성

- 설명: 별도 도구 없이, starter 구조 → rule 변환 규칙을 체크리스트로 문서화하고 family 단위로 사람이 수동 재작성. 결정론 영역(color base/스칼라)은 체크리스트 기계 적용, 수동 영역(variant 구조/size scale/state)은 표기 후 판단. CSS↔Skia Gate 는 도구 유무와 무관하게 동일 적용.
- 근거: 자동화율 실측 gap (design 추정 vs 적대 검증 후 축소) 이 도구 ROI 를 무너뜨림. composition 의 family vertical slice + proof gate 선례 ([[feedback-proof-gate-seam-removal-kill-criteria]]) 와 정합.
- 위험:
  - 기술: LOW — 수동이라 변환 방향 오류(대안 A 의 starter 값 오채택) 자체가 발생 안 함. 체크리스트가 결정론 영역만 기계화.
  - 성능: LOW — 런타임 영향 없음.
  - 유지보수: MEDIUM — RAC 업데이트 시 자동 재실행 불가, 수동 반복. 단 체크리스트가 절차를 고정해 누적 drift(현재 문제의 근본 원인)는 차단.
  - 마이그레이션: LOW — family 단위 점진, slice 별 kill gate 로 회귀 표면 최소.

### 대안 C: 전체 118 ComponentRule entry 일괄 재작성 후 한 번에 교체

- 설명: family 분할 없이 전 rule 을 레퍼런스 기준으로 일괄 재작성 후 한 번에 교체. **대상 단위 = `COMPONENT_RULES_TABLE` ComponentRule entry 118개** (componentCatalog 112개와 별개 — rule-only 6개 Group/Header/Image/MenuItem/TabPanel/TabPanels 포함). 본 ADR 의 시각 정본은 ComponentRule entry 이므로 재구축 대상은 118.
- 근거: 연계성 갱장 제거가 확실 (모든 토큰이 동시 정렬).
- 위험:
  - 기술: MEDIUM — 변환 규칙 자체는 대안 B 와 동일.
  - 성능: LOW.
  - 유지보수: MEDIUM.
  - 마이그레이션: **HIGH** — 검증 표면이 118 entry 동시 → CSS↔Skia 대칭 회귀 시 원인 격리 불가. proof gate(작은 family 로 kill criteria 확인 후 확장) 부재 → ADR-144 revert(34 commit) 유형 재발 위험.

### Risk Threshold Check

| 대안                |  기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------- | :----: | :--: | :------: | :----------: | :--------: |
| A (변환기)          |  HIGH  | LOW  |   HIGH   |    MEDIUM    |     2      |
| B (체크리스트+수동) |  LOW   | LOW  |  MEDIUM  |     LOW      |     0      |
| C (일괄 교체)       | MEDIUM | LOW  |  MEDIUM  |     HIGH     |     1      |

루프 판정: 대안 B 가 HIGH+ 0개로 threshold 통과. 대안 A 의 기술 HIGH 는 "존재하지 않는 변환 방향" 이라 새 대안으로 회피 불가능(입력 부재가 근본). 대안 C 의 마이그레이션 HIGH 는 family slice(대안 B)로 회피됨. 추가 루프 불필요.

## Decision

**대안 B: 변환 체크리스트(문서) + family 단위 수동 재작성**을 선택한다.

선택 근거:

1. 적대적 검증(Workflow wc24s1828) 실측으로 대안 A 의 자동화 전제가 무너졌다 — "starter 값 → rule 결정론 변환" 방향은 존재하지 않고(토큰 정본이 composition primitives 이지 starter 아님), 자동화 가능 영역이 color base+스칼라로 축소돼 도구 ROI 가 없다. 수동 재작성이 오히려 변환 방향 오류를 원천 차단한다.
2. 잔존 위험은 "RAC 업데이트 시 수동 반복"(유지보수 MEDIUM) 뿐이고, 체크리스트가 변환 절차를 고정해 현재 문제의 근본 원인(절차 없는 누적 drift)을 차단하므로 수용 가능하다.
3. family vertical slice + kill gate 는 composition 의 검증된 패턴([[feedback-proof-gate-seam-removal-kill-criteria]])이고, 대안 C 의 마이그레이션 HIGH(원인 격리 불가)를 회피한다.

기각 사유:

- **대안 A 기각**: 자동화율이 도구 제작·유지 비용을 정당화하지 못함. 변환 방향(starter→토큰값) 자체가 존재하지 않아 도구가 틀린 값을 산출할 위험(토큰 정본은 composition primitives).
- **대안 C 기각**: proof gate 부재로 118 entry 동시 교체 시 CSS↔Skia 회귀 원인 격리 불가 (마이그레이션 HIGH).

토큰 정본 방향 결정 (사용자 confirm 2026-06-18): radius/typography/spacing 수치 토큰은 **composition primitives/shared-tokens 유지**. starter 는 variant 축·state·orientation **구조** 와 **누락 컴포넌트** 레퍼런스로만. custom variant(premium/genai)는 **보존** (S2 4 + catalog 2 = 6).

> 구현 상세: [913-catalog-reference-rebuild-breakdown.md](design/913-catalog-reference-rebuild-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------- |
| R1  | slice 작업자가 토큰 정본을 starter 값으로 닫아(radius starter 6 ≠ primitives 4) Skia/CSS 어느 한쪽이 primitives 정본과 발산 (현 composition 은 양 어댑터 모두 `{radius.sm}`=4 로 일치 — starter 값 채택 시에만 발산)                                                                                                   |  HIGH  | G1 토큰 환원 정합 Gate — 양 경로 시각값 동일 확인, 발산 시 slice 재보정                                          |
| R2  | 공유 토큰(`{radius.md}` 69블록·`{typography.text-sm}` 119블록) 수정이 slice 밖 family 를 의도치 않게 re-scale                                                                                                                                                                                                          |  HIGH  | G4 cross-component 회귀 Gate — slice 외 byte diff 0 + Skia snapshot 불변                                         |
| R3  | hover/pressed 색 모델 불일치 (starter OKLCH ↔ rule color-mix srgb) 로 state 시각 발산                                                                                                                                                                                                                                  | MEDIUM | G3 CSS↔Skia 대칭에 state 셀 포함, 발산 시 수동 검수 격리. color-mix 모델 유지(현 D3 SSOT)                        |
| R4  | 수동 재작성이 "결정론 표기" 한 필드를 실제론 정정 필요 (overclaim 재발)                                                                                                                                                                                                                                                | MEDIUM | G5 자동화율 floor Gate — 결정론 표기 필드 정정 0 검증, 반복 시 체크리스트에서 영구 제외                          |
| R5  | elevation(box-shadow) 단색 평탄화로 starter 입체감 손실                                                                                                                                                                                                                                                                |  LOW   | ADR-142 의도된 평탄화 유지. schema(boxShadow) 확장은 별도 ADR (본 scope 밖)                                      |
| R6  | rule table 편집 후 generated CSS 재생성 누락 시 Skia(런타임 직독)만 갱신되고 CSS(커밋 빌드 산출물)는 stale → preview↔Skia 발산 (= 본 ADR 이 해소하려는 문제의 재발 경로). rule table 은 `packages/shared/` 경로라 `spec-rebuild-flag.sh`(packages/specs 만 매칭)·turbo build 가 `generate:css` 를 자동 트리거하지 않음 |  HIGH  | G6 CSS 재생성 정합 Gate — slice 변환 시 `pnpm generate:css` 재실행 + CSS diff 커밋 + `validate:sync` PASS 의무화 |

## Gates

| Gate                    | 시점          | 통과 조건                                                                                                                     | 실패 시 대안                                                                                                                                    |
| ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 토큰 환원 정합       | slice 변환 시 | TokenRef 의 Skia 해석값 = CSS var 해석값 시각 동일                                                                            | starter 값으로 닫아 한쪽 발산 시 slice 재보정, starter→catalog 자동 generate 폐기                                                               |
| G2 variant 구조 보존    | slice 변환 후 | 출력 variant 집합 ⊇ 현 catalog (premium/genai 소실 0)                                                                         | S2 derive 만으로 채워 custom 누락 시 구조 입력 = S2+catalog 병합 재설계                                                                         |
| G3 CSS↔Skia 시각 대칭   | slice 완료 시 | variant×size×state 매트릭스 전 셀 시각 일치 (Chrome MCP /cross-check)                                                         | hover/pressed 모델 치환 발산 시 state 파생 수동 검수 격리                                                                                       |
| G4 cross-component 회귀 | slice 완료 시 | slice 외 family generated CSS byte diff 0 + Skia snapshot 불변                                                                | blast radius 초과 시 family 전역 회귀 검증 의무 편입                                                                                            |
| G5 자동화율 floor       | 각 slice      | '결정론 생성' 표기 필드 manual 정정 0                                                                                         | 반복 정정 시 autoConvertible 영구 제외, scope 를 color base+스칼라 축소                                                                         |
| G6 CSS 재생성 정합      | slice 변환 시 | rule 편집 후 `pnpm generate:css` 재실행 + 산출 CSS diff 커밋 + `validate:sync` PASS (Skia 런타임 직독 ↔ CSS 빌드 산출물 동기) | CSS 재생성 누락으로 G4 byte-diff 입력 미정의 시 slice 차단 — `validate:sync` 를 slice 완료 게이트로 강제, hook 매칭 경로에 rule table 편입 검토 |

## Consequences

### Positive

- catalog 시각 값이 레퍼런스(starter 구조 + composition 토큰 정본) 기준으로 정렬 → 레퍼런스 디자인 갭 해소. CSS preview ↔ Skia 는 대등 consumer 라 rule 정렬이 양쪽에 동반 반영 (정합은 처방 표적이 아닌 부수 결과, 잔여는 G1/G3 Gate 관리).
- 변환 체크리스트로 변환 절차 고정 → RAC/RSC 업데이트 대응 시 누적 drift(현재 문제 근본 원인) 차단.
- 누락 컴포넌트 4 (ColorThumb/CommandPalette/InputGroup/Sheet) 신규 등록 + orientation/labelPosition containerVariants 비대칭 보정 (slice 진행 중 흡수).
- family slice + kill gate 로 회귀 표면 최소, 원인 격리 가능.

### Negative

- RAC 업데이트 시 자동 재실행 불가 — family 단위 수동 반복 (도구 미제작 trade-off).
- Collection family 는 manual 비중 최대(::after divider/grid-area/orientation 미표현 + STRUCTURE_META 손편집) → ROI 최저, 후순위.
- 전 family 재구축 완료까지 점진 진행 (6 slice 순차) — 단기 일괄 완결 아님.
- slice 간 catalog 가 부분 재구축된 hybrid 상태로 체류 — 이 기간 공유 토큰(R2) 수정 시 미재구축 family 에 영향 가능. G4 byte-diff-0 + Skia snapshot 불변 Gate 로 차단하되, slice 경계마다 검증 필수.

## 진행 로그

### slice 1 — Button family (proof slice) — 2026-06-18

**결과**: proof slice 통과. Button family 는 이미 primitives 토큰 + css-tokens 시맨틱과 1:1 정렬돼 있음을 검증으로 확정 (변경 0 = "맞음"의 증거). Context 의 "drift 크다" 전제는 Button family 에 대해서는 ADR-912 단계에서 이미 해소됨. 실재 갭 1건만 보정:

- **ToggleButton lineHeight 표기 통일** (결정론 §2-A): sizes 의 lineHeight 숫자값 (16/16/20/24/28) → `{typography.text-{2xs,xs,sm,base,lg}--line-height}` TokenRef 치환. Button 표기와 일관. 위치: `componentRulesTable.ts` ToggleButton.sizes.
  - **시각 무변 검증 (G1)**: live DOM computed line-height 5 size 전부 기존 절대 px 와 일치 (xs/sm 16, md 20, lg 24, xl 28 — `var(--text-*--line-height)` unitless 배수 × fontSize = 기존 절대값). Skia 경로는 `resolveShapeLineHeight` → `resolveToken({typography.*})` → typography 테이블 동일 숫자. 양 경로 정합.
  - **byte-diff 격리 (G4/G6)**: `generate:css` 재실행 후 generated diff = `ToggleButton.css` 단독 (literal→var 6위치). slice 외 family CSS byte diff 0.

- **Button quiet variant 흡수 — 제외 (제약 발견)**: §2-C 흡수 후보(S2 `variant=quiet` 정본)였으나, 현 Button 의 DOM hover 메커니즘 (`utilities.css` `.button-base` = single `--button-color` → `color-mix(85%, black)` 으로 어둡게) 이 quiet 의 "base transparent → hover accent-subtle (다른 색 계열)" 을 표현 불가. rule `fill.default.hover` 를 넣어도 Skia 는 직접 읽어 accent-subtle, DOM 은 `--button-color`(transparent) 에서 color-mix 파생 → **G3 CSS↔Skia 대칭 위반**. 흡수하려면 `utilities.css` `.button-base` 에 quiet 전용 hover 분기 추가(수동 CSS 확장 = "값만 재작성" scope 경계 밖) 필요 → 본 slice 제외, 사용자 confirm (2026-06-18).

**검증**: type-check PASS (builder baseline 71, new 0) / validate:sync 회귀 0 (baseline 동일, Button family 는 spec 없어 직접 미커버) / live DOM 측정 (Chrome MCP) / G4 byte-diff 격리.

**proof gate 결과**: kill criteria 통과 → slice 2 (Field) 확장 자격 확립. quiet 제약 발견 = proof slice 가 작은 범위에서 emit/utility 구조 한계를 먼저 드러낸 가치 입증.

**후속 검증 영역 (slice 1 미해소, 별도)**:

- breakdown §5 "Toolbar orientation Skia 미표현" 서술의 실제 코드 상태(`implicitStyles.ts` 의 `LOWERCASE_COMPONENT_RULE_CONTAINER` fallback 경유 처리 여부)는 미확정 — Toolbar 전용 하드코딩 분기 부재 확인했으나 fallback 경로 처리 여부는 별도 grep 검증 후 §5 정정 판단 (미검증 정정 금지).
