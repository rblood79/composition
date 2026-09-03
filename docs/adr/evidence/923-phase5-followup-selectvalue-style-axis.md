# ADR-923 Phase 5 후속 착수 4 — SelectValue 의 style 축만 read-only sub-part (2026-09-04 판정 A)

> 착수 순위 4 ([subpart-extension §5](923-phase5-followup-subpart-extension.md) "SelectValue 의 placeholder 텍스트 축 … style 은 DOM 미도달이지만 이번 판정에 넣지 않았다"). 결정 지점 (3) SSOT 경계 재판정 → AskUserQuestion → 사용자 판정 **A. style 축만 sub-part 로 확장**.

## 1. 사실 (착수 전 실측)

| 축         | DOM (production preview `rendererMap`)                                                                                                                | Canvas                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **텍스트** | **자식 우선** — `renderSelect` 는 `selectValueEl.props.children` (`SelectionRenderers.tsx:1152`), `renderComboBox` 는 `inputEl.props.placeholder` (`:1566`), SearchField 는 `FormRenderers.tsx:397` | 자식 props 를 그대로 읽는다                  |
| **style**  | **어디에서도 안 읽는다** — 위 세 렌더러에 `selectValueEl.props.style` / `inputEl.props.style` 참조 0건 (grep). 하니스 실측 (SearchField): 자식에 `fontSize 30 · marginTop 30` 을 얹어도 DOM 은 `14px` · `0px` 불변 | 자식 인라인을 그대로 먹어 **21 → 318** 로 부푼다 |

- 즉 사용자가 SelectValue 에 style 을 주면 Canvas 만 바뀌고 Preview 는 그대로다 — FieldError·Label·Input 과 같은 형태의 비대칭인데, 텍스트 축은 자식이 정본이라 **축이 갈린다**.
- 구조값 (`flex: 1` · `minWidth: 0` · fontSize · `nowrap`/`ellipsis`) 은 이미 implicitStyles selecttrigger 분기가 `cs.X ?? 기본값` 으로 read-through 주입한다 (`implicitStyles.ts` SelectValue 블록) — 인라인을 걷어내도 배치는 그대로다. factory 인라인 (`flex: 1, textAlign: "left"`) 은 그 중복이고, 좌측 정렬은 `buildCatalogShapes` 의 placeholder 정렬 규칙이 이미 준다.

## 2. 수리

- **shared 술어**: `STYLE_ONLY_SUBPART_PARENTS` (`SelectValue: [Select, ComboBox, SearchField]`) + `resolveSubpartStyleOwnerType(child, parent, grandparent?)` = 전체 sub-part owner ?? style 전용 owner (직계가 SelectTrigger 래퍼면 조부모로 hop). 기존 `resolveDelegatedSubpartOwnerType` 은 **그대로** — 텍스트 축 판정이라 SelectValue 를 잡지 않는다.
- **Canvas read 경로**: `readOnlySubpart.ts` 투영 함수와 Skia `buildSpecNodeData` sub-part 블록이 style owner 술어를 쓴다 → SelectValue 인라인 style 무시 (props·텍스트는 보존).
- **패널**: Styles 패널만 `useSelectedSubpartStyleOwnerType` 으로 전환 (owner 안내). Properties 패널은 `useSelectedSubpartOwnerType` 유지 → 값·Placeholder·Size 편집 그대로.

## 3. 게이트 · 원복 RED

- unit `adr923FieldErrorStateBridge.test.ts` +1: style owner 3 (Select·ComboBox·SearchField, SelectTrigger hop) · 같은 케이스에서 전체 sub-part 술어는 null · Skia junk == clean · 범위 밖 (SelectIcon · 조부모 frame) null.
- browser `adr923WrapperSubpartProjection.browser.test.ts`: JUNK_TARGETS 에 SelectValue 추가 + **SelectValue 상자를 측정 대상에 추가** (종전엔 root/Label/래퍼만 재서 junk 가 통과했다 — 공허한 GREEN) · junk == clean · DOM 값 상자와 높이 ±1.5.
- 원복 RED (layout·Skia 를 옛 술어로): browser 2 FAIL (`Select SelectValue junk == clean: '{"w":360,"h":18,"y":21}' vs '{"w":360,"h":21,"y":4.5}'` + 일반 sub-part 계약) · bridge 1 FAIL → 복원 GREEN.

## 4. 검증 · live

- type-check PASS · skia + engines + bridge unit 877 · full parity **1086 PASS** (기존 GridListItem·Tooltip 2 FAIL 동일).
- live (Compare 모드, tablet 뷰포트): 팔레트 Select 추가 → SelectValue 자식에 junk 8키 (`fontSize 30 · fontWeight 900 · marginTop 30 · padding 9 · width 50 · lineHeight 10`) 를 `updateElementProps` 로 주입 → **Canvas rect `[13,4.5,464,21]` 불변** · DOM `14px` · `marginTop 0px` 불변. 이어서 `children: "TEXT-EDIT-OK"` → **DOM 텍스트가 바뀐다** (텍스트 축 유지). 원복 후 값 복귀.
- live 패널: SelectValue 선택 시 Styles 패널 "부모에서 그리는 요소입니다 — SelectValue 의 스타일은 Select 의 디자인 규칙이 정합니다", Properties 패널은 값·Placeholder·Size 유지.

## 5. 곁가지 수리 (TailSwatch 팔레트 제거의 후행)

`6efd7ccfb` (TailSwatch 팔레트 제거) 이 팔레트 집합을 고정한 게이트 2개를 깨뜨렸는데 그 커밋에서 full parity 를 안 돌려 놓쳤다 — 본 커밋에서 같이 고쳤다: `adr923Dc6OverflowCapInventory` 의 `EXPECTED_FACETS` 에서 TailSwatch 행 제거 · `adr923Hc2DisplayJudgment` 의 `PREVIEW_LEG_TYPES` 에서 제거 (rect 대조는 `adr923Hc2ConversionRect` 가 트리를 직접 만들어 계속 잰다). **교훈**: 팔레트 노출을 바꾸면 팔레트 전수 게이트가 걸린다 — 팔레트 변경 커밋은 full parity 필수.

## 6. 범위 밖 (기록만)

- SelectIcon (`iconName`/`size`) 는 D2 편집 축이라 sub-part 아님.
- factory 의 SelectValue 인라인 (`flex: 1, textAlign: "left"`) 은 이제 완전한 중복 — 제거는 factory 정리로 별도.
