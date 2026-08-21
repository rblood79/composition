# NodesPanel tree item 인터랙션 상태 감사 — hover vs selected 판정

> 작성: 2026-08-21
> 대상: `apps/builder/src/builder/panels/nodes/NodesPanel.css` (498줄) ↔ `tree/LayerTree/LayerTreeItemContent.tsx` / `tree/LayerTree/LayerTree.tsx` / `builder/stores/selection.ts`
> 계기: "NodesPanel tree item 에 hover 효과를 넣는 것이 맞는가, 아니면 선택 시에만 active 를 표시하는 것이 맞는가" — UI/UX 관점 판정 + 타 빌더/디자인 시스템 상태 모델 리서치 요청
> 참조: VS Code Theme Color / Fluent 2 Tree / Carbon Tree view / Telerik TreeView / Figma·Photoshop 레이어 패널 / WCAG 1.4.11·1.4.13·3.2.7

## 결론

1. **hover 는 넣는 것이 맞다.** hover 와 selected 는 대체 관계가 아니라 서로 다른 정보를 전달한다. hover 를 생략한 트리/레이어 패널 사례는 조사 범위(디자인 시스템 4종 + 디자인 툴 2종) 안에 없다.
2. **진짜 문제는 hover 유무가 아니라 4-state 모델 붕괴**다. 현재 빌더는 hover 와 selected 가 같은 채널(배경 명도 + 1px outline)만 사용해 두 상태가 시각적으로 거의 구분되지 않는다.
3. **CSS 이중 선언으로 `.active` 의 배경이 실제로는 죽어 있다.** `NodesPanel.css:487` 이 specificity 로 `NodesPanel.css:25` 와 `:20`(hover) 을 모두 이긴다 — 선택된 행은 hover 반응도 사라진다.
4. **패널 → 캔버스 cross-highlight 가 미배선**이다. `selection.ts` 에 `hoveredElementId` / `setHoveredElementId` 가 정의돼 있으나 호출자 0건 (dead channel).

| 축                      | 실측                                                   |
| ----------------------- | ------------------------------------------------------ |
| hover 상태 채널         | 배경 명도 + outline 1px                                |
| selected 상태 채널      | 배경 명도 + outline 1px + inset shadow (accent 미사용) |
| 두 상태 배경 차         | `--bg-inset` 85% black ↔ 75% black (10%p)              |
| selection CSS 선언 개수 | 2 (`.active` + `[aria-selected="true"]`) — 상호 충돌   |
| hover-only 액션         | 1 (`.elementItemActions`, `:focus-within` 조건 없음)   |
| cross-highlight 배선    | 0 (store 필드/setter 존재, 호출자 0건)                 |

## 1. 조사 방법

- 코드는 저장소 실측 (`NodesPanel.css` 전문 + `LayerTreeItemContent.tsx` / `LayerTree.tsx` / `stores/selection.ts` grep).
- 외부 레퍼런스는 웹 검색 결과 기반. RAC / RSP 는 저장소 동봉 스킬 레퍼런스와 공식 문서 병행.
- specificity 판정은 계산으로 확정 (런타임 재현은 후속 live exercise 대상 — 본 문서 §5 참조).

## 2. hover vs selected — 판정 근거

| 상태     | 전달하는 정보                                | 수명                         |
| -------- | -------------------------------------------- | ---------------------------- |
| hover    | "이 행이 지금 포인터의 타겟이다" (조준 보조) | 일시적 (포인터 이탈 시 소멸) |
| selected | "지금 편집 대상이 이것이다" (앱 전역 상태)   | 지속 (포인터와 무관)         |

레이어 트리의 행 높이는 `--inspector-control-size` 기준으로 좁고 항목이 조밀하다. hover 를 제거하면 클릭 전 타겟 확인 수단이 사라져 오선택률이 올라간다. 특히 들여쓰기가 깊어질수록 인접 행과의 구분이 어려워지므로 hover 의 효용이 커진다.

## 3. 업계 표준 상태 모델

### 3-1. VS Code — 4-state 가 가장 명시적

| 상태                | 토큰                               | 조건                          |
| ------------------- | ---------------------------------- | ----------------------------- |
| hover               | `list.hoverBackground`             | 포인터 위치                   |
| focus (키보드 커서) | `list.focusBackground` + outline   | 트리가 active, 화살표 키 위치 |
| selected (active)   | `list.activeSelectionBackground`   | 선택 + 트리가 키보드 포커스   |
| selected (inactive) | `list.inactiveSelectionBackground` | 선택 유지, 포커스는 다른 곳   |

핵심 원리: **hover 는 중성 명도 채널, selected 는 색상(accent) 채널.** 같은 채널을 밝기만 달리해 쓰면 조합 상태(selected + hover)를 표현할 방법이 없어진다.

### 3-2. 디자인 시스템 4종

| 시스템   | 트리 상태 규정                                                                        |
| -------- | ------------------------------------------------------------------------------------- |
| Fluent 2 | 트리 아이템은 hover 시 인터랙티브 버튼을 노출 — hover 를 별도 상태로 문서화           |
| Carbon   | **선택된 자식의 부모가 접혀 있으면 부모가 selected 를 상속** — 컨텍스트 손실 방지     |
| Telerik  | hover(포인터) 와 focus(마우스·키보드로 스포트라이트됨) 를 별개 상태로 분리 문서화     |
| Spectrum | 모든 컴포넌트가 hover / down / focus / keyboard focus / disabled 를 4개 테마에서 지원 |

### 3-3. 디자인 툴 — hover 의 최대 효용은 cross-highlight

- **Figma**: 레이어 패널 hover → 캔버스에 해당 레이어 바운딩 박스를 파란 박스로 표시. Preferences 의 "Highlight layers on hover" 로 토글 가능.
- **Photoshop**: Hover layer bounds — 패널 hover 시 캔버스 하이라이트, 색/두께를 Preferences 에서 조정.

즉 레이어 패널의 hover 는 "행 강조" 만이 목적이 아니라 **패널 ↔ 캔버스 양방향 매핑을 눈으로 확인시키는 장치**다. 이 배선이 없으면 hover 효과의 가치가 절반으로 떨어진다.

### 3-4. WCAG 관점 — hover 와 selected 는 요구 수준이 다르다

| 기준                               | 적용                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SC 1.4.11 (Non-text Contrast)      | **selected 는 상태 표시이므로 인접 색 대비 3:1 필수.** hover 는 포인터가 위치를 알려주므로 3:1 미요구 |
| SC 1.4.13 (Content on Hover/Focus) | hover 로 노출되는 내용은 focus 로도 동일하게 도달 가능해야 함                                         |
| SC 3.2.7 (Visible Controls, AA)    | 진행에 필요한 컨트롤을 hover 뒤에 숨기면 안 됨                                                        |

접근성 쪽에서도 "selected 만 강한 채널을 쓰라" 는 같은 결론이 나온다.

## 4. 현재 빌더 실측 문제 6건

### F1 (CRITICAL) — selection CSS 이중 선언, `.active` 배경이 죽음

| 위치                 | 선택자                                                    | specificity | 배경                               |
| -------------------- | --------------------------------------------------------- | ----------- | ---------------------------------- |
| `NodesPanel.css:20`  | `.elementItem:hover`                                      | (0,2,0)     | `color-mix(--bg-inset 85%, black)` |
| `NodesPanel.css:25`  | `.elementItem.active`                                     | (0,2,0)     | `color-mix(--bg-inset 75%, black)` |
| `NodesPanel.css:487` | `.react-aria-TreeItem[aria-selected="true"] .elementItem` | (0,3,0)     | `--bg-muted`                       |

`isSelected` 는 RAC state 에서 온다 (`LayerTreeItemContent.tsx:82` → `:120` 의 `.active` 부착, `LayerTree.tsx:168` 의 `selectedKeys`). 따라서 `.active` 와 `aria-selected="true"` 는 **항상 동시에** 붙고, (0,3,0) 인 487 이 25 를 이긴다 — `.active` 의 배경은 적용되지 않고 `--bg-muted` 만 남는다.

부수 효과: 487 은 `:hover` (0,2,0) 도 이기므로 **선택된 행은 hover 배경이 전혀 바뀌지 않는다.**

### F2 (HIGH) — hover 와 selected 가 같은 채널

hover = 배경 85% black + `outline 1px --border-hover`, selected = 배경 75% black + `outline 1px --border-pressed` + `inset-shadow-sm`. 명도 10%p 차 + 테두리 색 차이뿐이며 accent 채널을 쓰지 않는다. selected 가 SC 1.4.11 의 3:1 을 만족하는지도 불확실하다.

### F3 (MEDIUM) — hover 에 outline 1px

조밀한 리스트에서 행마다 테두리가 켜졌다 꺼지면 시각 노이즈가 크다. 업계 표준은 hover = 배경 tint 단독. 게다가 `NodesPanel.css:14-16` 의 `transition: outline 0s ease` 로 즉시 전환돼 튀는 느낌이 난다.

### F4 (HIGH, 접근성) — hover-only 액션

`NodesPanel.css:150-152` — `.elementItemActions` 가 `.elementItem:hover` / `.elementItem.active` 에서만 `translateX(0%)`. drag handle·삭제 버튼이 터치·키보드 사용자에게 도달 불가. `:focus-within` 조건이 없어 SC 3.2.7 / 1.4.13 위반 소지.

### F5 (HIGH) — 패널 → 캔버스 cross-highlight 미배선 (dead channel)

`builder/stores/selection.ts:24, 44, 98, 234` 에 `hoveredElementId` / `setHoveredElementId` 가 정의돼 있으나 **`setHoveredElementId` 호출자 0건**. 캔버스 hover 는 별도 로컬 ref (`workspace/canvas/hooks/useElementHoverInteraction.ts` 의 `hoverStateRef`) 로 처리돼 store 를 경유하지 않는다.

메모리 `feedback-infra-exists-vs-wired-consumption-path` (인프라 존재 ≠ 가동 경로) 와 동일 유형. §3-3 기준으로 레이어 패널 hover 의 최대 효용이 빠져 있는 상태다.

### F6 (LOW) — 접힌 부모의 선택 상속 없음

Carbon 가이드(§3-2)의 "선택된 자식의 부모가 접혀 있으면 부모가 selected 를 상속" 규정이 현재 트리에 없다. 부모를 접으면 선택 표시가 화면에서 사라져 컨텍스트를 잃는다.

## 5. 권장 상태 모델

| 상태                | 채널                                                        | 현재 대비                      |
| ------------------- | ----------------------------------------------------------- | ------------------------------ |
| hover               | 배경 tint 만 (outline 제거), 120~150ms ease                 | outline 제거 + transition 추가 |
| focus-visible       | `outline: 2px var(--focus-ring)` inset                      | 현행 유지 (`:452`, `:463`)     |
| selected            | `--accent-subtle` 배경 + 좌측 2px accent bar + label `--fg` | accent 채널 신규               |
| selected + hover    | selected 배경을 한 단계 밝게                                | 현재 반응 없음 (F1)            |
| selected + inactive | accent bar 유지, 배경 채도 하향                             | 상태 자체 부재                 |
| drop-target         | 현행 유지 (`--accent-subtle` + focus-ring outline, `:186`)  | 변경 없음                      |

좌측 accent bar 를 도입하면 배경 tint(hover)와 채널이 완전히 분리되어 "선택 + hover" 조합이 자연스럽게 표현된다. 현재 outline 방식으로는 이 조합을 표현할 수단이 없다.

## 6. 우선순위 개선안

| 순위 | 항목                                                             | 대응 finding | 범위                    |
| ---- | ---------------------------------------------------------------- | ------------ | ----------------------- |
| 1    | `NodesPanel.css:487` 이중 선언 정리 — selection 채널 일원화      | F1           | CSS 단독                |
| 2    | selected 를 accent 채널로 이동 + hover 의 outline 제거           | F2, F3       | CSS 단독                |
| 3    | `hoveredElementId` 배선 — 패널 hover → Skia 오버레이 바운딩 박스 | F5           | store ↔ 캔버스 오버레이 |
| 4    | `:focus-within` 을 `.elementItemActions` 노출 조건에 추가        | F4           | CSS 단독                |
| 5    | 접힌 부모의 선택 상속 표시                                       | F6           | 트리 노드 계산 + CSS    |

SSOT 경계: 1·2·4 는 빌더 패널 전용 CSS 로 D3 catalog SSOT 영역 밖이다 (`.claude/rules/ssot-hierarchy.md` §3 — 빌더 chrome UI 는 캔버스 컴포넌트 시각 정본과 별개). 따라서 `/cross-check` 대상이 아니며 CSS 단독 변경으로 적용 가능하다. 3 은 store ↔ 캔버스 오버레이 배선이므로 live exercise 로 검증한다 (CLAUDE.md §완료 기준).

## 7. 미검증 항목 (후속)

- F1 의 specificity 판정은 계산 확정이나, **런타임에서 실제로 `--bg-muted` 가 그려지는지 Chrome MCP 로 1회 exercise 필요**. `PageTreeItemContent.tsx:65` 의 Pages 트리도 같은 클래스 구조를 쓰므로 동일 증상인지 함께 확인.
- selected 배경의 실제 대비비 (SC 1.4.11 의 3:1 충족 여부) 는 테마별 토큰 실측 미수행. light / dark 양쪽에서 측정 필요.
- `LayerTreeItemContent.tsx:258` 의 tab 아이템(`isTabSelected`)은 별도 selection 경로를 쓴다 — F1 의 이중 선언 영향 범위에 포함되는지 미확인.
