---
name: parallel-verify
description: 다수 컴포넌트/패밀리의 5-레이어(spec/factory/CSS renderer/Skia renderer/editor) 일괄 정합성 검증이 필요할 때 사용 — "병렬 검증", "전체 컴포넌트 체크", "패밀리별 검증", "parallel verify", "일괄 검증", "전체 정합성" 요청 또는 catalog/spec 대량 수정 후 다수 컴포넌트 영향 시 발동.
user_invocable: true
---

# Parallel Verify: 컴포넌트 패밀리별 병렬 검증

> **SSOT 체인 내 위상**: [ssot-hierarchy.md](../../rules/ssot-hierarchy.md) **D3(시각 스타일) 대칭 집행 수단 (패밀리 일괄)**. 각 컴포넌트에서 Builder(Skia)와 Preview(DOM+CSS)가 동일 시각 정본(catalog `COMPONENT_RULES_TABLE` / 잔존 spec)에서 시각 결과를 대칭으로 산출하는지 집단 검증.

변경된 컴포넌트를 패밀리별로 그룹화하고, 각 패밀리를 병렬 서브에이전트로 검증합니다.

## Phase 1: 변경 컴포넌트 식별 및 그룹화

`git diff --name-only`에서 변경된 컴포넌트를 아래 패밀리로 분류합니다:

| 패밀리          | 컴포넌트 (대표 — catalog 실키 기준)                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Buttons**     | Button, ToggleButton, ToggleButtonGroup, ButtonGroup, Menu, Toolbar                                                         |
| **Forms**       | TextField, TextArea, NumberField, SearchField, Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, Slider, Select, ComboBox |
| **DateTime**    | DatePicker, DateRangePicker, DateField, TimeField, Calendar, RangeCalendar                                                  |
| **Collections** | Table, TableView, ListBox, GridList, TagGroup, Tree, Tabs, Breadcrumbs, CardView                                            |
| **Layout**      | frame, Card, Group, Disclosure, DisclosureGroup, Nav, Section                                                               |
| **Display**     | Badge, Avatar, AvatarGroup, StatusLight, ProgressBar, Meter, ProgressCircle, Image, Skeleton, InlineAlert                   |
| **Overlays**    | Dialog, Modal, Popover, Tooltip, Toast                                                                                      |
| **Color**       | ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel                                 |
| **Text**        | Text, Heading, Paragraph, Code, Kbd, Link, Label                                                                            |

전체 키 목록은 `packages/shared/src/catalog/generated/componentRulesTable.ts` 의 `COMPONENT_RULES_TABLE` 참조.

## Phase 2: 병렬 에이전트 실행

변경이 있는 패밀리별로 Agent 도구를 사용하여 **병렬** 서브에이전트를 실행합니다.
모든 독립 에이전트는 **단일 메시지**에서 동시에 실행합니다.

각 에이전트에 전달할 프롬프트 템플릿:

```
[패밀리명] 컴포넌트 정합성 검증. 아래 컴포넌트들의 5-레이어(spec/factory/css/skia/editor)를 검증하세요:
컴포넌트: [컴포넌트 목록]

각 컴포넌트에 대해:
1. spec (Catalog/Spec) — catalog 등록 선판정: `packages/shared/src/catalog/generated/componentRulesTable.ts` 의
   COMPONENT_RULES_TABLE 해당 키 (defaultVariant, defaultSize, variants, sizes, containerStyles) 읽기.
   미등록(잔존 spec: Frame/Group/Slot 3개)만 `packages/specs/src/components/{Name}.spec.ts` 읽기
2. factory — Factory 파일 읽기 → 기본 props가 Catalog/Spec과 일치하는지 확인
3. css (CSS renderer) — `packages/shared/src/components/styles/{Name}.css` + `styles/generated/{Name}.css` 읽기
   → data-variant/data-size 선택자가 catalog variants/sizes와 일치하는지 확인
4. skia (Skia renderer) 경로 확인:
   - tagSpecMap.ts의 TAG_SPEC_MAP 등록 OR catalog Skia cutover (StoreRenderBridge.ts의 isCatalogCutover)
   - specTextStyle.ts의 TEXT_BEARING_SPECS 등록 여부 (텍스트 컴포넌트)
   - utils.ts의 INLINE_BLOCK_TAGS 등록 여부 (fit-content 컴포넌트)
5. editor (Preview 렌더러) — `packages/shared/src/renderers/*Renderers.tsx` 읽기
   → variant/size props가 React 컴포넌트에 전달되는지 확인

불일치 발견 시 테이블로 보고:
| 컴포넌트 | 레이어 | 이슈 | 심각도 |

코드를 수정하지 말고 보고만 하세요.
```

## Phase 3: 결과 수집 및 수정

모든 에이전트 완료 후:

1. 각 에이전트의 발견사항을 통합 테이블로 정리
2. CRITICAL/HIGH 이슈를 우선 수정
3. `pnpm build:specs && pnpm type-check`로 검증
4. 최종 결과 보고

## Evals

### Positive (발동해야 하는 경우)

- "전체 컴포넌트 정합성 체크해줘" → ✅ 전체 패밀리 병렬 검증
- "Forms 패밀리 일괄 검증" → ✅ 패밀리 단위 검증
- "Spec 대량 수정 후 전체 확인해봐" → ✅ 다수 컴포넌트 영향

### Negative (발동하면 안 되는 경우)

- "Button 하나만 확인해줘" → ❌ 단일 컴포넌트 → cross-check 사용
- "타입 에러 수정해줘" → ❌ 타입 작업, 렌더링 검증 불필요
- "TextField CSS만 수정했어" → ❌ 단일 경로 + 단일 컴포넌트 → cross-check 사용
