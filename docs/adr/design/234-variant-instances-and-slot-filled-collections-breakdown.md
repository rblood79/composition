# ADR-234 구현 상세 — 상태 변형 = origin 의 instance · 목록 = slot 을 채운 instance 자식

> 본문: [ADR-234](../234-variant-instances-and-slot-filled-collections.md)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-23 (AskUserQuestion 3문항 — 범위 · 기존 items · 숨기기):

1. **base / 응용**: 234 는 origin · instance · slot 의 **뜻** (base) 을 정한다. 229 (Tag 항목 템플릿) · 230 (상태 변형) · 233 (Tab 항목 템플릿 · Radio) 은 그 응용이며, 이들이 쌓은 "템플릿 read-through + 상태 overlay" 모델을 234 가 대체한다.
2. **schema 직교성**: 새 저장 필드는 canonical 노드의 `enabled?: false` 하나다 (Pencil format 과 같은 이름). 변형 노드는 기존 `type: "ref"` + `reusable: true` 조합 — 새 노드 종류 없음.
3. **선행 전제 역전 검증**: ADR-066 (Tabs `items` 가 정본) 은 **작성자가 채우는 목록에 한해** 역전된다 (사용자 선택 "데이터 바인딩만 items 유지"). 데이터 바인딩 목록은 RAC 의 `items` + render 함수 경로 그대로 — 그 경로에서만 항목 origin 이 템플릿이다.
4. **범위**: "전부, Phase 로 나눔" (사용자 선택) — ref 체인 → 변형 전환 → 목록 컨테이너 → 검증 · 이관.

## 2. 레퍼런스 실측 — Pencil `pencil-shadcn.pen` (2026-09-23)

| ID  | 사실                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `Tab Item/Active` (coMmv) = reusable frame (배경 · 그림자 · padding 6/12 · label). `Tab Item/Inactive` (QY0Ka) = `type: "ref"`, `ref: coMmv`, `reusable: true`, 덮어쓰기 `fill: []` · `effect: []` · label `fill`.          |
| P2  | `Tabs` (PbofX) = reusable frame, `slot: [coMmv, QY0Ka]`, **자식 0** (빈 틀). RAC 의 **TabList** 에 해당 (사용자 지적 — TabPanels 층은 Pencil 에 없다).                                                                      |
| P3  | `Tabs` instance (omDwd) = `ref: PbofX` + 자식 4 = Tab Item instance (Active 1 · Inactive 3), label 은 항목마다 `descendants` 로 덮어씀.                                                                                     |
| P4  | 변형 = 완성된 상태 origin 의 ref 가 문서 전체 규칙: Pagination Item/Default → Active · Sidebar Item/Default → Active · Radio/Unselected → Selected (`descendants: {점: {enabled: false}}`) · List Item/Unchecked → Checked. |
| P5  | 컨테이너 안쪽 slot 도 같은 방식: Card Action · Dialog 는 Card instance 가 `descendants: {slot 틀 id: {children: [...]}}` 로 Header/Content/Actions 를 채운다.                                                               |

## 3. 코드 사실 (2026-09-23, main `823b1757a`)

| ID  | 사실                                                                                                                                                                                                                                                                         | 위치                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 상태 변형 origin 은 default origin 의 **복제본** (자식도 복제, style/fills 비움) + `metadata.variant`/`variantOf`. seed 된 변형 31 중 `type: "ref"` 0 (seed 전수 실측).                                                                                                      | `apps/builder/src/builder/components/stateVariantOrigins.ts:126-165`                                                                                 |
| F2  | 변형 대상 = Button · ToggleButton · Link · Checkbox · Switch · Radio.                                                                                                                                                                                                        | `stateVariantOrigins.ts:45-55`                                                                                                                       |
| F3  | 변형이 두 leg 에 닿는 값은 root 의 관리 키 4 (`backgroundColor` · `color` · `borderColor` · `opacity`) 뿐 — padding · 자식 (label) 편집은 무시.                                                                                                                              | `apps/builder/src/builder/components/stateVariantResolution.ts:42-47,178-216`                                                                        |
| F4  | Preview 상태 채널 = 문서 `<style>` 의 `[data-state-origin][data-selected]…` 규칙 + `--co-*` 변수 inline.                                                                                                                                                                     | `stateVariantResolution.ts:304-350,352-`                                                                                                             |
| F5  | 항목 변형 (Tab/ListBoxItem/Tag Selected) 도 복제본. slot 은 "첫 칸 기본 · 둘째 선택" 역할 표로 쓰이고 root 에 있다 (tabs · taggroup root, listbox · gridlist root).                                                                                                          | `components/tabs/tabsTemplateOrigins.ts` · `components/taggroup/tagGroupTemplateOrigins.ts:163-165` · `components/listbox/listBoxTemplateOrigins.ts` |
| F6  | 목록 행은 `items` 데이터에서 만든 projection 가상 행 (Tab · Tag · ListBox).                                                                                                                                                                                                  | `workspace/canvas/scene/canvasSceneNode.ts:957,2183,2527`                                                                                            |
| F7  | Preview Tabs 는 `items` 로만 Tab 을 만든다.                                                                                                                                                                                                                                  | `packages/shared/src/renderers/LayoutRenderers.tsx:146` · `packages/shared/src/components/Tabs.tsx:290`                                              |
| F8  | Slot "+" = `items` 행 추가 (`collection-item`) 또는 Tabs 는 숨김 (`none`).                                                                                                                                                                                                   | `components/slotHostPolicy.ts:188-209`                                                                                                               |
| F9  | **ref → reusable ref 체인이 두 leg 모두 끊긴다** — 변형 자신 (ref → origin 1단) 은 해석되지만 그 변형을 가리키는 instance 는 `type: "ref"` 로 남고 origin props 소실 (probe 2026-09-23). Preview: master 가 ref 여도 그대로 씀. Canvas: `masterType !== "ref"` 로 명시 제외. | `apps/builder/src/resolvers/canonical/index.ts:144,170-178` · `canvasSceneNode.ts:2905-2918`                                                         |
| F10 | canonical 노드에 요소 숨김 필드 없음 (Pencil `enabled` 대응 0).                                                                                                                                                                                                              | `packages/shared/src/types/composition-document.types.ts:834`                                                                                        |
| F11 | descendants 덮어쓰기 3-mode (A props patch · B 교체 · C children 교체) — `enabled` patch 는 mode A 로 실을 수 있다.                                                                                                                                                          | `resolvers/canonical/index.ts:254-257,389-440`                                                                                                       |
| F12 | 조합 자식 ref 화 규칙 (229) · origin 대비 props diff 유틸이 이미 있다 — 변형 이관 diff 에 재사용.                                                                                                                                                                            | `components/originChildRefs.ts:69,396`                                                                                                               |
| F13 | RadioGroup origin 자식은 이미 `ref → component-radio` (233) — 목록 = instance 자식 모델의 기존 사례.                                                                                                                                                                         | `components/originChildRefs.ts:396` (seed 결과)                                                                                                      |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F13 재grep 일치 확인.
- 진단 RED 4 고정: (a) instance → 변형 ref 체인 두 leg (F9) · (b) 변형의 padding / label 색 편집이 두 leg 에 안 닿음 (F3) · (c) TabList instance 에 Tab instance 자식을 두면 두 leg 가 무시 (F6/F7) · (d) `enabled: false` 무시 (F10).
- 목록을 만드는 쓰기 경로 전수: 팔레트 · factory · AI tool (`items` 작성) · Pencil import · 데이터 바인딩 · 붙여넣기. 각 경로가 "정적 목록 → 자식" / "바인딩 → items" 중 어디로 가는지 표로 확정.
- 이관 대상 수식 확정: 문서당 변형 31 노드 재직렬화 + 정적 목록 `n` 항목 → ref 자식 `n` (항목당 추정 150~250 B) + slot 필드 이동 4.
- 이관 입력 실측 (review round 1 h1 · h2): (e) 변형마다 **이관 전 유효값** — default origin 유효값 + 230 관리 키 overlay 결과, 두 leg 각각 (관리 키 밖 raw 값은 목록으로만 남긴다 — 이관에서 버림) · (f) 변형 노드를 **직접** ref 한 사용자 노드 수 (root ref · 중첩 ref · descendants 안 ref) 와 그 `descendants` 키 · (g) 옛 변형 자식 id → origin 자식 id 대응표 (구조 경로 · `metadata.slotRole`) 와 대응 없는 경로 목록.
- 진단 RED 2 추가: (h) origin `{style:{color,padding}}` · 변형 `{style:{}}` 를 `diffPropsAgainstOrigin` 으로 옮기면 병합 후 color · padding 이 새로 나타남 · (i) 변형 자식 id 로 편집한 `descendants` 가 master 선해소 후 base 자식 id 에 안 닿음 (review round 1 반증 2건).

### Phase 1 — ref 체인 · `enabled` (G1)

- 두 해석기가 master 가 `type: "ref"` 면 그 master 를 먼저 해석한 결과를 master 로 쓴다 (깊이 상한 · 순환 감지 → broken ref 와 같은 경고 경로). Preview resolver 캐시 키에 체인 master 의 버전을 포함.
- `enabled?: boolean` — schema · 두 leg (Canvas scene 제외 · Preview 미렌더) · 레이아웃 제외 · descendants mode A patch · publish 렌더러도 존중 (publish 는 기능 링크 방침 — 필드 존중만). 값: 부재 = 상속 (체인 끝까지 부재면 표시) · `false` = 숨김 · `true` = 상속된 숨김을 풀고 표시. 조상 숨김은 자식 `true` 로 못 푼다 (subtree 전체 제외). ref 병합 `{...master, ...ref}` 가 부재를 상속으로 두므로 병합 규칙은 그대로이고, 판정 함수 하나 (`isNodeEnabled` — 체인 해석 결과의 `enabled !== false`) 를 소비자가 같이 읽는다 (review round 1 m3).
- patch 삭제 표기: props · style · descendants patch 의 값 `null` = 그 키 제거 (catalog 기본값으로 돌아감), `fills: []` = 채움 없음 명시, 키 부재 = 상속. 병합을 **두 연산으로 나눈다** (review round 2 h1): (1) `composePatches(earlier, later)` — patch 끼리 합칠 때. `null` 을 **보존**한다 (later 의 `null` 이 earlier 의 값을 덮고, later 의 값이 earlier 의 `null` 을 덮는다). descendants patch 스택 사전 합성 (Preview `resolvers/canonical/index.ts:349-359` · Canvas `canonicalRefResolution.ts:329-340` `getStackedDescendantPatch`) 과 상태 patch 겹침이 이쪽. (2) `applyPatch(resolvedBase, patch)` — 해석이 끝난 값 (origin 또는 체인 master 해석 결과) 에 적용할 때. `null` 키를 **제거**하고, 결과에 `null` 이 남지 않는다. root ref 병합 · descendants 최종 적용 (Canvas `canonicalRefResolution.ts:440-454` · Preview `index.ts:368` 이후) 이 이쪽. `mergePropsWithStyleDeep` (`adapters/canonical/instanceResolver.ts:35`) 는 두 연산으로 갈라 호출처마다 어느 쪽인지 정한다 — 한 함수에 null 정리를 넣지 않는다. 소비자 (Skia · DOM · layout) 는 `applyPatch` 결과만 받으므로 `null` 을 보지 않는다.
- BC: 필드 부재 = 표시 · 기존 문서에 `null` patch 값 0 (Phase 0 에서 확인, 있으면 의미 충돌이라 이 표기를 다른 sentinel 로 바꾼다) → 기존 문서 Δ0.

### Phase 2 — 상태 변형 = origin 의 instance (G2)

- 규칙: **origin = 가장 완성된 상태** (선택 가능한 항목 · 선택 컨트롤 = 선택 상태, 선택 상태가 없는 Button · Link = 기본 상태). 나머지 상태 = origin 의 `reusable` ref + 덮어쓰기 (props · style · fills · descendants · `enabled` 전부 — 관리 키 4 제한 폐지).
- 상태 → 변형 연결: 변형의 `metadata.variant` (상태 이름) 유지, `variantOf` 는 `ref` 로 대체. 선택 가능한 가족은 휴지 상태 변형 `unselected` 추가.
- 겹침 순서: RAC 는 상태가 동시에 켜진다 — 휴지(`unselected`) → selected → focus-visible → hover → pressed → disabled (뒤가 이김, 230 CSS 순서 계승).
- 전체 층 (root · descendants 같은 규칙, review round 1 m4): **origin → 직접 ref 한 변형 patch (있으면, 상속 층) → 실행 중 상태 변형 patch (위 순서) → instance 자기 patch**. "instance 자기 patch" = instance 노드에 저장된 키 (root props · style · fills · `enabled` · 자기 `descendants` 항목) — 체인 중간에서 상속된 값은 포함하지 않는다. 230 `stateVariantResolution.ts:182-197` 의 `instanceOwned` 판정을 이 정의로 바꿔 두 leg 가 같이 읽는다 (Canvas scene · Preview render props 함수). 작성자가 직접 ref 한 변형은 실행 중 상태에 진다 (RAC 계약).
- Canvas: 유효 상태 (selected · disabled — hover/pressed/focus 는 Preview 소관, ADR-150 A1 철회 판정) 로 변형 덮어쓰기를 scene 에 겹친다.
- Preview: RAC render props (`style` · `className` 함수 + children 함수로 상태 context 를 자손에 전달) 로 같은 덮어쓰기를 겹친다. 230 의 `<style>` 규칙 + `--co-*` 변수 채널과 `INDICATOR_FILL_CSS_VAR` 우회 (233 round 3) 는 대체 대상 — 대체 전후 결과 대조 후 제거.
- 이관 (시각 결과 보존, review round 1 h1 · h2):
  - diff = **유효값 차분** `diffEffective(target, originEffective)` — target = Phase 0 (e) 의 이관 전 유효값. 다른 키는 target 값, origin 에만 있는 키는 `null`, fills 가 target 에 없고 origin 에 있으면 `[]`. F12 `diffPropsAgainstOrigin` 은 "복제본에 있는 키만" 비교하므로 재사용하지 않는다 (h 반증).
  - origin id 고정: 선택 가능한 가족은 **기존 default origin 노드 (사용자 instance 가 ref 하는 id) 를 그대로 두고 내용만** 선택 상태 (기존 default + selected overlay 유효값) 로 다시 쓴다. 자식 id 도 유지 → 기존 instance `descendants` 키 Δ0. 기존 default 모양은 새 `unselected` 변형 (ref → origin + 유효값 diff) 이 가진다. 옛 `--selected` 복제본은 origin 과 같은 상태가 되므로 제거하고, 그것을 직접 ref 한 노드는 origin 으로 대상 교체.
  - 변형 자식 id: 옛 복제본 자식 id (`${variantId}__n`) → origin 자식 id 대응표 (Phase 0 (g)) 로 변형을 직접 ref 한 노드의 `descendants` 키 (root ref · 중첩 ref · descendants 안 ref) 를 옮긴다. 대응 없는 경로가 하나라도 있으면 그 가족 전체 보류 (부분 이관 없음).
  - 관리 키 밖 raw 값 (230 이 무시하던 변형 padding 등) 은 target 에 없으므로 diff 에 들어가지 않는다 — 이관이 새 모양을 켜지 않는다.

### Phase 3 — 목록 = slot 을 채운 instance 자식 (G3)

- slot 위치: 항목을 직접 담는 목록 틀 — TabList · TagList · ListBox · GridList · Menu. 값 = 항목 origin (추천 목록 — 역할 표 아님).
- 컨테이너 instance 의 목록 틀 자식 = 항목 origin 의 instance (label 등은 descendants). Slot "+" = 항목 instance 삽입. Tabs 는 Tab `id` 로 TabPanel 을 짝지어 함께 만든다 (RAC `id` 짝 규칙).
- Canvas: 정적 목록은 실제 자식 노드를 그린다 (projection 가상 행은 바인딩 목록 전용으로 축소). Preview: RAC static children (`<TabList><Tab id>`) 로 렌더.
- 바인딩 목록: `items` + 항목 origin 템플릿 (RAC `items` + render 함수) 그대로 — 행마다 상태 변형 규칙은 Phase 2 와 같다.
- 이관: 정적 `items` → 항목 instance 자식 1회 (hydration) · 바인딩 목록 무변경 · slot root → 목록 틀 이동.
- 쓰기 경로 (Phase 0 표) 를 새 모델로 — AI tool 의 정적 목록 작성 포함.

### Phase 4 — live · 성능 · BC · 문서 (G4 · G5)

- live (Skia · store · IndexedDB): Components 페이지에서 origin 편집 → 변형 노드 · 문서 instance 동시 반영, 변형의 padding/label 편집 → 해당 상태 항목만, TabList instance "+" → Tab + TabPanel, reload 보존. Preview 는 사용자 지시가 풀리기 전까지 renderer unit + 사용자 확인.
- 성능 A/B (233 G3 조건 계승): 정적 목록 자식 노드화의 `scene.build` · Preview 상태 전환 (hover) 재렌더 비용.
- BC: 이관 전후 Canvas 픽셀 동일 (변형 · 목록) · 재hydration Δ0.
- 문서: 066 · 148 · 229 · 230 · 233 에 "일부 결정은 ADR-234 가 대체" 안내 · README · CHANGELOG.

## 5. 파일 경계 (예상)

| 영역              | 파일                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| schema            | `packages/shared/src/types/composition-document.types.ts`                                                           |
| ref 체인          | `apps/builder/src/resolvers/canonical/index.ts` · `workspace/canvas/scene/canvasSceneNode.ts`                       |
| 변형 seed · 이관  | `components/stateVariantOrigins.ts` · `stateVariantResolution.ts` · `originChildRefs.ts` · 항목 template origin 3종 |
| Preview 상태 채널 | `preview/components/CanonicalNodeRenderer.tsx` · shared wrapper (Tabs · TagGroup · ListBox · GridList · Menu)       |
| 목록 · slot       | `components/slotHostPolicy.ts` · `FrameSlotSection.tsx` · `canvasSceneNode.ts` projection · `LayoutRenderers.tsx`   |
| 쓰기 경로         | factory · AI tool · Pencil import (Phase 0 표 확정)                                                                 |

## 6. 중단 기준

- ref 체인 해석이 두 leg 중 한쪽에서 캐시 무효화 계약을 깨면 (편집이 체인 끝 instance 에 안 닿음) Phase 1 에서 중단 · 보고.
- 이관 전후 Canvas 픽셀이 다르면 해당 가족 이관 보류.
- 자식 id 대응표에 대응 없는 경로가 있으면 해당 가족 이관 보류 (부분 이관 금지).
- 기존 문서에 patch 값 `null` 이 이미 있으면 삭제 표기를 다른 sentinel 로 바꾸고 본문 개정 (Phase 1 착수 전).
- RAC render props 가 특정 wrapper (internal renderer) 에서 상태를 자손에 못 넘기면 그 컴포넌트는 Phase 2 보류 (230 채널 유지) · 보고.
- `scene.build` p95 +1 ms 초과 → 자식 노드화 캐시 가설 재측정, 못 닫으면 보고.

## 7. 실행 기록

### Phase 0 — G0 inventory freeze (2026-09-23, 기준 `66480f5e0`)

- **F1~F13 재grep**: 일치. 라인 이동만 있음 (F6 TabList projection `canvasSceneNode.ts:2519` · F9 Canvas 제외 `:2905`). 정정 2건:
  - **F6 정정** — Canvas 는 TabList 의 ref 자식 (`Tab` instance) 을 **이미 일반 scene 자식으로 실체화**한다 (진단 (c) Canvas GREEN — `adr234Diagnostics.test.tsx` 기준선). Preview 만 `items` 로만 그린다. 그림 모양 (Tab 행 규칙 · 선택 표시) 은 Phase 3 G3.
  - **F9 보강** — Canvas 는 1단 체인 (instance → 변형 → origin) 의 **root props 는** scene visit 의 ADR-228 merge 덕에 받지만 **자식은 잃는다** (`sceneChildrenByParent(instance) = []`). Preview 는 root 부터 `type: "ref"` 로 남는다.
- **seed 전수 probe** (`ensureReusableCompositeOrigins`, 로컬 evidence `docs/adr/evidence/234-g0-inventory-probe.json`):
  - 변형 **31 = 230 상태 변형 28** (Button · Link = disabled/hover/pressed/focus-visible 4 · ToggleButton · Checkbox · Switch · Radio = selected 포함 5) **+ 항목 템플릿 selected 3** (Tab · ListBoxItem · Tag). 항목 템플릿 default 4 (Tab · ListBoxItem · GridListItem · Tag) 는 origin 쪽. `type: "ref"` 0.
  - 230 변형 28 = 관리 키 값 0 · fills 0 · 관리 키 밖 style 키 0 · 자식 구조 경로 = default 와 전부 일치 (복제). 항목 템플릿 selected 는 독립 노드 — Tab · Tag = `_isSelected: true` 만 다름, ListBoxItem selected = `backgroundColor: var(--accent-subtle)`.
  - 변형을 **직접 ref 한 노드 0** · 저장된 patch 값 `null` **0** (props · descendants).
  - slot 보유자 4 = 전부 root (`component-tabs` · `component-listbox` · `component-gridlist` · `component-taggroup`).
  - 정적 `items` 보유 (seed origin): Tabs + TabList (2) · TagGroup + TagList (4) · ListBox (3) · GridList (3) · Menu (3) — 234 범위. 범위 밖 Breadcrumbs · Select · ComboBox · Table 은 유지.
  - 항목 instance 자식 직렬화 실측 **170 B (Tab) · 174 B (Tag)** — 추정 150~250 B 안.
- **`null` 뜻 판정**: 소비자 (React style · `readOwnedManagedKeys` · Skia `?? 기본값`) 는 이미 `null` 을 "값 없음" 으로 읽는다 → `applyPropsPatch` 가 `null` 을 지워도 기존 렌더 결과 Δ0. 새 뜻은 patch 합성 경로에서만 생긴다 (§6 sentinel 교체 불필요).
- **진단 RED 6**: (a) 체인 Preview `type 'ref'` · Canvas 자식 0 · (b) 변형 paddingLeft 30 → projection `undefined` · (c) Preview DOM Tab 0 (Canvas 는 GREEN) · (d) 두 leg 숨김 무시 · (h) `diffPropsAgainstOrigin({style:{}}, {style:{color:red,padding:24}})` = `{}` → 병합 후 red/24 되살아남 (probe 재현) · (i) 변형 자식 id descendants 유실 (Codex round 1 probe `/private/tmp/adr234-review-probe.log` 재현 기록 — h2 수리 계약 "origin id 고정" 이 대상).
- **목록 쓰기 경로 표** (정적 `items` 를 쓰는 곳 — 바인딩 경로는 `props.dataBinding` 만 쓰고 `items` 는 읽기 전용):

| 경로                     | 위치                                                                                                                                                                                                                                                               | 대상            | Phase 3 처리                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------- |
| origin seed · repair     | `catalogOrigins.ts:140,253,345` · `tabsTemplateOrigins.ts:130` · `tagGroupTemplateOrigins.ts:200` · `listBoxTemplateOrigins.ts:187` · `gridListTemplateOrigins.ts:113` · factory `LayoutComponents.ts:8` · `GroupComponents.ts:277` · `NavigationComponents.ts:11` | 5종 origin      | origin 목록 틀에 항목 instance 자식 seed                          |
| 전파 복사                | `propagationRegistry.ts:653,1040` (Tabs → TabList · TagGroup → TagList `override:true`)                                                                                                                                                                            | Tabs · TagGroup | 정적 목록은 자식이 정본 — 복사 대상에서 제외                      |
| 배치 (팔레트 · AI)       | `useElementCreator.ts:188` `buildReusableInstanceProps` → ref `props = {}`                                                                                                                                                                                         | 5종             | instance 는 origin 자식을 상속 (+ 는 instance 자식 추가)          |
| Properties items-manager | `ItemsManager.tsx:421-503` → `stores/elements.ts:2291-2450` (resolved props 를 읽어 instance override 로 fork) · binding `ListBox:34 · GridList:22 · TagGroup:23 · Menu:22` (Tabs 없음)                                                                            | 4종             | 정적 목록은 자식 편집으로 — items-manager 는 바인딩 목록 전용     |
| Slot "+"                 | `FrameSlotSection.tsx:187-217` + `slotHostPolicy.ts:188-209` (TagGroup `collection-item` · Tabs `none`)                                                                                                                                                            | TagGroup · Tabs | 항목 instance 삽입 (Tabs 는 TabPanel 짝)                          |
| detach · reset           | `instanceActions.ts:759,912`                                                                                                                                                                                                                                       | 5종             | 자식 실체화 규칙 그대로                                           |
| 붙여넣기 · 복제          | `multiElementCopy.ts:299,354,409` (plain 은 `items` 그대로 · 같은 item id)                                                                                                                                                                                         | 5종             | 자식 복제는 id 재발급 (TabPanel 짝 id 는 항목 `props.id` 라 유지) |
| AI tool                  | `toolValidation.ts:10` → `manifest.ts:83-97` — `items-manager` 필드 `unsupported-field` (AI 는 `items` 를 못 쓴다) · `bindCollection` = `dataBinding` 만                                                                                                           | —               | 변경 없음 (정적 항목 작성 tool 은 범위 밖으로 기록)               |
| Pencil import            | `pencil-adapter.types.ts:263` 일반 매핑 (전용 경로 없음)                                                                                                                                                                                                           | —               | 자식 모양이 그대로 들어온다                                       |
| hydration                | `mainDocumentNormalization.ts:30-40` · `createInitialProjectDocument.ts:31` (seed/repair 호출) · `migrateCollectionItems.ts` (테스트 전용)                                                                                                                         | 5종             | Phase 3 이관 지점                                                 |

조사 부산물 (Phase 3 에서 확인): FrameSlotSection "+" 가 raw canonical props 로 `items` 를 읽어 TagGroup **ref instance** 에서 상속 목록을 버릴 수 있다 (store `addItem` 은 `elements.ts:530` 에서 resolved 로 수리된 같은 계열 — runtime 미확인) · Tabs `items` 는 seed 뒤 편집 경로 0 · items-manager 가 TagList/TabList 복사본을 갱신하지 않는다.

### Phase 1 — ref 체인 · `enabled` · patch 두 연산 (G1, 2026-09-23)

- patch 두 연산 (`adapters/canonical/instanceResolver.ts`): `composePropsPatches` (= 종전 merge, `null` 보존 — descendants 스택 `canonicalRefResolution.ts` `getStackedDescendantPatch` · 자식 ref 자기 patch 합성 · Preview `resolveNestedRefChild` · inspector 쓰기) / `applyPropsPatch` (merge 후 `null` 키 제거 — resolver root · descendants 최종 적용 · scene visit · 패널 유효값 · detach · origin 자식 ref 판정 · presentation commit · publish export).
- ref 체인: Preview `resolveChainMaster` (master 가 ref 면 먼저 해석 · 템플릿 치환은 체인 끝 · `_resolvedFrom` = 직접 master · metadata 는 체인 끝 origin 위 변형) · Canvas scene visit `resolveSceneRefChain` (type = 체인 끝 · props 접기) + `resolveCanonicalRefTree` `resolveRefElementChain` (자식 = 체인 끝 origin 자식, patch 소유자 스택 `[instance, 변형, …]`) · publish `resolveRefChainMaster`. 깊이 상한 8 · 순환 → broken ref 경로 (Preview 경고).
- `enabled?: boolean` (schema · Pencil import/export 필드): Preview resolver 가 자식 배열에서 뺀다 · Canvas scene 은 노드를 남겨 해석한 뒤 `pruneDisabledSceneNodes` (scene model 마지막 — layout · hit test 입력) · publish render model · descendants mode A patch 는 노드 필드로 (두 leg).
- unit: `adr234Phase1.refChainEnabled.test.ts` 11 + 진단 (a)(d) 4 GREEN · (b)(c) Preview `it.fails` 유지 (Phase 2 · 3). 원복 RED 11종 전부 RED (preview 체인 4 · canvas 소유자 스택 1 · scene 접기 2 · compose 가 null 제거 2 · apply 가 null 유지 4 · preview enabled 2 · canvas prune 2 · publish enabled 1 · publish 체인 1 · patch enabled 두 leg 각 1).
- 회귀: builder 7,170 pass / 5 fail (착수 전부터: adr113DescendantsGrepGate · factoryInlineDirtyBaseline · historyActions.static · AI componentCatalog · propertyFieldIcons.static) · shared 1,398 / 2 fail (착수 전부터: Modal placeable · generatedCssLoadInventory). 정적 게이트 2 갱신 (g6ParityCompletion `_resolvedFrom: directMaster.id` · instanceActions detach `applyPropsPatch`). type-check PASS.
- live: Phase 1 은 저장 모양을 바꾸지 않고 (변형은 아직 복제본 · `enabled` 저작 UI 없음) 해석 규칙만 넓혔다 — 사용자 경로가 이 규칙을 처음 밟는 Phase 2 (변형 = ref) 와 함께 Skia · store live 로 확인한다 (§4 Phase 4 live 항목).
