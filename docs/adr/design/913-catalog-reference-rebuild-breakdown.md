# ADR-913 구현 상세 — catalog 레퍼런스 기준 재구축

> 본문: [913-catalog-reference-rebuild.md](../913-catalog-reference-rebuild.md). 본 문서는 구현 상세(변환 체크리스트 / family slice 순서 / Gate 상세 / 누락 컴포넌트 / orientation 갭)만 보유. 본문 전제·결정은 본문 참조.

## 1. Fork / 전제 점검 lock-in (adr-writing.md §"ADR Fork 전제 점검" 4질문)

> 본 ADR 은 ADR-912(catalog cutover) 의 **후속 다음 단계**다. fork 가 아니라 ADR-912 가 명시적으로 남긴 "다음 단계" 의 첫 ADR. 그래도 base/응용 분류는 lock-in 한다.

1. **base / 응용 분류**: ADR-912 = catalog cutover (spec → catalog 단일 정본, dual-SSOT 소멸) = **base**. ADR-913 = 그 정본의 **시각 값을 레퍼런스 기준으로 재정렬** = 응용. ADR-912 가 prerequisite (이미 Implemented 2026-06-18).
2. **schema 직교성**: ADR-913 은 `ComponentRule` schema 를 **변경하지 않는다** (값만 재작성). schema 확장 후보(boxShadow)는 본문 R5 + openQuestion 으로 분리 — 본 ADR scope 밖.
3. **선행 ADR 전제 reverse 검증**: ADR-912 의 "catalog = 시각 정본" 전제를 그대로 승계 — valid (사용자 2026-06-18 확정, [[project-catalog-reference-rebuild-framing]]). starter/design.md = 참조이지 정본 아님.
4. **codex 3차 미루지 말 것**: 적대적 검증(Workflow wc24s1828)을 ADR 작성 **전에** 이미 수행 — slice proof 의 "starter→rule 결정론 변환" overclaim 을 3렌즈가 사전 적발. 전제 결함(토큰 정본 출처)이 본문 작성 전 해소됨.

**사용자 explicit confirm (M2)**: 2026-06-18 AskUserQuestion 3회로 (a) 토큰 정본=composition 유지 (b) 도구 미제작=체크리스트+수동 (c) 6 variant 보존 confirm 받음. ADR 번호 ADR-913 도 사용자 지정.

## 2. 변환 체크리스트 — starter 구조 → catalog rule 수동 재작성 규칙

> 도구(변환기) 미제작 결정 (본문 대안 B). 아래는 family 단위 **수동 재작성 시 따르는 결정론 규칙 + 수동 판단 경계**. 자동화율이 'color base 값 + 스칼라 추출' 로 축소돼 도구 ROI 없음 (적대적 검증 결론).

### 2-A. 결정론 영역 (체크리스트 기계적 적용)

| 항목                                  | 규칙                                                                                                                                    | 정본 출처                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| base(default state) color             | starter 시맨틱 var → TokenRef 직번역 (`--accent`→`{color.accent}`, `field-background`→`{color.layer-2}`) — **accent 류 1 variant 한정** | design.md §Mapping + css-tokens.md                  |
| color TokenRef → 시각값               | 17 variant color TokenRef 1:1 CSS var 매핑 후 theme value 환원 (color 축만 2단 폐쇄)                                                    | css-tokens.md:122-163                               |
| borderWidth / textWeight              | 정적 스칼라 추출 (borderWidth:1, font-weight 정적값)                                                                                    | starter `.css` 직접값                               |
| size 수치 (radius/typography/spacing) | **composition primitives 유지** — starter 값 사용 금지 (sm 6 ≠ primitives 4)                                                            | `primitives/radius.ts` `typography.ts` `spacing.ts` |

### 2-B. 수동 판단 필수 영역 (체크리스트로 표기만, 사람이 결정)

| 항목                                                                   | 왜 수동                                                                       | 결정 출처                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| variant 6축 구조                                                       | starter 에 variant 개념 물리 부재 (Button.css 단일 룰, data-variant 0건)      | S2 spec 4 (accent/primary/secondary/negative) + catalog 보존 2 (premium/genai) |
| variant→token 배치                                                     | 어느 variant 가 어느 fill/text/border — design.md per-variant 부재            | 현 catalog componentRulesTable 보존값 정본 채택                                |
| hover/pressed 색 모델                                                  | starter OKLCH lightness step ↔ rule color-mix srgb 85/75% black = 수학적 상이 | css-tokens.md color-mix 모델 유지 (현 D3 SSOT)                                 |
| size 5단 스케일 보간                                                   | starter 단일 고정값 (padding 0 var(--spacing-3)) → tier source 부재           | 현 catalog sizes 보존 / 디자인 판단                                            |
| elevation (box-shadow)                                                 | rule schema boxShadow 필드 부재 → 단색 평탄화                                 | ADR-142 의도된 평탄화 유지 (schema 확장은 별도 ADR)                            |
| 구조 정보 (archetype/element/grid-area/자식 selector/cssEmitMode/icon) | rule 미보유, `generate-css.ts STRUCTURE_META_ENTRIES` 손편집                  | STRUCTURE_META 직접 작성                                                       |

## 3. family slice 순서 (vertical slice proof 후 확장)

| #   | family                   | 멤버                                                                             | manual 비중      | 선행 의존 / 비고                                                                                                                                                              |
| --- | ------------------------ | -------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Button** (proof slice) | Button / ButtonGroup / ToggleButton / ToggleButtonGroup                          | 중               | kill gate 통과해야 확장. ToggleButton selected 상태축 1개 추가                                                                                                                |
| 2   | Field                    | TextField / TextArea / NumberField / SearchField / Select / ComboBox / DateField | 중               | DELEGATING 등록([[feedback-cutover-wrapper-children-need-delegating]]) + containerVariants Skia fallback([[feedback-containervariants-catalog-fallback-mechanism]]) 선례 흡수 |
| 3   | Selection-control        | Checkbox / CheckboxGroup / Radio / RadioGroup / Switch                           | 높음 (구조 수동) | SVG 체크마크·data-orientation STRUCTURE_META 전용. 중간 컨테이너 폐기([[feedback-intermediate-container-removal-cutover-wrapper-gap]]) 선행                                   |
| 4   | Collection               | ListBox / GridList / Menu / Table / Tree / TagGroup / Breadcrumbs                | 최대 (ROI 최저)  | ::after divider·grid-area·orientation 미표현, ADR-907 Layer B + projection sub-part. 후순위                                                                                   |
| 5   | Overlay                  | Dialog / Popover / Tooltip / Modal                                               | 중               | 다층 box-shadow elevation 단색 평탄화 (design.md elevation 비대칭)                                                                                                            |
| 6   | Color                    | ColorPicker / ColorSwatch / ColorSlider 등                                       | —                | ADR-912 cutover 직교. ColorPicker/ColorSwatchPicker 는 TAG_SPEC_MAP 제외분 → slice 대상 제외 검토                                                                             |

## 4. 누락 컴포넌트 신규 등록 (1-1) — slice 진행 중 흡수

> starter 55 ↔ catalog 비교 (Workflow 실측). 단순 이름 비교 false positive 제거 후 실제 신규 등록 대상 4.

| 컴포넌트         | 판정            | 흡수 slice                            | starter 기초                                    |
| ---------------- | --------------- | ------------------------------------- | ----------------------------------------------- |
| ColorThumb       | 신규 등록       | 6 Color                               | RAC ColorThumb                                  |
| CommandPalette   | 신규 등록       | 별도 (Autocomplete+Modal+Dialog 합성) | RAC Autocomplete                                |
| InputGroup       | 신규 등록       | 2 Field                               | RAC Group + Label + InputContext                |
| Sheet            | 신규 등록       | 5 Overlay                             | RAC Modal + ModalOverlay (슬라이드 변형)        |
| SegmentedControl | **등록 불필요** | —                                     | catalog `ToggleButtonGroup`+`ToggleButton` 흡수 |
| Content          | **등록 불필요** | —                                     | Heading/Text export alias (둘 다 등록됨)        |

## 5. orientation / labelPosition 비대칭 보정 (1-2) — slice 진행 중 흡수

> binding(D2)에는 있는데 rule containerVariants(side 배치)가 없어 Skia side 레이아웃 미표현. RSC(React Spectrum) 형태 참조 (label 가진 컴포넌트의 orientation).

| 컴포넌트                             | binding            | rule containerVariants          | 보정 slice             |
| ------------------------------------ | ------------------ | ------------------------------- | ---------------------- |
| Slider                               | orientation ✓      | ✗                               | 1/proof 직후 또는 별도 |
| TimeField / SearchField / ColorField | labelPosition ✓    | ✗                               | 2 Field                |
| Toolbar                              | binding 없음       | ✗                               | 1 Button               |
| DatePicker                           | labelPosition 없음 | containerVariants 있음 (비일관) | 2 Field                |

보정 메커니즘 = [[feedback-containervariants-catalog-fallback-mechanism]] (builder `LOWERCASE_COMPONENT_RULE_CONTAINER` fallback, specs←shared 경계 준수).

## 6. Gate 상세 (본문 Gates 1:1 대응)

| Gate                               | 시점                         | 통과 조건                                                                          | kill criteria (실패 시)                                                                                                   |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| G1 토큰 환원 정합                  | slice 변환 시                | 같은 TokenRef 의 Skia(primitives) 해석값 = CSS(shared-tokens var) 해석값 시각 동일 | starter 값으로 닫아 한쪽 발산(radius starter 6 ≠ primitives 4) → 그 slice 재보정, starter→catalog 자동 generate 폐기      |
| G2 variant 구조 보존               | slice 변환 후                | 출력 variant 집합 ⊇ 현 catalog variant (premium/genai 소실 0)                      | S2 derive 만으로 채워 custom 누락 → 구조 입력 = S2+catalog 병합 재설계                                                    |
| G3 CSS↔Skia 시각 대칭              | slice 완료 시 (/cross-check) | variant×size×state 매트릭스 전 셀 색/사이즈/radius 시각 일치 (Chrome MCP)          | hover/pressed 모델 치환으로 눈에 띄게 다르면 state 파생 수동 검수 격리                                                    |
| G4 cross-component 회귀            | slice 완료 시                | slice 외 family generated CSS byte diff 0 + Skia snapshot 불변                     | 공유 토큰(`{radius.md}` 69블록·`{typography.text-sm}` 119블록) 변경이 blast radius 초과 → family 전역 회귀 검증 의무 편입 |
| G5 자동화율 floor (overclaim 차단) | 각 slice                     | '결정론 생성' 표기 필드가 manual 검수 정정 0                                       | size scale·variant 배치 등 자동 분류가 반복 정정 필요 → autoConvertible 영구 제외, scope 를 color base+스칼라 축소        |

## 7. 검증 (live behavior — CLAUDE.md §완료 기준)

각 slice 완료 시 type-check/test PASS 단독 종결 금지. 다음 live exercise 1회 필수:

- `/cross-check` 로 해당 family 의 Builder Skia ↔ Preview DOM/CSS 스크린샷 1:1 (Chrome MCP)
- 신규 등록 컴포넌트는 builder 팔레트에서 실제 추가 → 렌더 확인
- containerVariants 보정은 side 배치 토글 후 Skia flex-direction 반영 확인
