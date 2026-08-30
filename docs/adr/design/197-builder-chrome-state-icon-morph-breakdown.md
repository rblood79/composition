# ADR-197 Breakdown: Builder chrome 상태 아이콘 morph — morphicons core vendoring + StateIcon 레지스트리

> 2026-08-30 초안. ADR 본문: [197-builder-chrome-state-icon-morph.md](../197-builder-chrome-state-icon-morph.md).
> Phase 0 inventory 는 본 문서의 표를 갱신하는 commit 으로 freeze 한다 (M3 — 추정/실측 gap 은
> inventory 보강이지 fork 사유가 아님).

## 1. 전제 lock-in (fork 아님 — 완전 신규 주제)

- 본 ADR 은 기존 ADR 의 분리/fork 가 아니다. `rg -i "morph|animated icon|아이콘 애니메이션" docs/adr .claude` 실측 (2026-08-29) — 아이콘 상태 전환 애니메이션에 대한 결정·논의 0건. 유일한 인접 결정은 ADR-192 (Contextual Action Bar — Pin 메뉴 아이콘이 교체 대상 11곳 중 1곳) 뿐이며 의존이 아니라 파일 겹침이다.
- 의존 방향: 없음 (base ADR 없음). 본 ADR 의 산출물 (`MorphIcon` / `StateIcon`) 은 chrome 소비자이고, 데이터는 기존 `@composition/specs` `getIconData` (ADR-019 Icon 레지스트리) 를 읽기만 한다. ADR-019 의 D3 경로 (`Icon.tsx` / `renderIconPath`) 는 변경 0.
- SSOT 경계: **해당 없음** — Builder chrome (에디터 자체 UI, DOM React) 전용. 사용자 문서를 그리는 canvas (Skia) · Preview · Publish 미적용 (사용자 결정 2026-08-29: "적용 대상은 builder 에 제한, canvas 화면에는 적용하지 않는다"). D1/D2/D3 경계 변경 없음, `/cross-check` 대상 아님.
- 사용자 의도 (2026-08-29): "빌더 내 아이콘을 더 동적으로 — lock-keyhole-open → lock-keyhole 식 on/off 개념을 더해 가독성·시인성" + "재사용 가능한 패턴으로".

## 2. Current Baseline (2026-08-29 실측 · **2026-08-30 재검토 갱신**, HEAD `cb42ead69`)

> 재검토 사유 (2026-08-30): 초안 이후 아이콘 전수조사 (`9f8b3089b`, 17건 교체) · Monitor 패널 재구성 (`cb42ead69`) · 속성 필드 아이콘 정본 신설 (`60a4dab37`) · 버튼 통일 (`1227dd303`) 이 반영되어 기준선이 이동했다. 아래 표·목록은 재측정 결과다.

### 2-1. chrome 아이콘 현황

| 항목                    | 실측                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lucide-react import     | `apps/builder/src` **108 파일** (`rg -l 'from "lucide-react"'`, 2026-08-30 재측정. 전수조사 commit `9f8b3089b` 은 104 파일 / 고유 239 심볼 / 사용 747곳 — 세는 단위가 다름. `panel-structure.md:115` 의 106 파일 / 220 심볼은 2026-08-16 값으로 stale). 아이콘은 `ComponentType` (`ActionIcon` 타입, `actionIcons.ts:34`) 로 전달                                                                                               |
| 상태 전환 = 삼항 교체   | 11곳 (§2-2). 회전·crossfade·`transition` CSS **0건** (`rg "rotate\(" --type css` 아이콘 관련 0)                                                                                                                                                                                                                                                                                                                                 |
| 상태 있음 · 아이콘 고정 | **6곳** (§2-3 — 초안 11곳 중 5건이 재측정에서 토글 아님으로 제외) — RAC `ToggleButton[data-selected]` 배경 wash 만으로 상태 표시 (`ActionIconButton.css:29` `color-mix(var(--fg) 10%)` · `SwatchIconButton.css:31` pressed `--accent-subtle`; 둘 다 gray wash — 메모리 `project-builder-accent-subtle-is-gray-wash`)                                                                                                            |
| 아이콘 크기 계약        | `apps/builder/src/utils/ui/uiConstants.ts` (builder/ 하위 아님) `iconProps` 16 / `iconEditProps` 14 / `iconSmall` 12 / `iconLarge` 24, `strokeWidth 2`, `color: var(--color-gray-400)` 등 — 모두 lucide-react prop 명 (`size` / `strokeWidth` / `color`)                                                                                                                                                                        |
| 아이콘 데이터 원천      | `packages/specs/src/icons/lucideIconData.generated.ts` (432KB, lucide-react 1.33.0, 1,627 아이콘 + 257 alias, `{paths: string[], circles?}`) — `getIconData(name)` (`lucideIcons.ts:41`). **lucide-react 는 `__iconNode` 를 각 `icons/*.mjs` 에서만 export, 메인 index·컴포넌트 미노출** (`createLucideIcon.mjs` 확인) → deep import 는 취약                                                                                    |
| 기존 애니메이션 인프라  | chrome: `hooks/useFrameCallback.ts` (rAF/idle throttle), `builder/hooks/useRAFThrottle.ts` — 값 throttle 용, spring/보간 없음. canvas 측 `skia/animationEngine.ts` (CSS keyframes pull 모델) · `transitionEngine.ts` · `dragAnimator.ts` (lerp) 는 canvas 전용 — 본 ADR 미사용                                                                                                                                                  |
| 자체 아이콘 디렉토리    | `builder/components/icons/` — `index.ts` · `LayoutFreeform.tsx` · `SquareOff.tsx` (custom). `AppearanceSection.tsx:30` 은 **custom** `SquareOff` (`components/icons/SquareOff.tsx`) 를 import 한다 (리뷰 실측 2026-08-30) — 후보 `inset` 쌍의 off 끝점은 lucide `square-off` (존재 확인) 로 교체, custom 파일은 다른 소비자가 없으면 Phase 3 에서 삭제 판정 (삭제는 사용자 승인)                                                |
| 아이콘 정본 레지스트리  | **2개** (2026-08-30 현재) — 액션: `config/actionIcons.ts` `ACTION_ICONS` (등재 기준 = 2+ surface, `INTENTIONAL_DIVERGENCE` 병기) · 속성 필드: `config/propertyFieldIcons.ts` (신설 `60a4dab37`, `propertyFieldIcons.static.test.ts` 6 케이스가 dead entry·단일 사용·미등재를 집행). 판정 규칙 정본은 `.claude/rules/panel-structure.md` §아이콘 (113~147) — ① 뜻 일치 ② 같은 화면 변별 ③ rail↔패널 헤더 일치 · 행 아이콘과 상이 |
| morphicons upstream     | `guillermolg00/morphicons` 1.7.1, commit `38d2a7221633a453eeafebd872ee3649b9274b22` (2026-08-28), MIT, 런타임 의존 0. core 8 파일 1,470 LOC (주석 포함), gzip 6.60 KB (upstream size gate 7 KB) · dom driver +0.5 KB. 테스트 bun:test 123 케이스 (invariants 9 · closed 12 · dom 16 · parse 13 · normalize 14 · resample 5 · viewbox 9 · adapters 45)                                                                           |
| 입력 계약 호환          | `IconInput = IconNode \| string`, `IconNode = [tag, attrs][]` (path/line/circle/ellipse/rect/polyline/polygon). composition `LucideIconData` → `[...paths.map(d => ["path",{d}]), ...circles.map(c => ["circle", c])]` 무손실                                                                                                                                                                                                   |
| 번들 규칙               | `CLAUDE.md` 초기 번들 <500KB · `.claude/skills/component-design/SKILL.md:75` 외부 라이브러리 추가 금지. 직전 선례 ADR-196 초기 번들 +1.23KB gz. 아이콘 데이터는 이미 초기 chunk (`skia/specShapeConverter.ts:9` · `components/ui/SearchField.tsx:19` eager `getIconData`)                                                                                                                                                       |

### 2-2. 교체 대상 — 삼항 즉시 교체 11곳 (`apps/builder/src/builder/` 기준)

| #   | 파일:line                                                      | 쌍 (off → on)                | 크기 | 비고                                                                                                  |
| --- | -------------------------------------------------------------- | ---------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| 1   | `panels/interactions/RuleRow.tsx:130`                          | chevron-right → chevron-down | 14   | `expanded`                                                                                            |
| 2   | `panels/properties/generic/ItemsManager.tsx:79`                | chevron-right → chevron-down | 12   |                                                                                                       |
| 3   | `panels/properties/generic/ItemsManager.tsx:231`               | chevron-right → chevron-down | 12   |                                                                                                       |
| 4   | `panels/datatable/editors/VariableEditor.tsx:254`              | chevron-right → chevron-down | 14   | `iconEditProps` 스프레드                                                                              |
| 5   | `panels/navigator/FramesTab/FrameElementTree.tsx:270`          | chevron-right (단일)         | 16   | `data-chevron` 만 — 토글 승격 대상 (Phase 2 판정)                                                     |
| 6   | `components/overlay/actionBar/ContextualActionBar.tsx:165`     | pin → pin-off                | 14   | `const PinIcon = pinned ? PinOff : Pin` — ADR-192 **completed** (2026-08-30 확인) 이라 순서 제약 해제 |
| 7   | `panels/settings/SettingsPanel.tsx:57`                         | sun → moon                   | —    | `getThemeModeIcon()` (auto 는 `matchMedia`)                                                           |
| 8   | `panels/themes/ThemesPanel.tsx:315`                            | sun → moon                   | 16   |                                                                                                       |
| 9   | `../dashboard/index.tsx:701`                                   | sun → moon                   | 16   | dashboard (builder 앱 밖 화면이지만 같은 chrome 어법)                                                 |
| 10  | `panels/styles/sections/LayoutSection.tsx:483,518`             | maximize-2 → minimize-2      | 16   | `SwatchIconButton`                                                                                    |
| 11  | `panels/styles/sections/TransformSection.tsx:673`              | lock / unlock                | 16   | → 레지스트리에서 **lock-keyhole-open → lock-keyhole** 로 교체 (사용자 예시)                           |
| 12  | `panels/properties/editors/ResponsiveVisibilityEditor.tsx:142` | eye-off → eye                | 12   | breakpoint 별 3개                                                                                     |

제외: `panels/ai/AIPanel.tsx:72` (user↔bot 은 메시지별 고정, 전환 없음) · `LayersSection.tsx:278` / `FrameElementTree.tsx:156` (`Minimize` 단일 액션).

### 2-3. 확장 후보 — 재판정 (2026-08-30 실측)

초안 11 항목 중 **5건은 토글이 아니어서 제외**한다 (형태 전환 지점이 없거나, 한 컨트롤의 두 상태가 아니라 서로 다른 요소).

| pair 이름 | off → on                   | 위치                                                                          | 판정                                                      |
| --------- | -------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| inset     | square-off → square        | `panels/styles/sections/AppearanceSection.tsx:317` (`SwatchIconToggleButton`) | 유지 — custom `SquareOff` → lucide `square-off` (§2-1)    |
| step      | circle-dot → circle-check  | `panels/ai/components/AdvancedMode.tsx:56,58`                                 | 유지 — 이미 삼항 (성격상 §2-2)                            |
| ai        | bot-off → bot              | `layout/PanelToggleGroup.tsx:91` (`panels/core/panelConfigs.ts:147`)          | 유지 — 패널 토글 12개 중 짝 있는 유일 항목                |
| compare   | square → columns-2         | `main/BuilderHeader.tsx:312` (`ToggleButton id="compare"`)                    | 유지 — `Columns` 는 `columns-2` 의 폐기 별칭, 정식명 사용 |
| view      | layout-grid → list         | `../dashboard/index.tsx:802`                                                  | 유지 — σ≈0 subpath 3개 (사각형 → 점 수축) 시각 확인 필요  |
| save      | cloud-upload → cloud-check | (저장 상태 — 현재 `--builder-save-pending-pulse` 만, 아이콘 없음)             | 유지 — **신규 배치, 위치 미정**                           |

**제외 5건** (재측정 근거):

| 초안 항목 | 실측                                                                                                         | 제외 사유                                  |
| --------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| monitor   | `panels/monitor/MonitorPanel.tsx:188` 의 `Zap` 은 Realtime **탭 아이콘** (`cb42ead69` 로 탭 구조 표준화)     | 탭 선택은 탭 어법이 표시 — off 형태가 없음 |
| run       | `ApiEndpointEditor.tsx:821` · `ApiEndpointList.tsx:147` 의 `Play` 는 1회 실행 액션, `Pause` import 0건       | 실행 중 상태 prop 부재                     |
| agent     | `panels/ai/components/AgentControls.tsx:24` 는 실행 중에만 렌더되는 중단 버튼 (`Square` 단독, `Play` 미사용) | 한 컨트롤의 두 상태가 아님                 |
| online    | `ConnectionStatus.tsx:31` `WifiOff` 는 미구성 빈 상태 블록, `:70` `Wifi` 는 "폐쇄망" 배지                    | 서로 다른 요소 — 같은 자리의 전환이 아님   |
| filter    | `components/selection/SelectionFilter.tsx:137` 의 `Filter` 는 헤더 **타이틀** 아이콘                         | 상태 표시가 아님 (토글은 별도 Button)      |

**아이콘 정본과의 경계 (신규 — 2026-08-30)**: `propertyFieldIcons.ts` 가 `isReadOnly: Lock` (:153) · `isQuiet: EyeOff` (:158) · `showValueLabel: Eye` (:161) 로 **lock/eye 그림을 속성 필드의 정적 식별자**로 이미 쓴다. 같은 Properties/Styles 화면에서 `ICON_STATE_PAIRS` 의 `lock` / `visible` 쌍이 같은 그림을 상태 표시로 쓰면 `panel-structure.md` §아이콘 판정 기준 ②(같은 화면 변별) 와 충돌한다 — 등재 시 화면 단위로 확인 (§3-5 "정본 경계" 규칙, G2).

짝 없음 → 정적 유지 (레지스트리 등록 금지): Typography Underline/Strikethrough/Italic (`TypographySection.tsx:384,391,419` — `9f8b3089b` 이후 Bold 는 fontWeight **필드 아이콘** `:257` 으로 이동) · Magnet/RulerDimensionLine (`ACTION_ICONS.toggleSnap` / `toggleRulers` — `magnet-off` 없음, 등재 액션이라 직접 import 금지 조항 대상) · 패널 토글 11개 (`panelConfigs.ts`, 의미 아이콘 — `9f8b3089b` 로 Navigator `ListTree` · Components `Blocks` · Monitor `Activity` 로 교체됨) · breakpoint 그룹 (enum 3개 동시 표시, `BuilderHeader.tsx:265`).

lucide 짝 재고 (composition 데이터 기준): `-off` 74 · `-check` 32 · `-x` 34 · `-plus` 38 · `-minus` 28 · `-open` 10 · `-closed` 3 · `-lock` 8 · `-dot` 7.

### 2-4. morph 실계산 (morphicons core, 2026-08-29 — scratchpad `morph-frames.json`)

| 쌍                               | subpath | θ (°)               | σ                         | 비고                                      |
| -------------------------------- | ------- | ------------------- | ------------------------- | ----------------------------------------- |
| chevron-right → chevron-down     | 1 → 1   | 90                  | 1                         | res 0 — 합동, 순수 회전                   |
| pin → pin-off                    | 2 → 4   | 0 / −45 / −40 / −48 | 1 / 2.0 / 0.7 / 2.3       | 전사 매칭 (cell division)                 |
| sun → moon                       | 9 → 1   | −7 … 83             | 5.9 (광선)                | 광선 8개 → 초승달 1개                     |
| maximize-2 → minimize-2          | 4 → 4   | 180 / 0 / 0 / 180   | 1                         | res 0 — 화살촉만 반전                     |
| lock-keyhole-open → lock-keyhole | 3 → 3   | 31 / 0 / 0          | 1.16 / 1 / 1              | 고리만 회전, 본체·열쇠구멍 정지           |
| eye → eye-off                    | 2 → 4   | 1 / 3 / −1 / −42    | 1.16 / 0.64 / 1.75 / 0.47 |                                           |
| layout-grid → list               | 4 → 6   | −2                  | **0 × 3**, 0.54           | 사각형 3개가 점으로 수축 — 시각 확인 필요 |

### Phase 0 재grep (착수 직전 필수)

```bash
rg -n "\? <[A-Z][A-Za-z0-9]+ [^>]*/> ?: <[A-Z]" apps/builder/src --glob '*.tsx' --glob '!**/workspace/canvas/**' --glob '!*.test.*'
rg -n "(Icon|icon) = [a-zA-Z.!]+ \? [A-Z]" apps/builder/src --glob '*.tsx'
rg -n "SquareOff" apps/builder/src --glob '*.tsx'
rg -n "isSelected=|aria-pressed=|ActionIconToggleButton|SwatchIconToggleButton" apps/builder/src --glob '*.tsx' --glob '!**/workspace/canvas/**' -l
rg -n "__iconNode" apps/builder/node_modules/lucide-react/dist/esm/lucide-react.mjs | head -1   # 0건이어야 함 (index 미노출 전제)

# 아이콘 정본 2개와의 겹침 (2026-08-30 추가) — 등재 쌍의 그림이 이미 다른 정본에 있는지
rg -n "Lock|Eye|EyeOff|Pin|Sun|Moon|Maximize2|Minimize2" apps/builder/src/builder/config/actionIcons.ts apps/builder/src/builder/config/propertyFieldIcons.ts
pnpm --filter @composition/builder test -- propertyFieldIcons.static actionIcons.static   # 신규 static 게이트 baseline
```

## 3. 설계

### 3-1. 파일 배치 (builder 내부 — `packages/shared` 아님: 소비자가 chrome 뿐)

```
apps/builder/src/builder/components/icons/morph/
  core/               ← upstream src/core/* 그대로 (MIT 헤더 + UPSTREAM.md: 1.7.1 / 38d2a72 / 갱신 절차)
    parse.ts normalize.ts resample.ts plan.ts interpolate.ts serialize.ts spring.ts types.ts index.ts
  dom.ts              ← upstream src/dom/index.ts (createMorph · singleton rAF · WeakMap 캐시 · canonicalD)
  iconNodes.ts        ← name → IconNode 변환 + 모듈 Map 캐시 (참조 고정)
  MorphIcon.tsx       ← React binding (upstream src/react/index.tsx 축소판: 이름 기반, controlled 모드·imperative handle 제거)
  statePairs.ts       ← ICON_STATE_PAIRS 레지스트리 (SSOT)
  StateIcon.tsx       ← boolean 전용 얇은 껍질
  __tests__/
    invariants.test.ts  ← upstream test/invariants.test.ts + closed.test.ts (bun:test → vitest)
    dom.test.ts         ← upstream test/dom.test.ts (settle → canonical d, seek 결정성, singleton rAF)
    statePairs.test.ts  ← 레지스트리 무결성
    MorphIcon.test.tsx  ← reducedMotion 기본값, 이름 변경 시 morphTo 1회, unmount destroy
```

### 3-2. 파이프라인 (순수 함수 — 마지막 단계만 DOM)

```
getIconData(name) → IconNode (Map 캐시) → resampleIcon (normalize→cubic, 64pt 호길이)
  → buildPlan(src, dst) (Procrustes 정렬, WeakMap<src, WeakMap<dst, Plan>>)
  → Spring.step(dt) → interpPolar(plan, t, out) → serialize(out) → path.setAttribute("d")
정지 시: path.setAttribute("d", canonicalD(target))  ← 곡선 fidelity 복귀
```

### 3-3. 레지스트리 (초기 항목)

```ts
// statePairs.ts — [off, on]: index 1 이 항상 "활성 · 잠김 · 보임 · 실행 중"
export const ICON_STATE_PAIRS = {
  lock: ["lock-keyhole-open", "lock-keyhole"],
  visible: ["eye-off", "eye"],
  pin: ["pin", "pin-off"],
  expand: ["chevron-right", "chevron-down"],
  theme: ["sun", "moon"],
  spacing: ["maximize-2", "minimize-2"],
} as const satisfies Record<string, readonly [off: string, on: string]>;
export type IconStatePair = keyof typeof ICON_STATE_PAIRS;
```

Phase 3 확장 후보는 §2-3 재판정 통과분만 (`inset` / `step` / `ai` / `compare` / `view` / `save`). 제외 5건 (`monitor` / `run` / `agent` / `online` / `filter`) 은 토글이 아니어서 등재 금지.

### 3-4. 컴포넌트 API

```tsx
// MorphIcon — any → any (enum 전환 포함). lucide-react 와 같은 presentation prop.
<MorphIcon icon="chevron-down" size={14} strokeWidth={2} color="var(--color-gray-400)"
           spring="smooth" reducedMotion="user" aria-hidden />

// StateIcon — boolean 전용. 레지스트리 키만 받는다 (짝 없는 토글은 쓰지 않음 = fallback).
<StateIcon pair="lock" on={locked} size={16} />

// RAC ToggleButton render prop
<ToggleButton id="ai" aria-label={name}>{({ isSelected }) => <StateIcon pair="ai" on={isSelected} />}</ToggleButton>

// 삼항 교체 예 (ContextualActionBar)
- const PinIcon = pinned ? PinOff : Pin;  <PinIcon size={MENU_ICON_SIZE} aria-hidden="true" />
+ <StateIcon pair="pin" on={pinned} size={MENU_ICON_SIZE} aria-hidden="true" />
```

DOM 산출: `<svg width height viewBox="0 0 24 24" fill="none" stroke stroke-width stroke-linecap="round" stroke-linejoin="round"><path d/></svg>` — lucide-react 와 동일 속성 집합 (class `lucide lucide-*` 는 chrome CSS 에서 미참조 — Phase 0 재grep 으로 확인). 다중 `<path>` 대신 단일 `<path>` (subpath 는 `d` 안의 `M` 으로 연결) — 이것이 morph 의 write contract.

### 3-5. 규칙

| 규칙                    | 내용                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| index 1 = on            | 호출부가 "어느 쪽이 켜짐" 을 해석하지 않는다                                                                                                                                                                                                                                                                                                                                                              |
| 짝 없으면 등록 금지     | `StateIcon` 은 레지스트리 키만 받는다. 짝 없는 토글은 기존 정적 아이콘 + `data-selected` 유지                                                                                                                                                                                                                                                                                                             |
| 정본 경계 (2026-08-30)  | 아이콘 정본 3개의 축이 다르다 — **액션** = `ACTION_ICONS` (2+ surface 의 같은 액션) · **속성 필드** = `propertyFieldIcons` (catalog 필드 key) · **상태 쌍** = `ICON_STATE_PAIRS` (한 컨트롤의 on/off 형태). 등재 전 `panel-structure.md` §아이콘 판정 기준 ①뜻 일치 ②같은 화면 변별 통과 필수. `ACTION_ICONS` 등재 액션의 쌍은 그 registry 를 정본으로 두고 쌍만 참조 (직접 lucide import 금지 조항 유지) |
| reducedMotion 기본 user | OS `prefers-reduced-motion` 시 `morphTo ≡ set` (프레임 0). `never` 는 명시 opt-in 만                                                                                                                                                                                                                                                                                                                      |
| spring 기본 smooth      | ζ=1 임계 감쇠 (overshoot 0). `snappy` 허용, `bouncy` 는 chrome 금지                                                                                                                                                                                                                                                                                                                                       |
| 참조 고정               | 같은 이름 → 같은 IconNode 참조 (모듈 Map). 매 render 변환 금지 — plan WeakMap 캐시가 쌍당 1회가 되는 전제                                                                                                                                                                                                                                                                                                 |
| 정지 시 canonical       | settle 후 `d === canonicalD(target)` (테스트 고정)                                                                                                                                                                                                                                                                                                                                                        |
| rAF                     | morph 전체 singleton 1개, 정지 시 0 timer. Skia 루프 (`SkiaCanvas.tsx:627`) 와 무관 — canvas 미적용                                                                                                                                                                                                                                                                                                       |
| upstream 갱신           | `core/` 디렉토리 통째 교체 → Prettier 재포맷 (PostToolUse hook 이 어차피 적용 — upstream 은 biome 포맷이라 바이트 hash 비교는 무의미, 비교는 테스트로) → invariants/dom 테스트 통과 → `UPSTREAM.md` 에 upstream commit 기록. 부분 patch 금지 (drift 누적 방지)                                                                                                                                            |

## 4. Phase 계획

### Phase 0 — inventory freeze + core vendoring (소비자 0)

| 파일                                           | 변경                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `components/icons/morph/core/*` (9)            | upstream 복사 + MIT 헤더 + `UPSTREAM.md`                                                             |
| `components/icons/morph/dom.ts`                | upstream `src/dom/index.ts` 복사                                                                     |
| `__tests__/invariants.test.ts` · `dom.test.ts` | bun:test → vitest 치환 (`describe/test/expect` 동일, rAF fake 는 upstream `test/client-dom.ts` 이식) |
| 본 문서 §2                                     | 재grep 결과로 표 갱신 (freeze commit)                                                                |

Gate G0: vitest 이식 케이스 전부 PASS · `pnpm type-check` 0 (리뷰 probe 2026-08-30: upstream core 8 + dom 1 을 `tsconfig.app.json` 으로 tsc → 오류 0 — ambient `declare` 가 module scope 라 `lib: DOM` 과 충돌 없음) · eslint 오류 0 · Prettier 재포맷 후 테스트 동일.

### Phase 1 — `MorphIcon` + 이름 캐시

| 파일                           | 변경                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iconNodes.ts`                 | `getIconData` → IconNode, `Map<string, IconNode>`; 미존재 이름은 `null` (렌더 0, dev 경고)                                                                                                                      |
| `MorphIcon.tsx`                | `useState(() => canonicalD(initial))` 1회 · `useLayoutEffect` mount `createMorph` · `icon` 변경 effect `morphTo` · unmount `destroy`. controlled(`from/to/progress`)·imperative handle 제거                     |
| `__tests__/MorphIcon.test.tsx` | reducedMotion 기본 `user` (upstream driver 기본은 `never`, `dom/index.ts:166`) · 같은 이름 재렌더 시 `morphTo` 0회 · unmount 후 rAF 0 · React StrictMode 이중 mount 후 live driver 1개 (cleanup `destroy` 보존) |

Gate G1: 초기 chunk Δ ≤ +10KB gz (`vite build` 산출 비교, ADR-196 방법) · 같은 이름 참조 동일성 테스트.

### Phase 2 — `StateIcon` + 레지스트리 + 교체 11곳 (§2-2)

| 파일                              | 변경                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `statePairs.ts` · `StateIcon.tsx` | §3-3 / §3-4                                                                                             |
| `__tests__/statePairs.test.ts`    | 모든 pair 양끝 `getIconData` 존재 · `buildPlan` 항목 θ/σ 유한 · index 0 ≠ index 1                       |
| §2-2 #1~#5, #7~#12 (10 파일)      | 삼항 → `StateIcon`. `TransformSection` 은 lock/unlock → `lock` 쌍 (keyhole)                             |
| §2-2 #6 `ContextualActionBar.tsx` | 순서 제약 해제 — ADR-192 completed (`docs/adr/completed/192-contextual-action-bar.md`, 2026-08-30 확인) |
| `FrameElementTree.tsx:270`        | `isExpanded` 가 있으므로 `expand` 쌍으로 승격 (CSS 회전 없음 확인됨)                                    |

Gate G2: statePairs 테스트 PASS · type-check 0 · 교체 파일 기존 테스트 PASS (`RuleRow` / `ItemsManager` / `ResponsiveVisibilityEditor` 등 existing) · **신규 static 게이트 유지** (`actionIcons.static.test.ts` · `propertyFieldIcons.static.test.ts` · `sectionHeaderIcon.static.test.ts` PASS) · 등재 쌍이 같은 화면의 필드 아이콘과 그림이 겹치지 않음 (§2-3 정본 경계) · **Live Exercise** (§6).

### Phase 3 — 확장 후보 (§2-3, 확인 필요 해소 후)

| 순서 | 항목                        | 선행 확인                                                                                                                 |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 3-a  | inset · step · ai · compare | 상태 prop 이미 존재 — 레지스트리 추가 + 교체. `inset` 은 custom `SquareOff` 소비자 0 확인 후 삭제 판정 (사용자 승인 필요) |
| 3-b  | view                        | `layout-grid → list` σ≈0 subpath 3개 시각 확인 — 미달 시 미등록                                                           |
| 3-c  | save                        | 배치 위치 결정 (현재 아이콘 없음) — 미결정이면 미등록                                                                     |

Gate G3: 추가 pair 마다 statePairs 테스트 + live 1회 + §2-3 정본 경계 확인. 각 항목 독립 판정 — 미달이면 해당 항목만 제외 (짝 강제 금지). 제외 5건은 재판정 근거가 §2-3 에 기록돼 재검토 대상 아님.

## 5. 테스트 계획

| 층          | 대상                                                            | 도구              |
| ----------- | --------------------------------------------------------------- | ----------------- |
| 수학 불변식 | invariants 1~11 (θ 90° emergent, 전사 매칭, 정지 정확성, NaN 0) | vitest (이식)     |
| driver      | settle → canonical d, seek 결정성, singleton rAF 0 timer        | vitest + rAF fake |
| 레지스트리  | 양끝 존재 · plan 유한 · off≠on                                  | vitest            |
| 컴포넌트    | reducedMotion 기본, morphTo 횟수, destroy                       | RTL               |
| 번들        | 초기 chunk Δ                                                    | `vite build` 비교 |
| live        | §6                                                              | Chrome MCP        |

## 6. Live Exercise 시나리오 (Implemented 승격 조건)

1. Styles › Transform 에서 aspectRatio 잠금 토글 — lock-keyhole-open → lock-keyhole 고리 회전, 정지 후 lucide 원본과 동일 (DOM `d` 가 canonical 4자리 문자열).
2. Action Bar 옵션 메뉴 Pin — 메뉴 열린 채 토글, 14px 에서 슬래시 생성 확인.
3. Settings Theme mode light → dark → auto — sun ↔ moon, auto 는 `matchMedia` 결과 쪽으로 정착.
4. OS `prefers-reduced-motion: reduce` (macOS 손쉬운 사용 › 동작 줄이기) 켜고 1~3 반복 — 프레임 0, 즉시 교체.
5. Performance 패널로 토글 중 rAF 1개 · 정지 후 0 확인.

## 7. 비스코프 / 후속

- canvas (Skia) · Preview · Publish 의 사용자 요소 `Icon` — 미적용 (사용자 결정). 나중에 D3 transition 채널로 다루려면 별도 ADR (Skia write adapter + 대칭 검증 필요).
- lucide-react 컴포넌트 기반 `ActionIcon` 타입 (`actionIcons.ts`) 과 속성 필드 정본 (`propertyFieldIcons.ts`) — 둘 다 존속. 본 ADR 은 상태 쌍 축만 추가한다 (§3-5 정본 경계).
- enum 전환 (breakpoint 3종 등) 은 `MorphIcon` 직접 사용 가능하나 본 ADR 에서 교체 대상 없음.
- `svgToIcon` / `fitIcon` (비-24 그리드 아이콘 팩 재격자) — 사용자 문서 아이콘 데이터 경로라 비스코프.
