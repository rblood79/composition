# Color Picker 상세 설계 문서

> **목표**: Pencil 앱 수준의 컬러 피커 및 Fill/Border 시스템 구축
> **참조**: `apps/builder/src/types/builder/fill.types.ts` (UI 모델) · `apps/builder/src/builder/workspace/canvas/skia/types.ts` (Skia 모델)

## 문서 상태 요약

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **최종 검증일** | 2026-09-09                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **검증 방법**   | 코드 실측 — 저장소 파일 직접 조회 (`grep` / 파일 열람). 런타임 실행·live exercise 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **확인된 범위** | `apps/builder/src/types/builder/fill.types.ts`, `apps/builder/src/builder/panels/styles/**` (sections/components/hooks/utils/constants), `apps/builder/src/builder/workspace/canvas/skia/**` (`fills.ts`·`buildBoxNodeData.ts`·`buildSpecNodeData.ts`·`nodeRendererBorders.ts`·`blendModes.ts`·`types.ts`), `apps/builder/src/builder/stores/inspectorActions.ts`, `apps/builder/src/builder/presentation/**`, `packages/shared/src/utils/fillAdapter.ts`, `packages/specs/src/types/spec.types.ts`, `package.json` 의존성, `docs/adr/completed/{187,904,905,908}` |
| **미검증 범위** | 실제 브라우저 동작 (드래그 FPS · EyeDropper 취소 동작 · 팝오버 위치) · §9.4 성능 기준값의 실측 여부 · §10 리스크 표의 발생 확률 추정 · 부록 A 의 Pencil 원본 소스 서술 (외부 앱)                                                                                                                                                                                                                                                                                                                                                                                   |

> 아래 본문에서 **경로:라인** 표기는 2026-09-09 시점 저장소 기준이다. 라인 번호는 이후 커밋으로 이동할 수 있으므로 심볼 이름을 함께 읽는다.

---

## 0. 구현 현황 (Implementation Status)

> 최종 검증: 2026-09-09 (코드 실측)

### 0.1 한눈에 보기

| 축                                        | 상태                   | 근거                                                                                                      |
| ----------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Fill 데이터 모델 (6종 FillItem)           | **구현**               | `apps/builder/src/types/builder/fill.types.ts:112-118`                                                    |
| 다중 Fill UI (추가/삭제/토글/드래그 정렬) | **구현**               | `apps/builder/src/builder/panels/styles/sections/FillSection.tsx:61-95`, `:139-159`                       |
| 색상 모드 전환 (RGBA/HEX/CSS/HSL/HSB)     | **구현**               | `apps/builder/src/types/builder/fill.types.ts:144`, `panels/styles/components/ColorInputModeSelector.tsx` |
| 그래디언트 에디터 (Linear/Radial/Angular) | **구현**               | `panels/styles/components/GradientEditor.tsx` 외 3종                                                      |
| EyeDropper                                | **구현**               | `panels/styles/components/EyeDropperButton.tsx:32`, 사용처 `ColorPickerPanel.tsx:158`                     |
| ScrubInput (pointer lock 드래그 숫자)     | **구현**               | `panels/styles/components/ScrubInput.tsx:192-194`, `:232-234`                                             |
| 이미지 Fill (URL / 파일 드롭 / 3모드)     | **구현**               | `panels/styles/components/ImageFillEditor.tsx:28-34`, `:83-115`, `:176-191`                               |
| 메쉬 그래디언트 (N×M 색상 그리드)         | **부분 구현**          | 편집 UI `MeshGradientEditor.tsx:66-78`, `:172-190` / 렌더는 2×2 근사 `skia/fills.ts:207-251`              |
| Blend Mode **선택 UI**                    | **구현**               | `panels/styles/components/FillDetailPopover.tsx:204-211` (`PropertySelect` + `BLEND_MODE_OPTIONS`)        |
| Blend Mode **Skia 반영**                  | **미배선 (결함 의심)** | `fill.blendMode` 소비처가 팝오버 2곳뿐 — §5.3 참조                                                        |
| 색상 변수 바인딩 (`$--` 선택 UI)          | **미구현**             | 읽기 가드만 존재 — `colorUtils.ts:73`, `fillMigration.ts:45`, `FillDetailPopover.tsx:104-107`             |
| 다중 Fill **레이어 합성 렌더**            | **미구현**             | 최상단 enabled fill 1개만 그림 — `utils/fillToSkia.ts:508`, `:535`, `:592`                                |
| Gradient 셰이더 캐싱                      | **미구현**             | 저장소 전체에 `shaderCache` 식별자 0건                                                                    |

### 0.2 구현된 파일 목록 (2026-09-09 실측)

```
apps/builder/src/types/builder/
├── fill.types.ts                    ← 6종 FillItem + BlendMode + BorderConfig + createDefaultFill()
└── unified.types.ts                 ← Element.fills?(:106) / Element.border?(:108)

apps/builder/src/builder/panels/styles/
├── sections/
│   ├── FillSection.tsx / .css       ← FillSectionInline(:169) · FillBackgroundInline(:216) · FillSection(:545)
│   └── AppearanceSection.tsx        ← FillBackgroundInline 을 lazy mount (:61-63, :203)
├── components/
│   ├── FillLayerRow.tsx / .css      ← 개별 Fill 레이어 행 + 팝오버 폭 규칙(.css:194-198)
│   ├── FillDetailPopover.tsx / .css ← Fill 상세 편집 Popover (타입별 에디터 + opacity + Blend)
│   ├── FillTypeSelector.tsx         ← [Color][Gradient][Image] 3탭 (**전용 .css 없음**)
│   ├── ColorPickerPanel.tsx / .css  ← HSB ColorArea + Sliders + Inputs + EyeDropper
│   ├── ColorInputModeSelector.tsx / .css
│   ├── ColorInputFields.tsx / .css
│   ├── GradientEditor.tsx / .css
│   ├── GradientBar.tsx / .css
│   ├── GradientStopList.tsx / .css
│   ├── GradientControls.tsx / .css
│   ├── ScrubInput.tsx / .css        ← pointer lock 기반 드래그 숫자 조정
│   ├── EyeDropperButton.tsx / .css
│   ├── ImageFillEditor.tsx / .css   ← URL 입력 + 파일 드롭 + stretch/fill/fit
│   └── MeshGradientEditor.tsx / .css ← rows/columns 2~6 + 포인트 색상 편집
├── constants/
│   └── styleOptions.ts              ← BLEND_MODE_OPTIONS (:43)
├── hooks/
│   ├── useFillActions.ts            ← FillActions 14종 (:41-79)
│   └── useFillValues.ts             ← fills 읽기 + UI 전용 상태 (:47-79)
└── utils/
    ├── fillToSkia.ts                ← FillItem → Skia FillStyle 변환
    ├── fillMigration.ts             ← backgroundColor ↔ fills read-through + CSS 출력
    ├── colorUtils.ts                ← hex8/rgba/hsl/hsb/css/float32 변환 14종
    ├── fillCssIngressParser.ts      ← CSS background 문자열 → FillItem[] (:163)
    ├── fillDerivedStyleProps.ts     ← 파생 background prop 식별 + patch sanitize (:1, :7, :11)
    ├── fillExternalIngress.ts       ← 외부/legacy 요소 payload → canonical fills 승격 (:29, :74)
    ├── fillPresentation.ts          ← 가상 fill · swatch 스타일 · 표시 라벨 (:8~:40)
    └── specPresetResolver.ts        ← catalog 기반 패널 프리셋 조회

apps/builder/src/builder/workspace/canvas/skia/
├── buildBoxNodeData.ts              ← element.fills → SkiaNodeData.box (:156-189, :307-320)
├── buildSpecNodeData.ts             ← catalog(spec) 경로의 동일 변환 (:1927 부근)
├── fills.ts                         ← applyFill(): 6종 FillStyle → CanvasKit Shader (:70-252)
├── nodeRendererBorders.ts           ← renderBox() 가 applyFill 호출 (:491)
├── blendModes.ts                    ← CSS blend mode → CanvasKit BlendMode 18+종 (:33-60)
└── types.ts                         ← FillStyle union 6종 (:105-111)

apps/builder/src/builder/stores/
└── inspectorActions.ts              ← updateSelectedFills (선언 :590-591, 구현 :1350, payload :485-486)

apps/builder/src/builder/presentation/
├── editorPresentationFillPilot.ts   ← ADR-187 드래그 preview 트랜잭션 (fills 전용 pilot)
└── editorPresentationPhase6.static.test.ts ← legacy preview write 금지 가드 (:20-36)

packages/shared/src/utils/
└── fillAdapter.ts                   ← fills → CSS background 파생 (Preview/Publish 공용, :107/:211/:263)
```

**문서 옛 서술 대비 없어진 것** (모두 2026-09-09 확인):

| 옛 문서 표기                                                      | 현재 사실                                                                                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `BlendModeSelector.tsx / .css`                                    | **파일 없음.** blend mode UI 는 `FillDetailPopover.tsx:204-211` 의 `PropertySelect` + `constants/styleOptions.ts:43` `BLEND_MODE_OPTIONS`    |
| `VariableBindingButton.tsx / .css`                                | **파일 없음.** `apps/builder/src` 전체에 식별자 0건                                                                                          |
| `FillTypeSelector.css`                                            | **파일 없음** (`.tsx` 만 존재, 클래스는 공용 `properties-aria` 어법 사용)                                                                    |
| `workspace/canvas/sprites/BoxSprite.tsx`                          | **디렉터리째 없음.** 후신은 `skia/buildBoxNodeData.ts` (파일 헤더 :1-6 이 "BoxSprite SkiaNodeData 빌드 로직 추출 (ADR-100 Phase 6)" 로 명시) |
| `workspace/canvas/ui/PixiColorPicker.tsx`                         | **디렉터리째 없음** (`workspace/canvas/ui/` 부재)                                                                                            |
| `apps/builder/src/utils/featureFlags.ts` 의 Fill always-on helper | **없음.** 현재 export 는 `isWebGLCanvas`(:40) / `enableDebugLogs`(:49) / `isCanvasCompareMode`(:67) 3개뿐                                    |
| `inspectorActions.updateSelectedFillsPreview()`                   | **제거됨.** `presentation/editorPresentationPhase6.static.test.ts:26-30` 이 이 식별자의 재등장을 실패로 만든다                               |

### 0.3 설계 vs 구현 차이점 (2026-09-09 재확인)

| 설계 문서                                             | 실제 구현                                                                                                             | 근거                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Jotai atom 기반 상태 관리 (`fillAtoms.ts`)            | Zustand `element.fills` + canonical 문서 직접 사용. **Jotai 는 의존성 자체가 없다** (`pnpm-lock.yaml` 에 `jotai` 0건) | `hooks/useFillValues.ts:47-79`                                                 |
| `@dnd-kit/sortable` 미설치                            | **설치됨** (`package.json:70-72`) 이며 `FillSection` 이 실사용                                                        | `sections/FillSection.tsx:12-25`, `:61-95`                                     |
| `FillTypeSelector` 5버튼                              | 3탭 `[Color][Gradient][Image]` + 그래디언트 내부 하위 타입                                                            | `components/FillTypeSelector.tsx:53-73`                                        |
| UI명 "Fill"                                           | UI명 "Background" — 단, **독립 섹션이 아니라 Appearance 섹션 내부 인라인 블록**                                       | `sections/AppearanceSection.tsx:203`, `sections/FillSection.tsx:456`           |
| Gradient 셰이더 캐싱 (`shaderCache`)                  | 미구현 (식별자 0건)                                                                                                   | —                                                                              |
| ScrubInput 미구현                                     | **구현 완료**, 5개 컴포넌트가 사용                                                                                    | `components/ScrubInput.tsx:36`, `:192-194`, `:232-234`                         |
| `BorderConfig.style: BorderStyle`                     | `style: BorderStyleValue`                                                                                             | `types/builder/fill.types.ts:154`, `:164`                                      |
| Popover 고정 너비 244px                               | `width: var(--trigger-width); min-width: 180px` 로 대체. 저장소에 `244px` 리터럴은 **주석 한 줄** 뿐                  | `components/FillLayerRow.css:185-198`                                          |
| 드래그 preview = store `updateSelectedFillsPreview()` | ADR-187 presentation 트랜잭션 (`editorPresentationFillPilot`) 으로 이관                                               | `hooks/useFillActions.ts:41-79`, `presentation/editorPresentationFillPilot.ts` |

### 0.4 Fill 섹션의 실제 마운트 경로 (중요)

문서 옛 서술은 "AppearanceSection 을 FillSection('Background') 으로 교체" 였으나, 현재 구조는 다르다.

- `sections/index.ts` 는 `TransformSection` / `LayoutSection` / `AppearanceSection` / `TypographySection` / `ModifiedStylesSection` / `ResponsiveSection` **6개만** export 한다 — `FillSection` 은 barrel 에 없다.
- `StylesPanel.tsx:87` 은 `AppearanceSection` 을 렌더한다.
- `AppearanceSection.tsx:61-63` 이 `lazy(() => import("./FillSection").then(m => m.FillBackgroundInline))` 로 **`FillBackgroundInline` 하나만** 가져와 `:203` 에서 `<Suspense>` 로 렌더한다.
- 즉 `FillSection.tsx` 가 export 하는 3개 중 `FillSection`(:545, `PropertySection id="background"`) 과 `FillSectionInline`(:169) 은 **현재 어디에서도 마운트되지 않는 dead export** 다 (사용처 grep 0건).
- `AppearanceSection` 자신은 `backgroundColor` 를 직접 편집하지 않는다. 이 섹션의 `PropertyColor`(:208 부근) 는 border color 축이다.

### 0.5 ADR 관계 — 이 문서의 `fills` 와 catalog `fill` 은 다른 축이다

두 개의 서로 다른 "fill" 이 저장소에 공존하므로 혼동하지 않는다.

| 축                                | 정의 위치                                                    | 의미                                                                                                                                              | 소비자                                                                                                                            |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Element fill 레이어** (이 문서) | `apps/builder/src/types/builder/fill.types.ts` `FillItem`    | 사용자가 요소마다 직접 칠하는 배경 레이어. canonical 노드의 `fills?` 필드 (`packages/shared/src/types/composition-document.types.ts:821`) 가 SSOT | Skia (`buildBoxNodeData` / `buildSpecNodeData`) · Preview/Publish (`fillAdapter`)                                                 |
| **Catalog fill preset** (ADR-908) | `packages/specs/src/types/spec.types.ts:867` `FillTokenSpec` | 컴포넌트 **variant** 의 배경/상태 토큰 preset (`default` / `outline` / `subtle` / `quiet` / `alpha`). `fillStyle` prop 축                         | CSSGenerator · buildCatalogShapes · variantColors · stateEffect (`packages/specs/src/utils/fillTokens.ts:26` `resolveFillTokens`) |

ADR-908 (`docs/adr/completed/908-fill-spec-schema-ssot.md`) 이 통합한 것은 **후자** 다 — `VariantSpec` 의 개별 `background*` 필드를 `FillTokenSpec` 하나로 모은 작업이며, 이 문서의 `FillItem[]` 모델은 ADR-908 의 영향을 받지 않는다. 두 축은 서로 다른 파일·다른 패키지에 있고 타입 공유도 없다.

관련 ADR 3건이 이 문서의 서술을 실제로 바꿨다:

- **[ADR-904](../../adr/completed/904-fill-ssot-preview-publish-adapter.md)** (Implemented 2026-04-24) — `fills` 를 D3 SSOT 로 승격. CSS `background*` 는 `packages/shared/src/utils/fillAdapter.ts` 가 런타임에 파생. Fill V2 feature flag retirement 포함.
- **[ADR-905](../../adr/completed/905-fill-noncanonical-background-payload-policy.md)** — 비정형 `backgroundImage` / data URL 정책.
- **[ADR-187](../../adr/completed/187-editor-presentation-transaction-and-typed-invalidation.md)** (Implemented 2026-08-24) — 색상 드래그 preview 를 canonical 문서 변경이 아니라 presentation 트랜잭션으로 표현. store 의 `updateSelectedFillsPreview` 를 제거하고 `useFillActions` 에 `preview*Presentation` / `commit*Presentation` 계열을 도입.

---

## 0.9 문서 검토 이력

### 4차 검토 (2026-09-09) — 코드 실측 전수 대조

문서가 언급하는 심볼·파일·타입을 저장소에서 전수 확인하고 어긋난 서술을 교체했다. 주요 정정:

1. **삭제된 파일 5종 반영** — `BlendModeSelector.tsx` / `VariableBindingButton.tsx` / `FillTypeSelector.css` / `sprites/BoxSprite.tsx` / `canvas/ui/PixiColorPicker.tsx` 가 모두 없다 (§0.2 표).
2. **Skia 진입점 정정** — `BoxSprite.tsx` → `skia/buildBoxNodeData.ts`(:156-189, :307-320) + catalog 경로 `skia/buildSpecNodeData.ts`(:1927 부근).
3. **fill-level `blendMode` 미배선 확인** — 문서는 "Skia 렌더러 전달" 로 적혀 있었으나 소비처가 `FillDetailPopover.tsx:146`·`:208` 뿐이다 (§5.3).
4. **ScrubInput 구현 완료 반영** — 문서 §5.2 가 "미구현" 이었으나 `components/ScrubInput.tsx` 가 실재하고 5개 컴포넌트가 사용한다.
5. **`@dnd-kit` 설치 상태 정정** — "미설치" → `package.json:70-72` 설치 + `FillSection` 실사용.
6. **Phase 4 상태 정정** — 이미지 Fill·메쉬 그래디언트 UI 는 구현, 변수 바인딩 UI 는 미구현 (읽기 가드만).
7. **Fill 섹션 마운트 경로 정정** — 독립 "Background" 섹션이 아니라 `AppearanceSection` 내부 인라인 (`FillBackgroundInline`). `FillSection` / `FillSectionInline` 은 dead export (§0.4).
8. **드래그 preview 경로 정정** — `updateSelectedFillsPreview()` 제거, ADR-187 presentation 트랜잭션으로 이관.
9. **Feature flag 서술 정정** — `featureFlags.ts` 에 Fill 관련 helper 가 없다.
10. **ADR-908 축 구분 추가** — catalog `FillTokenSpec` 은 이 문서의 `FillItem` 과 별개 축임을 §0.5 로 명시.
11. **테스트 현황 정정** — §12 의 "미작성" 항목 중 다수가 실제로는 존재한다.
12. **부록 B ADR 제목/상태 정정** — ADR-002·ADR-003 의 실제 제목과 Superseded 상태 반영.

### 3차 검토 (2026-02-11) — 미검증 (2026-09-09 기준 당시 기록 그대로 보존)

코드베이스 전수 대조를 통해 문서-코드 불일치 7건을 수정했다.

1. **Section 9.2**: Jotai `selectAtom` 예시 → Zustand 직접 접근 패턴으로 교체 (실제 구현에 부합)
2. **Section 9.3**: "Gradient 셰이더 캐싱" 미구현 상태 명시 (성능 이슈 미발생으로 보류)
3. **Section 3.1.2**: `BorderStyle` → `BorderStyleValue` 타입명 반영 (CSS 기본 타입 충돌 방지)
4. **Section 11.1**: `packages/shared/components/` → `packages/shared/src/components/` 경로 수정
5. **Section 1.1**: `PixiColorSwatchPicker.tsx` 삭제 상태 반영
6. **`unified.types.ts`**: `Element.border?: BorderConfig` 필드 추가 (설계문서 Phase 1 범위, UI 미연결)
7. **설계 vs 구현 차이점 테이블**: `BorderStyleValue` 네이밍 차이 항목 추가

### 2차 검토 (2026-02-10) — 미검증 (2026-09-09 기준 당시 기록 그대로 보존)

코드베이스 대조 검증을 통해 다음을 보완했다.

1. **액션 이름 정합성 수정**
   - `useBuilderActions()` / `pushHistory` → 실제 코드의 `useStyleActions()` / `historyManager.addEntry()` 로 정정.
2. **`@dnd-kit/sortable` 의존성 상태 정정**
   - "이미 프로젝트 의존성에 있을 것" → 당시 미설치 상태. (2026-09-09 현재는 설치 완료 — `package.json:70-72`)
3. **기존 활용 가능 자산 섹션 추가 (Section 11)**
   - `apps/builder/src/builder/workspace/canvas/skia/fills.ts` (`applyFill()`), `apps/builder/src/builder/workspace/canvas/skia/blendModes.ts`, `useOptimizedStyleActions` 등 재사용 대상 명시.
4. **리스크 분석 추가 (Section 10)**
   - 7개 기술 리스크 (R1~R7), Phase 간 의존성 리스크, Feature Flag 구현 방안 포함.
5. **성능 기준값 추가 (Section 9.4)**
   - Fill 렌더링, 드래그 FPS, 마이그레이션 성능 등 정량 기준 명시.
6. **Phase 착수 조건 추가**
   - 문서 상단에 각 Phase별 착수 전제 조건 명시.

### 1차 검토 (2026-02) — 미검증 (2026-09-09 기준 당시 기록 그대로 보존)

기존 초안은 방향성이 명확하고, Pencil 기능을 단계별로 잘 쪼갠 점이 강점이다. 다만 당시 저장소 구조/상태관리 패턴과 일부 경로·명령어가 어긋난 부분이 있어 아래를 반영해 보완했다.

1. **경로 정합성 보정**
   - 축약 경로 표기를 리포지토리 루트 기준 경로로 통일. (당시 계획했던 `atoms/fillAtoms.ts` 는 결국 만들어지지 않았다 — Zustand 직접 사용)
2. **상태관리 흐름 정렬**
   - 당시 문서는 Zustand + Jotai 브릿지(`selectedElementAtom`/`appearanceValuesAtom`) 를 전제했다. **2026-09-09 현재 Jotai 는 의존성에 없다** (`pnpm-lock.yaml` 0건) — 이 서술은 폐기된 전제다.
3. **명령어 표준화**
   - 루트 스크립트 기준 `pnpm type-check`로 수정.
4. **릴리즈 안전장치 추가**
   - Feature Flag/마이그레이션 게이트/롤백 체크리스트를 명시해 점진 배포 가능하도록 보강. (해당 flag 는 이후 retirement 완료 — §10.2)

### 유지한 설계 원칙

- Fill/Border를 단일 문자열에서 **레이어 모델**로 승격
- 드래그 중 로컬 업데이트, 확정 시 history/db 반영
- Skia 변환 레이어를 별도로 두고 렌더 파이프라인 순서를 유지

---

## 1. 현재 상태 분석

### 1.1 컬러 관련 공용 컴포넌트 (2026-09-09 실측)

```
packages/shared/src/components/          ← 7개 전부 실재
├── ColorPicker.tsx        ← React Aria 래퍼 (HSB Area + Hue Slider + Hex Field)
├── ColorArea.tsx          ← 2D 채도/밝기 선택
├── ColorSlider.tsx        ← Hue/Alpha 슬라이더
├── ColorField.tsx         ← Hex 텍스트 입력
├── ColorSwatch.tsx        ← 색상 미리보기 (FillLayerRow.tsx:18 · FillSection.tsx:27 이 사용)
├── ColorSwatchPicker.tsx  ← 팔레트 그리드
└── ColorWheel.tsx         ← 원형 Hue 선택

apps/builder/src/builder/
├── components/property/
│   ├── PropertyColor.tsx          ← 단색 편집 (TypographySection · AppearanceSection · ModifiedStylesSection · BoxShadowEditor 가 사용)
│   └── PropertyColorPicker.tsx    ← TailSwatch 기반 팔레트 (`@composition/specs` TAILWIND_PALETTE, :7)
└── panels/styles/sections/
    └── AppearanceSection.tsx      ← borderColor(단색 string) + FillBackgroundInline lazy mount(:61-63, :203)
```

> **삭제됨 (2026-09-09 확인)**: `workspace/canvas/ui/PixiColorPicker.tsx` · `PixiColorSwatchPicker.tsx` — `workspace/canvas/ui/` 디렉터리 자체가 없다. `apps/builder/src` 전체에 `Pixi` 파일 0건 (ADR-003 이 Superseded 되며 PixiJS 경로가 걷혔다).

### 1.2 Skia 측 Fill 타입 (`skia/types.ts`)

`apps/builder/src/builder/workspace/canvas/skia/types.ts:105-111` — 6종 union 이며 `fill.types.ts:112-118` 의 `FillItem` 6종과 1:1 대응한다.

```typescript
export type FillStyle =
  | ColorFill // :35  { type:"color", rgba:[r,g,b,a] }  (0~1 범위)
  | LinearGradientFill // :40  start, end, colors, positions, repeating?, interpolation?
  | RadialGradientFill // :51  center, startRadius, endRadius, colors, positions, repeating?, matrix?, interpolation?
  | AngularGradientFill // :65  cx, cy, colors, positions, rotationMatrix?, repeating?, interpolation?
  | ImageFill // :78  image, tileModeX, tileModeY, tileMode?(deprecated), sampling, matrix?
  | MeshGradientFill; // :91  rows, columns, colors, width, height
```

옛 문서의 `tileMode` 단일 필드 서술은 낡았다 — 현재는 축별 `tileModeX` / `tileModeY` 가 정본이고 `tileMode` 는 `@deprecated` 하위 호환 필드다 (`:85-86`). 그래디언트 3종에는 설계 당시 없던 `interpolation?: "srgb" | "oklab"` 축이 추가돼 있다.

### 1.3 기능 대조 (2026-09-09 현재 vs Pencil)

| 기능                 | 도입 이전        | 현재 (2026-09-09 실측)                                                                                                                    | Pencil                    |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Fill 타입            | 단색 1개         | **6종 전부** (Color + 3×Gradient + Image + Mesh) — `fill.types.ts:112-118`, `FillTypeSelector.tsx:53-73`                                  | 6종                       |
| Fill 레이어 (데이터) | 1개              | **다중** (배열, on/off, dnd 순서 변경) — `FillSection.tsx:61-95`                                                                          | 다중                      |
| Fill 레이어 (렌더)   | 1개              | **최상단 enabled 1개만 그림** — `fillToSkia.ts:508`·`:535`·`:592`, `nodeRendererBorders.ts:485-515`                                       | 레이어 합성               |
| Border 레이어        | 1개 (CSS border) | 1개 (CSS border). `BorderConfig` 타입은 있으나 UI 미연결 — `fill.types.ts:151-156`                                                        | 다중 (배열, 개별 너비)    |
| 색상 입력 모드       | Hex only         | **RGBA / HEX / CSS / HSL / HSB** — `fill.types.ts:144`, `ColorInputModeSelector.tsx`                                                      | 동일 5종                  |
| EyeDropper           | 없음             | **구현** (Chrome/Edge) — `EyeDropperButton.tsx:32`, `ColorPickerPanel.tsx:158`                                                            | 화면 색상 추출            |
| Scrub Input          | 없음             | **구현** — `ScrubInput.tsx:192-194`, 5개 컴포넌트 사용                                                                                    | 드래그로 숫자 값 조정     |
| Fill별 Blend Mode    | 없음             | **선택 UI 12종만** (`FillDetailPopover.tsx:204-211`). **Skia 반영 없음** — §5.3                                                           | 18+종, 렌더 반영          |
| Fill별 Opacity       | 없음             | **독립 조절** (0~100%, ScrubInput) — `FillDetailPopover.tsx:192-201`                                                                      | 독립 조절                 |
| 그래디언트 에디터    | 없음             | **스톱 추가/삭제/드래그, 회전, 중심점**                                                                                                   | 동일                      |
| 이미지 Fill          | 없음             | **URL + 파일 드롭 + stretch/fill/fit** — `ImageFillEditor.tsx:28-34`, `:83-115`                                                           | 동일 + 더 많은 모드       |
| 메쉬 그래디언트      | 없음             | **2~~6×2~~6 색상 그리드 편집** (`MeshGradientEditor.tsx:172-190`), **렌더는 2×2 근사** (`skia/fills.ts:207-251`), **베지어 핸들 UI 없음** | N×M + 베지어 핸들         |
| 변수 바인딩 UI       | 없음             | **미구현** — `$--` 는 읽기 가드로만 존재 (`colorUtils.ts:73`, `fillMigration.ts:45`, `FillDetailPopover.tsx:104-107`)                     | `$--변수명` 선택 드롭다운 |

---

## 2. 목표 상태 (TO-BE)

### 2.1 Phase 구분

| Phase       | 범위                                             | 우선순위 | 상태 (2026-09-09 실측)                                                                 |
| ----------- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| **Phase 1** | Fill 데이터 모델 + 다중 Fill UI + 색상 모드 전환 | P0       | **완료**                                                                               |
| **Phase 2** | 그래디언트 에디터 (Linear/Radial/Angular)        | P0       | **완료**                                                                               |
| **Phase 3** | EyeDropper + BlendMode + ScrubInput              | P1       | **UI 완료** — BlendMode 의 Skia 반영만 미배선 (§5.3)                                   |
| **Phase 4** | 이미지 Fill + 메쉬 그래디언트 + 변수 바인딩      | P2       | **부분 완료** — 이미지 Fill 완료 · 메쉬는 UI 만(렌더 2×2 근사) · 변수 바인딩 UI 미구현 |

---

## 3. Phase 1: Fill 데이터 모델 + 다중 Fill UI — **완료**

### 3.1 데이터 모델

#### 3.1.1 Fill 아이템 타입

**2026-09-09 실측 결과 이 절의 타입 정의는 코드와 정확히 일치한다.** 근거 라인: `FillType` enum `:19-26` · `GradientStop` `:33-36` · `BaseFillItem` `:43-48` · `ColorFillItem` `:55-58` · `LinearGradientFillItem` `:61-65` · `RadialGradientFillItem` `:68-73` · `AngularGradientFillItem` `:76-81` · `ImageFillItem` `:84-88` · `MeshGradientFillItem` `:91-96` · `MeshPoint` `:98-105` · `FillItem` union `:112-118` · `BlendMode` 12종 `:125-137` · `ColorInputMode` `:144`.

문서에 없던 것 하나: 같은 파일이 팩토리 함수 2개를 함께 export 한다 — `createDefaultColorFill(color = '#000000FF')` (`:176`) 과 `createDefaultFill(type = FillType.Color)` (`:188-259`). 후자는 6종 전부의 기본값을 만든다 (mesh 기본값은 2×2 4색, `:243-258`).

```typescript
// apps/builder/src/types/builder/fill.types.ts (구현 완료 — 전문 일치)

/** Fill 타입 열거형 (Pencil Rt 열거형 대응) */
export enum FillType {
  Color = "color",
  Image = "image",
  LinearGradient = "linear-gradient",
  RadialGradient = "radial-gradient",
  AngularGradient = "angular-gradient",
  MeshGradient = "mesh-gradient",
}

/** 그래디언트 색상 스톱 */
export interface GradientStop {
  color: string; // "#RRGGBBAA"
  position: number; // 0.0 ~ 1.0
}

/** 기본 Fill 아이템 (모든 타입 공통) */
export interface BaseFillItem {
  id: string; // nanoid()
  enabled: boolean; // on/off 토글
  opacity: number; // 0.0 ~ 1.0 (Fill 레벨 불투명도)
  blendMode: BlendMode;
}

/** 단색 Fill */
export interface ColorFillItem extends BaseFillItem {
  type: FillType.Color;
  color: string; // "#RRGGBBAA"
}

/** 선형 그래디언트 Fill */
export interface LinearGradientFillItem extends BaseFillItem {
  type: FillType.LinearGradient;
  stops: GradientStop[];
  rotation: number; // 0 ~ 360 degrees
}

/** 방사형 그래디언트 Fill */
export interface RadialGradientFillItem extends BaseFillItem {
  type: FillType.RadialGradient;
  stops: GradientStop[];
  center: { x: number; y: number }; // 0.0 ~ 1.0 (비율)
  radius: { width: number; height: number };
}

/** 각도형 그래디언트 Fill */
export interface AngularGradientFillItem extends BaseFillItem {
  type: FillType.AngularGradient;
  stops: GradientStop[];
  center: { x: number; y: number };
  rotation: number;
}

/** 이미지 Fill (Phase 4) */
export interface ImageFillItem extends BaseFillItem {
  type: FillType.Image;
  url: string;
  mode: "stretch" | "fill" | "fit";
}

/** 메쉬 그래디언트 Fill (Phase 4) */
export interface MeshGradientFillItem extends BaseFillItem {
  type: FillType.MeshGradient;
  rows: number;
  columns: number;
  points: MeshPoint[];
}

export interface MeshPoint {
  position: [number, number];
  color: string;
  leftHandle?: [number, number];
  rightHandle?: [number, number];
  topHandle?: [number, number];
  bottomHandle?: [number, number];
}

/** Fill 아이템 유니온 타입 */
export type FillItem =
  | ColorFillItem
  | LinearGradientFillItem
  | RadialGradientFillItem
  | AngularGradientFillItem
  | ImageFillItem
  | MeshGradientFillItem;

/** 블렌드 모드 (CanvasKit 대응) */
export type BlendMode =
  | "normal" // SrcOver
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

/** 색상 입력 모드 */
export type ColorInputMode = "rgba" | "hex" | "css" | "hsl" | "hsb";
```

#### 3.1.2 Border 아이템 타입

> **구현 상태 (2026-09-09)**: 타입은 `fill.types.ts:151-169` 에 실재하고 `Element.border?` (`unified.types.ts:108`) 로 연결돼 있으나, **이 값을 읽는 UI·렌더 코드는 없다.** 소비처는 직렬화 pass-through 2곳뿐이다 (`adapters/canonical/legacyElementSanitizer.ts:46`·`:103`).
>
> **이름 충돌 주의**: `workspace/canvas/utils/borderUtils.ts:33` 에 **동명의 다른 `BorderConfig`** 가 있다. 그쪽은 CSS `border*` 문자열을 파싱한 Skia 테두리 렌더용 구조체(`parseBorderConfig`, `:85`)이며 이 문서의 `BorderConfig` 와 무관하다.
>
> **웹 빌더 컨텍스트**: Pencil의 Stroke 개념을 CSS border로 매핑.
> CSS는 이미 개별 변 borderWidth, borderStyle, borderColor를 지원하므로 이를 활용.

```typescript
/** Border 설정 (CSS border 기반) */
export interface BorderConfig {
  fills: FillItem[]; // 다중 보더 색상 (Phase 1: 단색 1개)
  width: BorderWidth; // CSS borderWidth (통합 또는 개별)
  style: BorderStyleValue; // CSS borderStyle
  radius: BorderRadius; // CSS borderRadius (통합 또는 개별)
}

/** 보더 너비 (CSS borderWidth 매핑) */
export type BorderWidth =
  | string // 통합 (예: '1px')
  | { top: string; right: string; bottom: string; left: string }; // 개별

/** 보더 스타일 — CSS 기본 `BorderStyle` 인터페이스와의 충돌 방지를 위해 `BorderStyleValue`로 명명 */
export type BorderStyleValue =
  "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge";

/** 보더 반경 (CSS borderRadius 매핑) */
export type BorderRadius =
  | string // 통합 (예: '8px')
  | {
      topLeft: string;
      topRight: string;
      bottomRight: string;
      bottomLeft: string;
    }; // 개별
```

#### 3.1.3 Element 확장 (구현 완료)

`apps/builder/src/types/builder/unified.types.ts:106` / `:108` 에 실재한다 (import 타입 표기로 선언).

```typescript
export interface Element {
  // ... 기존 속성 ...

  /** 다중 Fill 레이어 — unified.types.ts:106 */
  fills?: import("./fill.types").FillItem[];

  /** Border 설정 (CSS border 기반) — unified.types.ts:108, UI 미연결 */
  border?: import("./fill.types").BorderConfig;
}
```

canonical 문서 스키마에도 같은 payload 가 있으며 그쪽이 SSOT 다 — `packages/shared/src/types/composition-document.types.ts:815-821` (주석: "`Element.fills` 와 동일 payload — canonical 이 SSOT").

### 3.2 스토어 연동

> **설계 변경**: Jotai atom 방식은 채택되지 않았다. Jotai 는 2026-09-09 기준 저장소 의존성에 없다.
> 읽기는 canonical 문서 우선 + Zustand `elementsMap` fallback, 쓰기는 커밋(store)과 preview(presentation 트랜잭션)로 갈린다.

#### 3.2.1 상태 읽기 — `useFillValues()`

`apps/builder/src/builder/panels/styles/hooks/useFillValues.ts:47-79`

- `useElementStyleContext(selectedId)` 로 선택 요소의 `fills` / `style` 을 구독 (`:48-49`).
- `resolveElementFills()` (`utils/fillMigration.ts:78`) 로 legacy `backgroundColor` 까지 흡수한 `FillItem[]` 를 만든다 (`:68`).
- 별도 로컬 Zustand 스토어 `useFillUIStore` (`:31-36`) 의 `activeFillIndex` / `colorInputMode` (UI 전용 상태) 를 함께 반환한다.

읽기 소스가 표시(`useFillValues`)와 액션(`useFillActions`)에서 갈라지지 않는지를 회귀 테스트가 잠근다 — `hooks/useFillActions.canonicalSource.test.tsx`.

#### 3.2.2 Fill 액션 — `useFillActions()`

`apps/builder/src/builder/panels/styles/hooks/useFillActions.ts` — `FillActions` 인터페이스 `:41-79`, 훅 구현 `:121`.

```typescript
export interface FillActions {
  // CRUD (커밋 경로 — updateSelectedFills → history + DB)
  addFill: (type?: FillType, initialColor?: string) => void;
  ensureColorFill: (color: string) => void; // 가상(placeholder) fill 승격
  removeFill: (fillId: string) => void;
  reorderFill: (fromIndex: number, toIndex: number) => void;
  toggleFill: (fillId: string) => void;
  updateFill: (fillId: string, updates: Partial<FillItem>) => void;
  changeFillType: (fillId: string, newType: FillType) => void;

  // ADR-187 presentation 트랜잭션 (드래그 중 preview — canonical 문서를 건드리지 않는다)
  isFirstFillPresentationOwned: (fillId, fallbackFill?) => boolean;
  isFirstFillColorPresentationOwned: (fillId, fallbackFill?) => boolean;
  previewFirstFillColorPresentation: (fillId, color, fallbackFill?) => boolean;
  commitFirstFillColorPresentation: (fillId, color, fallbackFill?) => boolean;
  previewFirstFillPaintPresentation: (fillId, updates) => boolean;
  commitFirstFillPaintPresentation: (fillId, updates) => boolean;
  cancelFirstFillColorPresentation: (reason) => boolean;
}
```

옛 문서의 `updateFillPreview()` 는 없다. 드래그 preview 는 `preview*Presentation` 계열이 `editorPresentationFillPilotRuntime` (`presentation/editorPresentationFillPilot.ts`) 으로 보낸다. store 의 `updateSelectedFillsPreview()` 는 제거됐고, 재등장을 `presentation/editorPresentationPhase6.static.test.ts:26-30` 이 실패로 만든다.

**커밋 경로**: 위 CRUD 는 최종적으로 `stores/inspectorActions.ts` 의 `updateSelectedFills(fills)` (선언 `:590-591`, 구현 `:1350`) 를 호출한다. 이 액션은 `sanitizeFillDerivedStylePatch()` (`utils/fillDerivedStyleProps.ts:11`) 로 파생 background 필드를 style patch 에서 걷어낸 뒤 `updateAndSave()` 로 넘기며, DB payload 에는 `fills` 를 1차 필드로 싣는다 (`:485-486`).

**presentation 이 못 받는 fill**: 첫 번째 fill 의 color / paint 축만 presentation 트랜잭션 대상이다. 그 밖(추가 레이어·미지원 타입)은 commit-only 로 남는 것이 의도된 계약이며, `presentation/editorPresentationPhase6.static.test.ts:38-48` 이 `FillSection.tsx` 안의 해당 주석 3줄 존재를 검사한다.

### 3.3 Fill 섹션 UI

#### 3.3.1 컴포넌트 트리 (2026-09-09 실측)

```
AppearanceSection ("Appearance" 섹션)          ← StylesPanel.tsx:87 이 렌더하는 유일한 진입점
└── <Suspense> LazyFillBackgroundInline        ← AppearanceSection.tsx:61-63, :203
    └── FillBackgroundInline                   ← FillSection.tsx:216
        ├── fieldset.properties-aria > legend "Background"   ← FillSection.tsx:456
        ├── 대표 swatch 버튼 (ColorSwatch) + DialogTrigger    ← FillSection.tsx:462
        ├── SwatchIconButton ("+" 추가)                       ← FillSection.tsx:499-508
        ├── DndContext > SortableContext (추가 레이어 정렬)   ← FillSection.tsx:514-534
        │   └── SortableFillRow > FillLayerRow[]              ← FillSection.tsx:61-95
        │       ├── AriaCheckbox (enabled 토글)
        │       ├── DialogTrigger > ColorSwatch + Popover → FillDetailPopover
        │       ├── 라벨 (getFillDisplayLabel — fillPresentation.ts:40)
        │       ├── ScrubInput (opacity %)
        │       └── DeleteButton (ACTION_ICONS.delete)
        └── FillDetailPopover                   ← FillDetailPopover.tsx
            ├── FillTypeSelector [Color][Gradient][Image]      ← :152-155 (ToggleButtonGroup)
            ├── ColorPickerPanel (color)                        ← :157-165
            │   ├── ColorArea (HSB 2D) / HueSlider / AlphaSlider
            │   ├── EyeDropperButton                            ← ColorPickerPanel.tsx:158
            │   ├── ColorInputModeSelector (RGBA|HEX|CSS|HSL|HSB)
            │   └── ColorInputFields (모드별 동적)
            ├── GradientEditor (linear/radial/angular)          ← :167-175
            ├── MeshGradientEditor (mesh-gradient)              ← :176-183
            ├── ImageFillEditor (image)                         ← :184-189
            ├── ScrubInput (fill opacity %)                     ← :192-201
            ├── divider
            └── PropertySelect (Blend, BLEND_MODE_OPTIONS)      ← :204-211
```

> **`BlendModeSelector` 라는 컴포넌트는 없다.** blend mode 는 공용 `PropertySelect` 에 `constants/styleOptions.ts:43` 의 `BLEND_MODE_OPTIONS` 를 물려 렌더한다.
>
> **dead export**: `FillSection.tsx` 는 `FillSectionInline`(:169) 과 `FillSection`(:545) 도 export 하지만 두 개 모두 마운트되지 않는다 (§0.4).

#### 3.3.2 파일 구조

§0.2 "구현된 파일 목록" 참조. 옛 문서의 `BlendModeSelector.tsx` · `FillTypeSelector.css` 항목은 실재하지 않으며, `ImageFillEditor` · `MeshGradientEditor` · `ScrubInput` 이 추가돼 있다.

### 3.4 ColorPickerPanel 상세

Fill 상세 팝오버의 색상 편집 컴포넌트. (요소 인스펙터의 단색 편집은 여전히 `PropertyColor` 가 담당한다 — 대체가 아니라 병존)

```typescript
// apps/builder/src/builder/panels/styles/components/ColorPickerPanel.tsx:37-45

interface ColorPickerPanelProps {
  value: string; // "#RRGGBBAA" hex8
  resetKey?: string; // 이 키가 바뀔 때만 내부 상태 재초기화
  /** ADR-187 runtime 이 유일한 frame scheduler 인 migrated control */
  presentationOwnsFrameScheduling?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  onChange: (color: string) => void; // 드래그 중
  onChangeEnd: (color: string) => void; // 확정
}
```

`resetKey` / `presentationOwnsFrameScheduling` / `onPresentationCancel` 3개는 ADR-187 로 추가된 축이다. 이 컴포넌트는 자체 `requestAnimationFrame` 을 소유하지 않으며, `presentation/editorPresentationPhase6.static.test.ts:10-18` 이 그 부재를 검사한다.

**색상 모드별 입력 필드 레이아웃**:

```
┌─────────────────────────────────────┐
│  [ColorArea: 채도 × 밝기]           │  ← HSB 2D 영역
│                                     │
├─────────────────────────────────────┤
│  [Hue Slider ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬]    │  ← 0~360°
├─────────────────────────────────────┤
│  [Alpha Slider ▬▬▬▬▬▬▬▬▬▬▬▬▬▬]    │  ← 0~100%
├─────────────────────────────────────┤
│  [🔍] [RGBA ▾]  [R] [G] [B] [A]   │  ← EyeDropper + 모드 선택 + 입력
│                                     │
│  -- 또는 HEX 모드일 때 --           │
│  [🔍] [HEX  ▾]  [#FF0000FF      ]  │
│                                     │
│  -- 또는 HSL 모드일 때 --           │
│  [🔍] [HSL  ▾]  [H] [S] [L] [A]   │
│                                     │
│  -- 또는 HSB 모드일 때 --           │
│  [🔍] [HSB  ▾]  [H] [S] [B] [A]   │
│                                     │
│  -- 또는 CSS 모드일 때 --           │
│  [🔍] [CSS  ▾]  [rgb(255, 0, 0) ]  │
└─────────────────────────────────────┘
```

**성능 규칙**:

- 드래그 중: 로컬 상태 + presentation 트랜잭션 (`onChange` → `previewFirstFillColorPresentation`). canonical 문서 변경 없음
- 드래그 종료: 커밋 (`onChangeEnd` → `commitFirstFillColorPresentation` 또는 `updateSelectedFills`) → History 기록 → DB

### 3.5 FillLayerRow 상세

Pencil 프로퍼티 패널의 Fill 행 패턴.

```
┌──────────────────────────────────────────────┐
│ [☑] [■ 색상] [Color ▾] [#FF0000  ] [100%] [×] │
│ [☑] [◐ 그래디언트 바] [Linear ▾]   [80%]  [×] │
│ [☐] [🖼 썸네일] [Image ▾]          [50%]  [×] │
└──────────────────────────────────────────────┘
  ↑     ↑            ↑          ↑       ↑      ↑
  토글  미리보기   타입선택   값/hex  opacity  삭제
```

**드래그 순서 변경**: `@dnd-kit/sortable` 로 구현 완료. 의존성은 `package.json:70-72` (`@dnd-kit/core` ^6.3.1 · `@dnd-kit/sortable` ^10.0.0 · `@dnd-kit/utilities` ^3.2.2) 에 설치돼 있고, `sections/FillSection.tsx:61-95` 의 `SortableFillRow` 가 `useSortable({ id: fill.id })` 를 호출한다.

---

## 4. Phase 2: 그래디언트 에디터 — **완료**

### 4.1 GradientEditor 구조

```
GradientEditor
├── GradientTypeToggle (Linear | Radial | Angular)
├── GradientBar
│   ├── GradientPreview (배경 CSS 그래디언트 미리보기)
│   └── GradientStopHandle[] (드래그 가능한 스톱 포인트)
│       └── 클릭 → ColorPickerPanel (스톱 색상 편집)
├── GradientRotation (각도 입력, Linear/Angular만)
├── GradientCenter (X, Y 입력, Radial/Angular만)
└── GradientStopList
    ├── StopRow: [색상 swatch] [position % 입력] [삭제]
    └── [+ Add Stop] 버튼
```

### 4.2 그래디언트 바 인터랙션

```
       stop1        stop2            stop3
         ▼            ▼                ▼
┌──────[●]──────────[●]──────────────[●]──┐
│ ░░░░░░████████████████████████████████  │  ← CSS gradient 미리보기
└─────────────────────────────────────────┘
         ↕ 드래그로 position 조정
         ↕ 더블클릭으로 색상 편집
         ↕ 드래그 아웃으로 삭제
         ↕ 바 위 클릭으로 새 스톱 추가
```

**인터랙션 규칙**:

1. **스톱 드래그**: position 값 0.0~1.0 범위 내 이동
2. **스톱 추가**: 바의 빈 영역 클릭 → 해당 위치에 보간된 색상으로 추가
3. **스톱 삭제**: 스톱을 바 밖으로 드래그 아웃 (최소 2개 유지)
4. **스톱 색상 편집**: 스톱 클릭/더블클릭 → ColorPickerPanel 팝오버

### 4.3 캔버스 연동

```
FillItem (UI 모델)
  → fillToSkia.ts        (fillsToSkiaFillStyle / fillsToSkiaFillColor / fillsToSkiaFallbackColor)
  → SkiaNodeData.box     (buildBoxNodeData.ts:307-320 · catalog 경로는 buildSpecNodeData.ts:1927 부근)
  → nodeRendererBorders.ts::renderBox (:485-515)
  → skia/fills.ts::applyFill (:70-252) → CanvasKit Shader
```

| FillItem 타입             | Skia FillStyle        | CanvasKit API                          | `fills.ts` 라인 |
| ------------------------- | --------------------- | -------------------------------------- | --------------- |
| `ColorFillItem`           | `ColorFill`           | `Paint.setColor` (Color4f)             | `:76-81`        |
| `LinearGradientFillItem`  | `LinearGradientFill`  | `Shader.MakeLinearGradient()`          | `:83-107`       |
| `RadialGradientFillItem`  | `RadialGradientFill`  | `Shader.MakeTwoPointConicalGradient()` | `:109-141`      |
| `AngularGradientFillItem` | `AngularGradientFill` | `Shader.MakeSweepGradient()`           | `:143-171`      |
| `ImageFillItem`           | `ImageFill`           | `SkImage.makeShaderOptions()`          | `:173-205`      |
| `MeshGradientFillItem`    | `MeshGradientFill`    | SkSL `RuntimeEffect` (bilinear)        | `:207-251`      |

> **렌더되는 fill 은 1개다.** `fillsToSkiaFillStyle()` (`utils/fillToSkia.ts:592`) · `fillsToSkiaFillColor()` (`:508`) · `getTopEnabledFill()` (`:535`) 은 모두 배열을 뒤에서부터 순회해 **처음 만나는 enabled fill 을 반환하고 즉시 끝난다**. `renderBox()` 도 paint 하나에 단일 shader 를 세팅해 draw 를 1회만 호출한다 (`nodeRendererBorders.ts:485-515`). 아래쪽 enabled fill 은 패널에 보이지만 화면에는 합성되지 않는다 — Pencil 의 레이어 합성과 다른 지점이다.

### 4.4 변환 레이어 (`utils/fillToSkia.ts`)

**export 되는 함수 6개** (2026-09-09 실측):

```typescript
cssBgImageToSkia(url, width, height, bgSize?, bgPosition?, bgRepeat?): ImageFill | null   // :385
fillItemToFillStyle(item, width = 100, height = 100): FillStyle | null                    // :477
fillsToSkiaFillColor(fills): Float32Array | null                                          // :508  (color fill 만)
getTopEnabledFill(fills): FillItem | null                                                 // :535
fillsToSkiaFallbackColor(fills): Float32Array | null                                      // :555  (gradient 의 대표색)
fillsToSkiaFillStyle(fills, width, height): FillStyle | null                              // :592  (모든 타입)
```

**module-internal (export 되지 않음)** — 옛 문서가 public API 처럼 나열했던 함수들이다:

```
colorFillItemToSkia            :43
linearGradientFillItemToSkia   :59
radialGradientFillItemToSkia   :97
angularGradientFillItemToSkia  :140
imageFillItemToSkia            :312
meshGradientFillItemToSkia     :451
parseBgRepeat / parseBgSize / parseBgPosition   (CSS background-* 파싱 헬퍼)
```

즉 **image 와 mesh 변환도 이미 구현돼 있다** — 옛 문서의 "Color + 3종 Gradient 만" 서술은 낡았다.

### 4.5 CSS 배경 출력

빌더 패널 쪽:

```typescript
// apps/builder/src/builder/panels/styles/utils/fillMigration.ts
LEGACY_BACKGROUND_FILL_ID                  // :22
migrateBackgroundColor(backgroundColor)    // :39  legacy CSS 색 → FillItem[]
ensureFills(...)                           // :68
resolveElementFills(element)               // :78  authored fills 우선 + legacy read-through
fillsToBackgroundColor(fills)              // :89
fillsToCssBackground(fills)                // :112 { backgroundColor?, backgroundImage? }
```

Preview / Publish 쪽 (ADR-904 어댑터, 두 소비자가 같은 코드를 쓴다):

```typescript
// packages/shared/src/utils/fillAdapter.ts
fillsToCssBackgroundStyle(fills)   // :107
adaptStyleWithFills(...)           // :211
adaptElementStyle(element)         // :263
```

소비처: `apps/publish/src/renderer/ElementRenderer.tsx:54` · `apps/publish/src/hooks/useBodyElement.ts:64` · `apps/builder/src/preview/App.tsx:822`·`:1004`·`:1098` · `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:354`.

**반대 방향(ingress)** 도 구현돼 있다 — 외부/legacy payload 의 CSS background 를 canonical fills 로 끌어올린다: `utils/fillCssIngressParser.ts:163` `parseCssBackgroundToFills()`, `utils/fillExternalIngress.ts:29` `normalizeExternalFillIngress()` / `:74` batch 판.

---

## 5. Phase 3: EyeDropper + BlendMode + ScrubInput

### 5.1 EyeDropper — 구현 완료

`apps/builder/src/builder/panels/styles/components/EyeDropperButton.tsx`

```typescript
interface EyeDropperAPI {
  open(): Promise<{ sRGBHex: string }>;
} // :16-18
declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperAPI;
  }
} // :20-24

const isSupported = typeof window !== "undefined" && "EyeDropper" in window; // :26
// sRGBHex "#RRGGBB" → "#RRGGBBFF" 정규화 + toUpperCase 후 onColorPick        // :44-48
// ESC 취소는 빈 catch 로 무시                                                 // :49-53
// 미지원 브라우저는 컴포넌트가 null 반환                                       // :56
// data-picking 속성으로 진행 중 하이라이트                                     // :65
```

**브라우저 지원**: Chrome 95+, Edge 95+ (파일 헤더 `:4`). Firefox/Safari 미지원 — **미검증 (2026-09-09 기준, 코드 주석 인용이며 실제 브라우저 확인은 하지 않음)**.
**통합 위치**: `ColorPickerPanel.tsx:158` — 입력 필드 행에 배치. 아이콘은 lucide `Pipette` (`:67`).

### 5.2 ScrubInput (드래그 숫자 조정) — 구현 완료

`apps/builder/src/builder/panels/styles/components/ScrubInput.tsx` — 옛 문서의 "미구현" 서술은 낡았다.

```typescript
export interface ScrubInputProps {
  // :19-33
  value: number;
  onCommit: (value: number) => void;
  onScrub?: (value: number) => void; // 드래그 중 실시간 미리보기 (설계 당시 없던 축)
  step?: number;
  stepMultiplier?: number; // Shift 키 배수 (기본 10)
  min?: number;
  max?: number;
  suffix?: string;
  label?: string; // aria-label
  className?: string;
}
```

**인터랙션 (실측)**:

1. `DRAG_THRESHOLD = 3px` (`:36`) 를 넘으면 드래그로 판정.
2. `scrubRef.current?.requestPointerLock?.()` 시도 (`:192-194`).
3. `document.pointerLockElement` 유무로 `movementX` 누적과 `dx` 누적을 분기 (`:205-209`) — pointer lock 이 거부돼도 동작한다.
4. pointerup 에서 `document.exitPointerLock()` 후 `onCommit` (`:232-234`).

**적용 위치 (import 실측 5곳)**: `FillDetailPopover.tsx:35` (fill opacity) · `FillLayerRow.tsx:26` (레이어 opacity) · `GradientStopList.tsx` (스톱 position) · `GradientControls.tsx` (rotation/center/radius) · `MeshGradientEditor.tsx:22` (rows/columns).

### 5.3 Blend Mode — 선택 UI 만 구현, Skia 반영은 미배선 (결함 의심)

**UI**: `BlendModeSelector` 라는 컴포넌트는 없다. 공용 `PropertySelect` 에 `BLEND_MODE_OPTIONS` 를 물려 쓴다.

```typescript
// apps/builder/src/builder/panels/styles/components/FillDetailPopover.tsx:204-211
<PropertySelect
  icon={Blend}
  label="Blend"
  className="blend-mode"
  value={fill.blendMode}                 // :208
  options={BLEND_MODE_OPTIONS}           // constants/styleOptions.ts:43
  onChange={(value) => handleBlendModeChange(value as BlendMode)}
/>
// handleBlendModeChange → onUpdateEnd({ blendMode: mode })   // :144-149
```

**Skia 반영 — 없음.** `FillItem.blendMode` (`fill.types.ts:47`) 를 읽는 코드는 위 팝오버 2곳 (`FillDetailPopover.tsx:146`, `:208`) 이 전부다. `utils/fillToSkia.ts` · `skia/buildBoxNodeData.ts` · `skia/fills.ts` · `skia/renderCommands.ts` 어디에도 fill 아이템의 `blendMode` 를 읽는 경로가 없다.

노드 레벨 `blendMode` 는 fills 와 **무관한 별도 채널**에서 온다:

```
style.mixBlendMode
  → styleConversion/styleConverter.ts:1158   (blendMode: style.mixBlendMode || undefined)
  → skia/buildBoxNodeData.ts:355             (skiaEffects.blendMode → nodeData.blendMode)
  → skia/renderCommands.ts:2231-2234         (toSkiaBlendMode → paint.setBlendMode)
```

`skia/blendModes.ts:33-60` 의 매핑 자체는 18+종을 지원하지만, fill 레벨에서 그 매핑에 도달하는 경로가 없다.

> **결함 의심 (2026-09-09)**: 팝오버에서 Blend 를 바꾸면 `fills[n].blendMode` 가 저장되고 History/DB 에도 남지만 캔버스는 변하지 않는다. 옛 문서의 수용 기준 "BlendMode 선택 시 Skia 캔버스에 즉시 반영된다" 는 현재 코드로 성립하지 않는다. 수리 방향은 두 가지 — (a) 최상단 enabled fill 의 `blendMode` 를 노드 레벨로 승격, (b) fill 레이어 합성 렌더를 도입하면서 fill 별 blend 를 shader/saveLayer 로 처리. 어느 쪽이든 `style.mixBlendMode` 와의 우선순위 계약을 함께 정해야 한다.

---

## 6. Phase 4: 이미지 Fill + 메쉬 그래디언트 + 변수 바인딩 — 부분 완료

### 6.1 이미지 Fill — 구현 완료

`apps/builder/src/builder/panels/styles/components/ImageFillEditor.tsx`

- **URL 입력**: `image-fill-editor__url-input`, blur 시 `onUpdateEnd({ url })` (`:52-65`, `:176-191`).
- **파일 드롭**: `onDrop` / `onDragOver` / `onDragLeave` (`:98-115`) → `FileReader.readAsDataURL` → `onUpdateEnd({ url: dataUrl })` (`:83-96`). 숨은 `<input type="file">` 브라우즈 버튼도 있다 (`:117-129`, `:167-173`).
- **사이즈 모드**: `IMAGE_MODES` = `stretch` / `fill` / `fit` (`:28-34`), 선택 시 `onUpdateEnd({ mode })` (`:76-81`). 미리보기 `<img>` 의 `objectFit` 은 `fill` / `contain` / `cover` 로 매핑 (`:150-157`).
- **렌더**: `imageFillItemToSkia()` (`utils/fillToSkia.ts:312`) → `box.fill` (`buildBoxNodeData.ts:166-187`) → `applyFill` `"image"` case (`skia/fills.ts:173-205`, `SkImage.makeShaderOptions`).
- opacity 는 팝오버 공통 `ScrubInput` 으로 조절된다. blendMode 는 §5.3 대로 저장만 되고 렌더에 반영되지 않는다.

> `skia/nodeRendererImage.ts` 는 이 경로와 무관하다 — 그쪽은 `<img>` 요소 타입(`node.image.skImage`)을 그리는 별도 렌더러다.

### 6.2 메쉬 그래디언트 — 편집 UI 구현, 렌더는 2×2 근사

**구현된 것** (`components/MeshGradientEditor.tsx`):

- `rows` / `columns` 를 각각 `ScrubInput` 으로 조절 (`min={2} max={6}`, `:172-190`).
- 변경 시 `generateDefaultGrid(rows, columns)` 로 포인트를 재생성해 `onChangeEnd({ rows, columns, points })` 커밋 (`:66-78`, `:109-131`).
- 포인트 그리드는 `grid-template-columns/rows: repeat(N, 1fr)` 버튼으로 렌더하고, 클릭해 고른 포인트의 **색만** 하단 `ColorPickerPanel` 로 편집 (`:193-229`).
- Skia 경로 결선은 회귀 테스트로 잠겨 있다 — `skia/__tests__/buildBoxNodeData.meshFill.test.ts` 가 `box.fill.type === "mesh-gradient"` 와 rows/columns/colors/width/height 보존, fallback color 를 검사한다 (과거에 `linear|radial|angular` 만 화이트리스트해 mesh 가 누락된 회귀가 있었다).

**남은 것**:

- **베지어 핸들 편집 없음** — `MeshPoint.leftHandle` 등 타입 필드는 있으나(`fill.types.ts:98-105`) 포인트 위치 드래그·핸들 조정 UI/로직이 코드에 없다. `generateDefaultGrid` 가 `c/(columns-1), r/(rows-1)` 균등 배치로 고정 생성만 한다 (`:66-78`).
- **렌더는 여전히 2×2 근사** — `skia/fills.ts:207-251` 이 SkSL RuntimeEffect 로 4코너 bilinear 보간만 한다. 주석(`:210-211`)이 "2x2 그리드(4색)만 지원. 더 큰 그리드는 좌상 4셀로 폴백" 을 명시하고, `:212` 가 색 4개 미만이면 `null` 을 반환한다. 즉 3×3 이상을 편집해도 화면에는 좌상 4색만 반영된다.
- 옛 문서가 제안한 쌍삼차 보간 + `MakeVertices(TrianglesStrip)` 는 미착수다.

### 6.3 변수 바인딩 UI — 미구현

`VariableBindingButton` 컴포넌트는 존재하지 않는다 (`apps/builder/src` 전체 grep 0건). `$--` 는 **읽기 가드**로만 쓰인다:

| 위치                                       | 동작                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `utils/colorUtils.ts:73`                   | `normalizeToHex8()` 이 `var(` / `$--` 로 시작하면 정규화를 건너뛴다 (토큰 문자열 보존)            |
| `utils/fillMigration.ts:45`                | `migrateBackgroundColor()` 가 토큰 값이면 synthetic fill 을 만들지 않는다                         |
| `components/FillDetailPopover.tsx:104-107` | `isVariableBound` 이면 `ColorPickerPanel` 에 `#000000FF` placeholder 만 넘긴다 (깨짐 방지용 우회) |

즉 토큰 값이 들어와도 망가지지 않게 막아둔 상태이고, **변수를 고르거나 다시 묶는 사용자 인터랙션은 없다**. `designVariable` / `colorToken` 키워드도 이 디렉터리에 0건이다.

목표 UI (미착수):

```
[#FF0000] [📎] ← 클릭 → 변수 선택 팝오버
                  ├── --primary
                  ├── --secondary
                  ├── --background
                  └── ...
```

선택 시 값을 `"$--primary"` 형태로 저장, `properties.resolved`로 실시간 해석.

---

## 7. 마이그레이션 전략

### 7.1 하위 호환성 (read-through)

기존 `backgroundColor: "#FF0000"` (CSS string) → `fills` 배열로 변환한다. 저장 시점에 문서를 다시 쓰는 것이 아니라 **읽을 때 흡수**하는 read-through 방식이다 (`utils/fillMigration.ts:78` `resolveElementFills`).

```typescript
// apps/builder/src/builder/panels/styles/utils/fillMigration.ts:39-57 (실측)
export function migrateBackgroundColor(
  backgroundColor: string | undefined | null, // Element 가 아니라 CSS 문자열을 받는다
): FillItem[] {
  if (
    !backgroundColor ||
    backgroundColor === "transparent" ||
    backgroundColor === ""
  )
    return [];
  // CSS 변수/디자인 토큰 참조는 마이그레이션 불가 — 빈 배열 (§6.3 읽기 가드)
  if (backgroundColor.startsWith("var(") || backgroundColor.startsWith("$--"))
    return [];

  const hex8 = normalizeToHex8(backgroundColor); // colorUtils.ts:62
  return [{ ...createDefaultColorFill(hex8), id: LEGACY_BACKGROUND_FILL_ID }]; // id 는 nanoid 가 아니라 sentinel
}
```

`LEGACY_BACKGROUND_FILL_ID` (`:22`) 라는 고정 sentinel id 를 쓴다 — authored fill 과 legacy 파생 fill 을 구분하기 위해서다. 편집이 실제로 일어나는 순간 `ensureColorFill()` 이 이 가상 fill 을 canonical fill 로 승격한다 (`useFillActions.ts` `ensureColorFill`, 회귀 테스트 `useFillActions.presentation.test.tsx`).

### 7.2 전환 단계 (2026-09-09 실측 상태)

```
Step 1:  ✅ fill.types.ts 타입 정의
Step 2:  ✅ useFillActions.ts (Jotai 없이 Zustand + canonical 문서 직접 사용)
Step 3:  ✅ Fill UI 기본 구조 (단색 레이어)
Step 4:  ✅ ColorPickerPanel (HSB + 5모드 전환)
Step 5:  ✅ 다중 Fill 레이어 (추가/삭제/토글/dnd 순서 변경)
Step 6:  ✅ Background 편집을 AppearanceSection 내부 FillBackgroundInline 으로 통합 (독립 섹션 아님 — §0.4)
Step 7:  ✅ 기존 backgroundColor read-through (fillMigration.ts)
Step 8:  ✅ GradientEditor (Linear/Radial/Angular) + Skia 연동
Step 9:  ✅ EyeDropper + ScrubInput + BlendMode **선택 UI**
Step 10: ✅ ADR-904 — fills 를 D3 SSOT 로 승격, Preview/Publish 는 shared fillAdapter 로 파생
Step 11: ✅ ADR-187 — 드래그 preview 를 presentation 트랜잭션으로 이관 (store preview 액션 제거)
Step 12: ✅ 이미지 Fill (URL + 드롭 + 3모드)
Step 13: 🟡 메쉬 그래디언트 — 편집 UI 만, 렌더는 2×2 근사 (§6.2)
Step 14: ⬜ BlendMode 의 Skia 반영 (§5.3 결함 의심)
Step 15: ⬜ 다중 Fill 레이어 합성 렌더 (§4.3)
Step 16: ⬜ 색상 변수 바인딩 UI (§6.3)
```

### 7.3 Fill 시스템이 손대는 파일 (2026-09-09 실측)

| 파일                                                                             | 역할                                                                    |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/builder/src/types/builder/fill.types.ts`                                   | 6종 FillItem + BlendMode + BorderConfig + `createDefaultFill()`         |
| `apps/builder/src/types/builder/unified.types.ts`                                | `Element.fills?`(:106) / `Element.border?`(:108)                        |
| `packages/shared/src/types/composition-document.types.ts`                        | canonical 노드의 `fills?`(:821) — SSOT                                  |
| `apps/builder/src/builder/panels/styles/sections/FillSection.tsx / .css`         | `FillBackgroundInline` (실제 마운트) + dead export 2개                  |
| `apps/builder/src/builder/panels/styles/sections/AppearanceSection.tsx`          | Fill UI lazy mount 지점 (:61-63, :203)                                  |
| `apps/builder/src/builder/panels/styles/components/*.tsx / .css`                 | 14개 컴포넌트 (§0.2)                                                    |
| `apps/builder/src/builder/panels/styles/constants/styleOptions.ts`               | `BLEND_MODE_OPTIONS`(:43)                                               |
| `apps/builder/src/builder/panels/styles/hooks/{useFillActions,useFillValues}.ts` | 액션 14종 / 읽기                                                        |
| `apps/builder/src/builder/panels/styles/utils/*.ts`                              | 변환·마이그레이션·ingress·표시 8개 파일 (§0.2)                          |
| `apps/builder/src/builder/workspace/canvas/skia/buildBoxNodeData.ts`             | `element.fills` → `SkiaNodeData.box` (:156-189, :307-320)               |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`            | catalog(spec) 경로의 동일 변환 (:1927 부근)                             |
| `apps/builder/src/builder/workspace/canvas/skia/fills.ts`                        | `applyFill()` — FillStyle → CanvasKit Shader (:70-252)                  |
| `apps/builder/src/builder/workspace/canvas/skia/nodeRendererBorders.ts`          | `renderBox()` 가 `applyFill` 호출 (:491)                                |
| `apps/builder/src/builder/stores/inspectorActions.ts`                            | `updateSelectedFills` (:590-591, :1350) + DB payload `fills` (:485-486) |
| `apps/builder/src/builder/presentation/editorPresentationFillPilot.ts`           | ADR-187 드래그 preview 트랜잭션                                         |
| `packages/shared/src/utils/fillAdapter.ts`                                       | fills → CSS background 파생 (Preview/Publish 공용)                      |

> **없어진 항목**: `workspace/canvas/sprites/BoxSprite.tsx` (디렉터리째 삭제) · `apps/builder/src/utils/featureFlags.ts` 의 Fill 관련 helper (남은 export 4개는 전부 Fill 과 무관 — `:40`/`:49`/`:67`/`:83`).

---

## 8. 파이프라인 통합

Fill 변경은 두 갈래로 나뉜다 (ADR-187 이후).

**커밋 경로** (`updateSelectedFills` — 추가/삭제/토글/정렬/타입 변경/드래그 종료):

```
1. Memory Update (즉시)            — canonical 노드 fills[] 교체
2. Index Rebuild (즉시)
3. History Record (즉시)           — fills 전체 스냅샷
4. Fill → Skia 변환 (즉시)         — utils/fillToSkia.ts → skia/types.ts FillStyle
   └── skia/fills.ts::applyFill 가 CanvasKit Shader 생성 (nodeRendererBorders.ts:491)
5. Canvas Render                   — 성능 기준은 CLAUDE.md §성능 기준 (display refresh cadence, 60Hz floor)
6. DB Persist (백그라운드)          — inspectorActions.ts:485-486 이 payload.fills 를 싣는다
7. Preview / Publish Sync (백그라운드) — packages/shared/src/utils/fillAdapter.ts 가 CSS background 를 파생
```

**preview 경로** (드래그 중 — 첫 fill 의 color/paint 축 한정):

```
ColorArea / GradientBar / ScrubInput pointermove
  → useFillActions.previewFirstFill{Color,Paint}Presentation()
  → presentation/editorPresentationFillPilot.ts (EditorPresentationTransactionRuntime)
  → Skia 노드에 직접 반영 (canonical 문서 변경 없음, History 기록 없음)
pointerup → commitFirstFillColorPresentation() → 위 커밋 경로로 합류
pointercancel / Escape → cancelFirstFillColorPresentation()
```

지원되지 않는 대상(추가 레이어·미지원 타입)은 commit-only 로 남는다 (§3.2.2).

---

## 9. 성능 고려사항

### 9.1 드래그 최적화

```
ColorArea 드래그 중:
  → 로컬 상태 + presentation 트랜잭션 (canonical 문서·History 건드리지 않음)
  → frame scheduling 은 ADR-187 runtime 이 소유 (ColorPickerPanel 자체 rAF 금지 —
     presentation/editorPresentationPhase6.static.test.ts:10-18 이 검사)

ColorArea 드래그 종료:
  → commit → 스토어 업데이트 → History 기록 → DB Persist
```

### 9.2 상태 읽기

```typescript
// 실제 경로는 hooks/useFillValues.ts:47-79 — canonical 문서 우선, legacy elementsMap fallback
const { fills } = useFillValues();

// 저수준 fallback (canonical 문서가 없을 때만)
const fills =
  useStore.getState().elementsMap.get(selectedElementId)?.fills ?? [];
```

### 9.3 Gradient 셰이더 캐싱 — 여전히 미구현 (2026-09-09 확인)

저장소 전체에 `shaderCache` 식별자 0건. 향후 성능 이슈 발생 시 적용할 패턴:

```typescript
// 동일한 stops/rotation이면 Shader 재생성 안 함
const shaderCache = new Map<string, CanvasKit.Shader>();

function getOrCreateGradientShader(fill: GradientFillItem): CanvasKit.Shader {
  const key = computeFillHash(fill);
  if (shaderCache.has(key)) return shaderCache.get(key)!;
  const shader = createShader(fill);
  shaderCache.set(key, shader);
  return shader;
}
```

현재는 `applyFill()` 이 매 호출 shader 를 만들고 `{ delete() }` 핸들을 반환해 `renderBox()` 가 정리한다 (`skia/fills.ts:70`, `nodeRendererBorders.ts:491`).

### 9.4 성능 기준값 — **미검증 (2026-09-09 기준)**

아래 표는 설계 당시 제안값이며, 이 수치를 실제로 측정한 하니스·기록을 저장소에서 찾지 못했다. Fill 전용 성능 게이트는 없다 (프로젝트 전반 기준선은 `pnpm perf:baseline` — `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md`).

| 시나리오               | 측정 항목                                       | 제안 기준값       | 도구                   |
| ---------------------- | ----------------------------------------------- | ----------------- | ---------------------- |
| Fill 1개 렌더링        | Shader 생성 + Paint 적용                        | < 0.5ms           | `performance.now()`    |
| Fill 5개 레이어 합성   | 전체 fills 순회 + Shader 체이닝                 | < 3ms             | `performance.now()`    |
| ColorArea 드래그       | 드래그 중 프레임                                | 60Hz floor (p95)  | frame time p50/p95/p99 |
| Fill 추가/삭제         | UI 반영 시간                                    | < 16ms (1 프레임) | React Profiler         |
| 그래디언트 스톱 드래그 | Shader 재생성 + 캔버스 갱신                     | < 5ms             | `performance.now()`    |
| 마이그레이션           | `backgroundColor` → `fills[]` 변환 (요소 100개) | < 50ms            | `performance.now()`    |

> "Fill 5개 레이어 합성" 항목은 현재 코드에 해당 동작 자체가 없다 — 렌더는 최상단 enabled fill 1개만 그린다 (§4.3).

---

## 10. 리스크 분석

### 10.1 기술 리스크 (착수 시점 원본 기록 — 재평가는 §10.4)

> 아래 표는 2026-02 착수 시점에 작성된 원본이며 영향/발생 확률은 당시 추정값이다 (**미검증**). 2026-09-09 코드 실측 기준 재판정은 §10.4 에 있다.

| ID  | 리스크                                                                                                                                  | 영향 | 발생 확률 | 완화 방안                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- | --------------------------------------------------------------------------------------------------------- |
| R1  | **다중 Fill 렌더링 성능** — Fill 레이어 5+ 시 CanvasKit Shader 체이닝/합성 비용 증가                                                    | 중간 | 중간      | Fill 레이어 수 상한 설정 (기본 10개), 비활성(`enabled: false`) Fill은 렌더링 스킵                         |
| R2  | **마이그레이션 데이터 무결성** — 기존 `backgroundColor` → `fills[]` 변환 시 edge case (CSS 변수, `inherit`, `transparent`, `rgba()` 등) | 높음 | 높음      | 정규화 함수 `normalizeToHex8()`에 대한 edge case 테스트 철저히 작성, 변환 실패 시 원본값 보존             |
| R3  | **드래그 순서 변경 + History** — reorder 시마다 fills 배열 전체 스냅샷 저장으로 History 메모리 증가                                     | 낮음 | 중간      | History entry에 diff 대신 전체 스냅샷 사용 (기존 패턴), 메모리 상한 도달 시 오래된 entry 제거             |
| R4  | **EyeDropper 브라우저 호환 (Phase 3)** — Firefox/Safari 미지원, 일부 보안 정책에서 차단 가능                                            | 낮음 | 확실      | `'EyeDropper' in window` 가드로 버튼 자체를 숨김, 미지원 시 대체 UX 불필요 (기능 자체 생략)               |
| R5  | **Gradient Shader GPU 리소스 누수** — 스톱 드래그 중 매 프레임 Shader 재생성 시 이전 Shader `delete()` 누락 가능                        | 높음 | 중간      | 9.3의 shaderCache 패턴 적용 + 캐시 교체 시 이전 Shader `delete()` 명시적 호출, `SkiaDisposable` 패턴 준수 |
| R6  | **전환 단계 제어 필요** — 초기 rollout 시 Builder/Skia legacy 분기와 Fill 경로를 병행 관리해야 함                                       | 중간 | 중간      | 아래 10.2 참조                                                                                            |
| R7  | **`@dnd-kit/sortable` 신규 의존성** — 새 의존성 추가에 따른 번들 크기 증가 및 호환성 리스크                                             | 낮음 | 낮음      | `@dnd-kit/core` ~13KB gzip, Phase 1 착수 시 번들 분석 후 tree-shaking 확인                                |

### 10.2 Rollout / Retirement 구현 방안

초기 rollout 시점에는 `apps/builder/src/utils/featureFlags.ts` 기반 플래그 인프라를 활용했고, 현재는 retirement까지 완료된 상태다. 당시 검토했던 선택지는 아래와 같다:

| 방안                                                 | 장점                                                           | 단점                             |
| ---------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| **A. 기존 인프라 확장 (채택, 이후 retirement 완료)** | 현재 패턴(`VITE_USE_WEBGL_CANVAS`)과 동일, 구현/검증 비용 최소 | 런타임 사용자별 제어 불가        |
| **B. Zustand 슬라이스** (`useFeatureFlags()`)        | 런타임 전환 가능, DevTools 연동                                | DB/원격 제어 없음                |
| **C. Supabase Remote Config**                        | 사용자별/환경별 제어                                           | 구현 비용 높음, Phase 1에 과도함 |

> 실제 경과: Phase 1은 **방안 A**로 시작했고, ADR-904 후속에서 Builder/Skia legacy 분기를 제거하며 retirement까지 완료했다.

### 10.3 Phase 간 의존성 (실제 진행)

```
Phase 1 (Fill 모델 + 다중 UI)        ✅ 완료 (cc5ec34a5, 2026-02-10)
    ↓
Phase 2 (그래디언트 에디터)            ✅ 완료 (2c0b21664 · 3852a35db, 2026-02-11)
    ↓
Phase 3 (EyeDropper + BlendMode)      🟡 UI 완료 (2067f3379 · 2990b80ea, 2026-02-11)
                                          ScrubInput 은 이후 추가, BlendMode 의 Skia 반영은 미배선 (§5.3)
    ↓
Phase 4 (이미지/메쉬/변수)            🟡 부분 완료 — 이미지 ✅ · 메쉬 UI 만 · 변수 바인딩 ⬜
    ↓
(Phase 외) ADR-904 (2026-04-24)       ✅ fills → D3 SSOT, Preview/Publish 어댑터
(Phase 외) ADR-187 (2026-08-24)       ✅ 드래그 preview → presentation 트랜잭션
```

### 10.4 리스크 재평가 (2026-09-09 코드 실측)

| 항목                                        | 현재 판정                                                                                                                                     | 근거                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~R1: 다중 Fill 렌더링 성능~~               | **해소 — 단, 기능이 없어서 해소됐다.** 최상단 enabled fill 1개만 그리므로 합성 비용 자체가 발생하지 않는다                                    | `utils/fillToSkia.ts:508`·`:535`·`:592`, `nodeRendererBorders.ts:485-515`                                                                               |
| ~~R2: 마이그레이션 데이터 무결성~~          | **해소.** `transparent` / 빈 문자열 / `var(` / `$--` 를 모두 조기 반환으로 걸러낸다                                                           | `utils/fillMigration.ts:40-47`, 회귀 `fillMigration.test.ts` · `fillCssIngressParser.test.ts`                                                           |
| R3: reorder + History 메모리                | **미검증 (2026-09-09).** 전체 스냅샷 방식이라는 서술은 유지하되, 메모리 증가를 실제로 잰 기록은 없다                                          | —                                                                                                                                                       |
| ~~R4: EyeDropper 브라우저 호환~~            | **해소.** `'EyeDropper' in window` 가드로 컴포넌트가 `null` 반환                                                                              | `EyeDropperButton.tsx:26`, `:56`                                                                                                                        |
| R5: Gradient Shader GPU 리소스              | **부분 해소.** `applyFill()` 이 `{ delete() }` 핸들을 반환하고 `renderBox()` 가 정리한다. shaderCache 는 여전히 미구현이라 매 호출 재생성이다 | `skia/fills.ts:70-252`, `nodeRendererBorders.ts:491` (옛 문서의 `nodeRenderers.ts` 는 파일은 남아 있으나 `applyFill` 호출자는 `nodeRendererBorders.ts`) |
| ~~R6: 전환 단계 제어~~                      | **해소.** Fill V2 feature flag retirement 완료 — `featureFlags.ts` 에 Fill 관련 export 0건                                                    | `apps/builder/src/utils/featureFlags.ts`                                                                                                                |
| ~~R7: `@dnd-kit` 의존성~~                   | **의존성 추가됨.** 드래그 정렬이 구현됐으므로 "불필요" 는 낡은 판정                                                                           | `package.json:70-72`                                                                                                                                    |
| **신규 F1: fill-level blendMode dead 채널** | **미해소 (결함 의심).** 저장·표시만 되고 렌더에 도달하지 않는다                                                                               | §5.3                                                                                                                                                    |
| **신규 F2: mesh 편집 축과 렌더 축 불일치**  | **미해소.** UI 는 최대 6×6 을 편집하게 하고 렌더는 좌상 2×2 만 반영한다                                                                       | `MeshGradientEditor.tsx:172-190` vs `skia/fills.ts:210-212`                                                                                             |
| **신규 F3: FillSection dead export 2개**    | **정리 대상.** `FillSection` / `FillSectionInline` 이 마운트되지 않는다                                                                       | §0.4                                                                                                                                                    |

---

## 11. 코드 자산 현황

### 11.1 기존 자산 (재사용)

| 자산                       | 파일 경로                                        | 활용 상태 (2026-09-09)                                                                                        |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **`applyFill()`**          | `workspace/canvas/skia/fills.ts:70`              | 6종 FillStyle 전부 처리                                                                                       |
| **BlendMode 매핑**         | `workspace/canvas/skia/blendModes.ts:33-60`      | 18+종 매핑 존재. **fill-level blendMode 는 여기에 도달하지 않는다** (§5.3) — 실제 소비는 `style.mixBlendMode` |
| **`inspectorActions`**     | `stores/inspectorActions.ts`                     | `updateSelectedFills()` (:1350). `updateSelectedFillsPreview()` 는 제거됨                                     |
| **`historyManager`**       | `stores/history.ts:1026`                         | fills 커밋이 `updateAndSave` 경유로 History 기록                                                              |
| **React Aria ColorPicker** | `react-aria-components`                          | ColorPickerPanel 에서 parseColor/ColorArea/ColorSlider 활용                                                   |
| **`ColorSwatch`**          | `packages/shared/src/components/ColorSwatch.tsx` | `FillLayerRow.tsx:18`·`:126`, `FillSection.tsx:27`·`:462`                                                     |
| **`Popover`**              | `packages/shared/src/components/Popover.tsx`     | `FillLayerRow.tsx:19` — FillDetailPopover 컨테이너                                                            |
| **`PropertySelect`**       | `builder/components/property/PropertySelect.tsx` | Blend 드롭다운 (`FillDetailPopover.tsx:204-211`)                                                              |
| **`ToggleButtonGroup`**    | `packages/shared/src/components`                 | `FillTypeSelector.tsx:15-17` 3탭                                                                              |

### 11.2 신규 자산

| 자산                                                 | 파일 경로                                             | 비고                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **`fillToSkia.ts`**                                  | `panels/styles/utils/fillToSkia.ts`                   | 6종 전부 변환 구현 (image `:312` · mesh `:451` 포함) |
| **`fillMigration.ts`**                               | `panels/styles/utils/fillMigration.ts`                | read-through + CSS 출력                              |
| **`colorUtils.ts`**                                  | `panels/styles/utils/colorUtils.ts`                   | 변환 함수 14종                                       |
| **`fillCssIngressParser.ts`**                        | `panels/styles/utils/fillCssIngressParser.ts:163`     | CSS background → FillItem[] (allowlist 6종)          |
| **`fillExternalIngress.ts`**                         | `panels/styles/utils/fillExternalIngress.ts:29`·`:74` | 외부/legacy payload 정규화 (단건 + batch)            |
| **`fillDerivedStyleProps.ts`**                       | `panels/styles/utils/fillDerivedStyleProps.ts:11`     | 파생 background 필드 sanitize                        |
| **`fillPresentation.ts`**                            | `panels/styles/utils/fillPresentation.ts`             | 가상 fill · swatch 스타일 · 표시 라벨                |
| **`useFillActions.ts`**                              | `panels/styles/hooks/useFillActions.ts`               | CRUD 7 + presentation 7                              |
| **`useFillValues.ts`**                               | `panels/styles/hooks/useFillValues.ts`                | 읽기 + UI 전용 상태                                  |
| **`ScrubInput.tsx`**                                 | `panels/styles/components/ScrubInput.tsx`             | 5개 컴포넌트가 사용                                  |
| **`ImageFillEditor.tsx` / `MeshGradientEditor.tsx`** | `panels/styles/components/`                           | Phase 4 UI                                           |
| **`editorPresentationFillPilot.ts`**                 | `builder/presentation/`                               | ADR-187 드래그 트랜잭션                              |
| **`fillAdapter.ts`**                                 | `packages/shared/src/utils/fillAdapter.ts`            | Preview/Publish 공용 파생 (ADR-904)                  |

---

## 12. 테스트 현황 (2026-09-09 실측)

옛 문서가 "미작성" 으로 적어둔 항목 중 상당수가 실제로는 존재한다.

| 범위                  | 파일                                                                               | 상태                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 타입 안전성           | `pnpm type-check`                                                                  | 통과 전제 (Stop hook 이 같은 명령 실행)                                                                           |
| 색상 변환             | `utils/__tests__/colorUtils.hexInput.test.ts`                                      | **존재.** 단 `normalizeHexInputToHex8` 1개만 커버 — 나머지 13개 export 는 이 파일에서 미검증                      |
| Fill CRUD             | `hooks/useFillActions.test.tsx`                                                    | **존재** — legacy backgroundColor-only 요소의 canonicalize                                                        |
| Fill 읽기 소스 단일화 | `hooks/useFillActions.canonicalSource.test.tsx`                                    | **존재** — 표시(useFillValues) ↔ 액션(useFillActions) 소스 분열 회귀                                              |
| presentation 트랜잭션 | `hooks/useFillActions.presentation.test.tsx`                                       | **존재** — 늦은 terminal · 취소 후 재시작 · commit 실패 시 handle 유지 등                                         |
| 마이그레이션          | `utils/fillMigration.test.ts`                                                      | **존재** — read-through, 토큰/transparent 제외, image → CSS                                                       |
| CSS ingress           | `utils/fillCssIngressParser.test.ts`                                               | **존재** — allowlist 6종만 파싱                                                                                   |
| 외부 payload ingress  | `utils/fillExternalIngress.test.ts`                                                | **존재** — legacy solid/gradient/image/mesh 승격, batch                                                           |
| 파생 style 필드       | `utils/fillDerivedStyleProps.test.ts`                                              | **존재**                                                                                                          |
| 표시 보조             | `utils/fillPresentation.test.ts`                                                   | **존재** — virtual fill sentinel, swatch, 라벨                                                                    |
| Skia 변환             | `utils/__tests__/fillToSkia.gradient.test.ts` · `fillToSkia.fallbackColor.test.ts` | **존재** — angular 회전 행렬, radial 타원, fallback 색                                                            |
| mesh 결선 회귀        | `skia/__tests__/buildBoxNodeData.meshFill.test.ts`                                 | **존재** — `box.fill.type === "mesh-gradient"` 보존                                                               |
| ADR-187 legacy 가드   | `presentation/editorPresentationPhase6.static.test.ts`                             | **존재** — 금지 식별자/주석 정적 검사                                                                             |
| UI 렌더링 (Storybook) | —                                                                                  | **없음.** `apps/builder` 에 `.stories.tsx` 0건 (Storybook 파일은 `packages/react-aria-starter` upstream 스냅샷뿐) |
| 성능                  | —                                                                                  | Fill 전용 게이트 없음 (§9.4)                                                                                      |

### 12.1 수용 기준 재판정 (2026-09-09)

- [x] 단색 요소를 선택했을 때 기존 `backgroundColor` 가 fill 로 표시된다 — read-through (`fillMigration.ts:78`), 회귀 `useFillActions.test.tsx`
- [x] Fill 레이어 **추가/삭제/토글**이 동작하고 History 에 기록된다 — `useFillActions.ts:41-79` → `inspectorActions.ts:1350`
- [x] 드래그 중 preview 가 갱신되고 drag end 에만 history entry 가 생긴다 — presentation 트랜잭션 (`useFillActions.presentation.test.tsx`)
- [x] Linear/Radial/Angular 스톱 편집이 Skia 에 반영된다 — `fillToSkia.gradient.test.ts`, `fills.ts:83-171`
- [x] EyeDropper 가 미지원 브라우저에서 숨겨지고 ESC 취소가 상태를 오염시키지 않는다 — `EyeDropperButton.tsx:49-56` (**브라우저 실행 검증은 미검증**)
- [ ] ~~BlendMode 선택 시 Skia 캔버스에 즉시 반영된다~~ — **성립하지 않음** (§5.3). 저장·표시만 된다
- [x] Color ↔ Gradient 탭 전환 시 Popover 위치가 유지된다 — 단 **고정 244px 이 아니라** `width: var(--trigger-width); min-width: 180px` (`FillLayerRow.css:194-198`)
- [x] Fill 레이어 드래그 순서 변경 — `FillSection.tsx:61-95`
- [x] ScrubInput 으로 숫자 값 드래그 조정 — `ScrubInput.tsx`, 5개 컴포넌트
- [x] 이미지 Fill (URL / 드롭 / 3모드) — `ImageFillEditor.tsx`
- [ ] 메쉬 그래디언트가 편집한 N×M 그대로 렌더된다 — **성립하지 않음** (좌상 2×2 만, §6.2)
- [ ] 다중 Fill 레이어가 합성되어 렌더된다 — **성립하지 않음** (최상단 1개만, §4.3)
- [ ] 색상 변수 바인딩 UI — 미구현 (§6.3)

### 12.2 Rollout / Retirement 결과

- 초기 rollout 은 **방안 A (환경변수 flag)** 로 시작했고, Fill V2 flag 는 retirement 완료됐다 — `apps/builder/src/utils/featureFlags.ts` 에 Fill 관련 export 0건.
- Background 편집은 `AppearanceSection` → `FillBackgroundInline` 단일 경로다 (§0.4).
- 즉시 롤백은 환경 플래그가 아니라 commit rollback 대상이다.
- DB: `fills ?? backgroundColor` read-through 폴백 유지 (`utils/fillMigration.ts:78`).
- Skia / Preview / Publish 모두 `fills` 우선 경로이며 derived `background*` 는 런타임 파생값이다 — `packages/shared/src/utils/fillAdapter.ts` 를 `apps/publish/src/renderer/ElementRenderer.tsx:54` 와 `apps/builder/src/preview/App.tsx:822` 가 같이 쓴다.

---

## 부록 A: Pencil 컬러 피커 소스 참조 — **미검증 (2026-09-09 기준)**

> 아래는 외부 앱(Pencil) 분석 기록이며 이번 검증 범위 밖이다. composition 코드로는 확인할 수 없다.

Pencil의 컬러 피커는 `react-colorful` 라이브러리 기반:

```
react-colorful (HSB picker)
├── Saturation/Brightness 2D 영역
├── Hue 슬라이더 (16px)
├── Alpha 슬라이더 (16px)
└── 포인터: 14px, border-width: 3px
```

**색상 모드 전환** (`Select` 컴포넌트):

- `case 1`: RGBA (4칸 grid, 각 w-12 h-6)
- `case 2`: HEX (단일 w-20 h-6, font-mono)
- `case 3`: CSS (단일 w-42 h-6, font-mono)
- `case 4`: HSL (4칸 grid)
- `case 5`: HSB (4칸 grid)

**EyeDropper**: `window.EyeDropper` API 사용, title "Pick color from screen"

**Scrub Input**: `requestPointerLock()` + `movementX` 누적 + Shift 배수 + 커스텀 ↔ 커서 SVG 포탈

---

## 부록 B: 관련 ADR (2026-09-09 제목·상태 실측)

**이 문서의 Fill 시스템을 직접 규정하는 ADR**

- [ADR-904: Fill SSOT + Preview/Publish 어댑터 전환](../../adr/completed/904-fill-ssot-preview-publish-adapter.md) — **Implemented 2026-04-24.** `fills` 를 D3 SSOT 로 승격, CSS `background*` 는 `fillAdapter` 런타임 파생, Fill V2 flag retirement
- [ADR-905: Fill 비정형 background payload 정책](../../adr/completed/905-fill-noncanonical-background-payload-policy.md) — 비정형 `backgroundImage` / data URL 정책
- [ADR-187: 에디터 프레젠테이션 트랜잭션과 타입 기반 무효화](../../adr/completed/187-editor-presentation-transaction-and-typed-invalidation.md) — **Implemented 2026-08-24.** 색상 드래그 preview 를 canonical 변경에서 분리

**혼동 주의 — 다른 축의 ADR**

- [ADR-908: Fill spec schema SSOT](../../adr/completed/908-fill-spec-schema-ssot.md) — **catalog/spec 의 컴포넌트 variant fill preset** (`FillTokenSpec`, `packages/specs/src/types/spec.types.ts:867`). 이 문서의 `FillItem` 과는 별개 축이다 (§0.5)

**기반 ADR**

- [ADR-001: Zustand for State Management](../../adr/completed/001-state-management.md) — Accepted. (제목이 "Zustand 슬라이스 + Jotai atom" 이라던 옛 서술은 틀렸다. Jotai 는 저장소 의존성에 없다)
- [ADR-002: ITCSS + tailwind-variants for Styling](../../adr/completed/002-styling-approach.md) — Accepted
- [ADR-003: PixiJS for Canvas Rendering](../../adr/completed/003-canvas-rendering.md) — **Superseded (2026-02-05)**, CanvasKit/Skia 2-pass 렌더러로 대체. 이 문서의 Skia 경로는 ADR-003 이 아니라 그 후속 렌더러다
