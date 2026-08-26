# Contextual Action Bar 벤치마크 — Photoshop (Desktop/Web/Elements/Illustrator) · Figma (Design/FigJam)

> 조사일: 2026-08-26
> 목적: ADR-016 §5.2 "Contextual Action Bar" 설계안을 승계하지 않고, 두 레퍼런스의 **현행 동작**을 다시 실측해 [ADR-192](../../adr/192-contextual-action-bar.md) 의 대안·위험 평가 근거로 고정한다.
> 선행 문서: [PHOTOSHOP_BENCHMARK.md](PHOTOSHOP_BENCHMARK.md) (2024-12-24, §2.1) — 본 문서가 갱신·대체. Figma 컨텍스트 메뉴 리서치는 [ADR-182 breakdown §0-1](../../adr/design/182-builder-context-menu-breakdown.md) 이 정본.
> 출처 접근 방법: Adobe helpx 는 2026-04-28 이후 데스크톱 페이지가 개요 1장으로 축약돼 컨텍스트별 액션 목록이 사라졌다. 액션 목록은 Elements 2026 페이지(2025-10-01, 동일 컴포넌트) + Illustrator 2025 커뮤니티 공지 + 서드파티 튜토리얼 3종으로 교차 확인했다. 웹 검색으로 도달 불가한 부분은 "미확인" 으로 남긴다.

## 0. 요약 (5줄)

1. **Photoshop 계열의 정의는 "선택에 붙는 바" 가 아니라 "캔버스 하단 중앙에 떠 있는, 선택에 따라 내용이 바뀌는 바"** 다. 선택 bounds 를 따라다니지 않는다. 좌측 핸들 드래그 이동 · ⋯ 메뉴 (Pin / Reset / Hide) · Window 메뉴 재표시 · 적격 선택이 없으면 자동 숨김이 4개 앱(Desktop/Web/Elements/Illustrator) 공통 계약이다.
2. **Photoshop 은 같은 액션을 두 표면에 미러링한다** — 바의 항목이 Properties 패널 하단 "Quick Actions" 에도 그대로 나타난다. 바를 숨겨도 기능은 패널에 남는다 = 바는 **단축 표면이지 유일 경로가 아니다**.
3. **Figma Design 에는 선택 기반 온캔버스 바가 없다.** UI2 는 상단 바 중앙에 선택 의존 도구(boolean / component / text 서식 / auto layout / mask) 를 노출했고, UI3(2024-06 → 2025-04-30 강제 이관) 는 그것을 하단 플로팅 툴바의 서브메뉴 + 우측 패널 + Actions(⌘K) 로 분산했다. 포럼 반응은 "contextual tools should be visible, not hidden" (클릭 비용 증가) 과 "플로팅 툴바가 캔버스를 가린다" (dock/이동/숨김 요청 188 답글, 9,262 조회, 공식 변경 없음) 두 갈래.
4. **선택에 붙는 바는 FigJam 에만 있다** (스티키 선택 시 색·텍스트 서식·작성자 토글). 다중 선택 시 색상 피커는 2색까지만 표시 — 다중 선택에서 값이 갈리는 컨트롤을 어떻게 접는지의 실례.
5. composition 에 대한 함의: (a) 위치 모델은 Photoshop (하단 중앙 고정 + 이동/고정/숨김) 이 Figma UI3 의 실패 사례를 이미 회피한 형태다. (b) 액션 원천은 ADR-182 의 `canvasActions` + provider 레지스트리 재사용으로 "미러링" 계약을 공짜로 얻는다. (c) 선택 bounds 추적 (RAF·zoom/pan 재계산) 은 필요 없다 — TextEditOverlay 류의 bounds 구독은 쓰지 않는다.

## 1. Adobe — Contextual Task Bar

### 1-1. 연혁

| 시점    | 앱                         | 출처                                                                                                                                                                                                |
| ------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2023-06 | Photoshop desktop 24.5     | [teachucomp 튜토리얼](https://www.teachucomp.com/how-to-use-the-contextual-task-bar-in-photoshop-instructions/) — "Photoshop 24.5 or later"                                                         |
| 2023-09 | Photoshop on the web       | [Adobe Blog 2023-09-27](https://blog.adobe.com/en/publish/2023/09/27/photoshop-streamlines-power-precision-web) — "first introduced in June in Photoshop desktop", 좌측 가장자리를 잡고 드래그 이동 |
| 2024-10 | Illustrator 2025           | [커뮤니티 공지](https://community.adobe.com/t5/illustrator-discussions/contextual-task-bar-in-illustrator-2025-quick-actions-when-you-need-them/m-p/14082005)                                       |
| 2025-10 | Photoshop Elements 2026    | [helpx Elements](https://helpx.adobe.com/photoshop-elements/desktop/workspace-and-environment/contextual-task-bar.html) — 유일하게 컨텍스트별 액션이 문서화된 공식 페이지                           |
| 2025-07 | Photoshop desktop 2025.7   | Remove / 그라디언트 편집이 바에 추가 ([What's new 2025-7](https://helpx.adobe.com/my_ms/photoshop/using/whats-new/2025-7.html))                                                                     |
| 2026-04 | helpx 데스크톱 페이지 축약 | [boost-workflows 페이지](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/boost-workflows-with-the-contextual-task-bar.html) — 개요 4줄만 남고 컨텍스트별 목록 삭제           |

### 1-2. 공통 계약 (4개 앱 교차 확인)

| 항목             | 동작                                                                                                                                                                         | 확인 출처                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 기본 위치        | 문서 창 **하단 중앙**, 캔버스 위에 떠 있음. 선택 bounds 와 무관                                                                                                              | teachucomp, Elements, psdvault    |
| 이동             | **좌측 끝 핸들**을 드래그. 도킹 불가 (플로팅 전용)                                                                                                                           | Elements, Adobe Blog, asktimgrey  |
| ⋯ (More options) | 바 우측. `Pin bar position` (위치 잠금) / `Reset bar position` (기본 위치 복귀) / `Hide bar`                                                                                 | Elements, Illustrator, asktimgrey |
| 숨김/재표시      | 숨기면 재활성화 전까지 계속 숨김. `Window > Contextual Task Bar` 로 토글                                                                                                     | Elements, asktimgrey              |
| 자동 숨김        | "When no appropriate selection exists, the bar hides itself until an appropriate object is selected" — 적격 대상 없으면 바 자체가 사라짐 (빈 바 아님)                        | teachucomp, photoshopessentials   |
| 모달 워크플로    | Crop / Place / Transform 중에는 바가 **항상 표시**되고 그 워크플로의 확정 컨트롤 (Rotate/Flip + `Done`) 을 담는다. Photo project / Frame 은 더블클릭 진입 → `Done` 으로 커밋 | Elements                          |
| Properties 미러  | 레이어 선택 시 `Remove Background` 가 바와 Properties 패널 하단 **Quick Actions** 양쪽에 나타난다. 바를 숨겨도 패널 쪽은 유지                                                | photoshopessentials               |
| 활성 도구 연동   | 도구 전환(Type / Brush / Smart Brush) 이 바 내용을 바꾼다 — 선택뿐 아니라 **모드**가 컨텍스트                                                                                | psdvault, Elements                |
| 접근성/키보드    | 미확인 (공식 문서에 기재 없음)                                                                                                                                               | —                                 |

### 1-3. 컨텍스트별 액션 (문서화된 것만)

| 컨텍스트                  | Photoshop desktop/web                                                                                     | Elements 2026                                                  | Illustrator 2025                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 이미지 열림 / 픽셀 레이어 | Select Subject · Remove Background · (2025.7) Remove                                                      | Select Subject · Remove Background · Quick Actions (패널 열기) | 이미지: Image Trace · Retype · Crop Image · Embed/Link/Relink · Edit in Photoshop                |
| 선택 영역 활성            | Invert · Deselect · Feather/Contract 등 정제 · Fill Selection · Add Layer Mask · Generative Fill / Expand | Select Subject 후: Invert Selection · Deselect                 | —                                                                                                |
| 텍스트                    | Type 도구로 박스 생성 시 서식 (구체 목록 미확인)                                                          | —                                                              | 폰트 family/style/size · Fill · Area↔Point type · Outline · Type on path                         |
| 레이어 일반               | 블렌딩 모드 · 불투명도 · 레이어 스타일 ("mini-control panel")                                             | —                                                              | —                                                                                                |
| 그룹/다중                 | —                                                                                                         | —                                                              | Group · Ungroup · Isolate group · Align · Recolor · Clip Mask · Duplicate Object · Repeat Object |
| 패스/앵커                 | —                                                                                                         | —                                                              | Simplify · Smooth · Remove/Connect/Cut anchors · Corner↔Smooth                                   |
| 모달 (Transform/Place)    | —                                                                                                         | Rotate CW/CCW · Flip H/V · (Place: + Import) · `Done`          | —                                                                                                |
| 조정 레이어 (Curves 등)   | 바는 뜨지만 Remove Background 없음 — **적격성 필터**의 실례                                               | —                                                              | —                                                                                                |

관찰: 항목 수는 컨텍스트당 **2~5개**로 유지되고 나머지는 패널/메뉴로 넘긴다. Illustrator 그룹 컨텍스트(8개) 가 상한. 파괴적 액션 (Delete) 은 Elements Photo project 의 "Delete the photo" 외에는 바에 없다.

### 1-4. 비판·한계 (사용자 측)

- "a bit of a distraction" — 이미지 위를 덮음. 해법이 Hide 뿐이고 **도킹 불가** ([asktimgrey](https://asktimgrey.com/2024/03/27/hiding-the-contextual-task-bar/)).
- 바 실종 문의가 반복된다 ("contextual task bar missing", "lost remove background bar") — 자동 숨김 규칙과 Hide 상태가 사용자에게 구분되지 않는다. Window 메뉴 토글이 복구 경로.
- 컨텍스트별 항목 목록이 공식 문서에서 사라져 (2026-04) 사용자는 "무엇이 나올지" 를 앱 안에서만 학습한다.

## 2. Figma

### 2-1. Figma Design — 선택 의존 도구의 위치 변천

| 세대                                 | 선택 의존 도구가 있던 곳                                                                                               | 출처                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI2 (~2024-06)                       | **상단 바 중앙**: Boolean · Component 생성/스위치 · Text 서식 · Auto layout · Mask — 선택에 따라 바뀌는 상시 노출 버튼 | [포럼 "bring the top bar back"](https://forum.figma.com/suggest-a-feature-11/bring-the-top-bar-back-contextual-tools-should-be-visible-not-hidden-24663)   |
| UI3 (2024-06 베타 → 2025-04-30 강제) | 하단 **플로팅 툴바**의 아이콘 서브메뉴/⋯ 뒤로 이동 + 우측 Design 패널 + **Actions (⌘K)** + 우클릭 메뉴                 | [Figma UI3 approach](https://www.figma.com/blog/our-approach-to-designing-ui3/), [Actions 도움말](https://help.figma.com/hc/en-us/articles/23570416033943) |

- UI3 의 명시 원칙은 "canvas first — 작업을 중앙에, 방해 최소화". 베타의 **플로팅 패널**은 "작은 화면에서 캔버스를 압박하고 사람들을 느리게 했다" 는 피드백으로 철회, 정식판은 패널 고정 + Minimize UI 로 대체. 툴바만 플로팅으로 남았다.
- Actions (⌘K): AI 도구 · 생산성 액션 (collapse layers, frame selection, rename, select matching, rasterize, flip, detach…) · 에셋 검색 · 플러그인. **선택에 따라 항목이 달라진다** — 즉 Figma 의 "컨텍스트 액션" 은 검색형 팔레트에 흡수됐다.
- 선택 bounds 에 붙는 온캔버스 바는 **없다**. 선택 의존 컨트롤은 우측 패널이 담당.

### 2-2. 포럼 반응 (UI3 툴바)

- 가림: "it gets in the way of elements" · 듀얼 모니터에서 노트북 하단 가림 · Mac Dock 오발동.
- 시선 이동: 상단(메뉴) ↔ 하단(툴바) 왕복. "30년 관례 위반".
- 요청: dock/상단 이동 · 완전 숨김 (파워유저는 단축키만 씀) · 세로 배치 · View 메뉴 설정. **188 답글 / 9,262 조회 / 9개월, 공식 변경 없음** ([스레드](https://forum.figma.com/suggest-a-feature-11/allow-us-to-dock-move-the-new-ui3-toolbar-7861/index7.html)).
- 발견가능성: "contextual tools should be visible, not hidden" — 서브메뉴/⋯ 뒤로 숨긴 것이 다중 컴포넌트 작업의 클릭 비용을 올렸다는 지적. 스태프 답변은 "pass this onto our UI3 team" 뿐.

### 2-3. FigJam — 선택 툴바

- 스티키 1개 이상 선택 시 툴바 제공: 텍스트 크기/굵기/목록 · 색상 피커 · 작성자 이름 토글 ([도움말](https://help.figma.com/hc/en-us/articles/1500004414322-Sticky-notes-in-FigJam)).
- 다중 선택 일괄 편집 가능. **3색 이상 섞이면 피커는 2색까지만 표시** — 값이 갈리는 컨트롤의 축약 규칙.
- 위치(선택 상단 부착 여부)·추적 동작은 공식 문서에 기재 없음 — 미확인. Figma Slides 의 텍스트 플로팅 툴바도 미확인.

## 3. 패턴 비교

| 축                | Photoshop 계열                                 | Figma Design UI3                              | FigJam            | 016 §5.2 원안 (승계 안 함)                 |
| ----------------- | ---------------------------------------------- | --------------------------------------------- | ----------------- | ------------------------------------------ |
| 위치 모델         | 캔버스 하단 중앙 고정 플로팅, 선택과 무관      | 하단 플로팅 툴바 (도구 팔레트, 컨텍스트 아님) | 선택 부착 (추정)  | 선택 bounds 하단 8px 부착, zoom/pan 추적   |
| 선택 반응         | 내용 교체 + 적격 없으면 자동 숨김              | 우측 패널 + ⌘K 항목 변화                      | 선택 시 표시      | 선택 시 표시                               |
| 이동/고정/숨김    | 핸들 드래그 · Pin · Reset · Hide · Window 토글 | 불가 (최대 불만)                              | —                 | 없음                                       |
| 액션 원천         | 패널 Quick Actions 와 **동일 액션 미러**       | 메뉴/패널/⌘K 가 같은 커맨드 체계              | —                 | 신규 `builder/actions/` 계층 (182 와 중복) |
| 항목 수           | 컨텍스트당 2~5 (Illustrator 그룹 8 상한)       | 서브메뉴 뒤로 접음 (불만)                     | 3 그룹            | 태그별 3 + 공통 4                          |
| 파괴적 액션       | 배제 (Elements Photo project 예외)             | 배제                                          | —                 | 삭제 포함                                  |
| 모달 워크플로     | Crop/Place/Transform 중 상시 표시 + Done       | —                                             | —                 | 미고려                                     |
| 다중 선택 값 충돌 | —                                              | 패널 "Mixed"                                  | 색상 2개까지 표시 | 미고려                                     |

## 4. composition 현황 실측 (2026-08-26)

| 항목                        | 사실                                                                                                                                                                                                                                                              | 파일                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 공유 액션 계층              | ADR-182 가 추출한 9종: `copySelection` / `cutSelection` / `paste` / `duplicateSelection` / `deleteSelection` / `groupSelection` / `ungroupSelection` / `alignSelection` / `distributeSelection`. 컨텍스트 메뉴·단축키가 공동 consumer                             | `apps/builder/src/builder/workspace/canvas/actions/canvasActions.ts`                                                        |
| 메뉴 항목 정본 + 레지스트리 | surface → provider (`canvas-element` / `canvas-empty` / `layer-item`), T1 14항목 (복사·붙여넣기·복제 / z-order 4 / 그룹·해제·정렬▸ / 컴포넌트 토글·원본 이동·인스턴스 분리 / 삭제). 항목 스키마 `ContextMenuItem` (action/toggle/submenu/separator, `shortcutId`) | `components/overlay/contextMenu/types.ts`, `workspace/canvas/contextMenu/canvasContextMenuProviders.ts`                     |
| 단축키 레지스트리           | `SHORTCUT_DEFINITIONS` 69개 (scope `canvas-focused` 27 / `global` 18 등). `ShortcutTooltip shortcutId=` 로 표기 파생                                                                                                                                              | `config/keyboardShortcuts.ts`, `components/overlay/ShortcutTooltip.tsx`                                                     |
| 커맨드 팔레트               | ⌘K, `SHORTCUT_DEFINITIONS` 를 그대로 항목화 — Figma Actions 와 같은 "검색형 컨텍스트 액션" 자리는 이미 있음                                                                                                                                                       | `components/overlay/CommandPalette.tsx:106`                                                                                 |
| 선택 bounds 추적 인프라     | `getSceneBounds` / `subscribeBounds` (씬 좌표) + `viewportToScreenPoint(zoom, panOffset)` — TextEditOverlay 가 소비. 선택 부착형 바를 만들면 같은 경로                                                                                                            | `workspace/canvas/skia/renderCommands.ts:802`, `viewport/viewportTransforms.ts:27`, `workspace/overlay/TextEditOverlay.tsx` |
| DOM 오버레이 슬롯           | `Workspace.tsx:88` `.workspace-overlay` 빈 div (B1.5 예약) · 상단에 `WorkflowCanvasToggles` 플로팅 · `TextEditOverlay` 는 `BuilderCanvas.tsx:1483` 에 직접 마운트                                                                                                 | `workspace/Workspace.tsx`, `workspace/Workspace.css:323`                                                                    |
| 패널 좌표계                 | ADR-922/186: 패널은 9-zone placement coordinator 소유, `bottom` 도 일반 anchor. 캔버스는 패널이 차지하고 남은 local content rect 만 소비                                                                                                                          | `layout/panelWorkspaceLayoutV3.ts`                                                                                          |
| RAC Toolbar                 | `@composition/shared/components` `Toolbar` = RAC `Toolbar` 래퍼. HistoryPanel 이 사용 (`aria-label` + 화살표 탐색)                                                                                                                                                | `packages/shared/src/components/Toolbar.tsx`, `panels/history/HistoryPanel.tsx:327`                                         |
| 기존 016 설계안 잔존 코드   | 0건 (`ContextualActionBar` / `builder/actions/` 미존재)                                                                                                                                                                                                           | —                                                                                                                           |

## 5. ADR-192 입력 — 리서치가 고정하는 설계 제약

1. **위치 모델 후보는 2개뿐**: (P) Photoshop 형 하단 중앙 고정 플로팅 + 이동/Pin/Reset/Hide, (S) FigJam 형 선택 부착. Figma UI3 사례는 "이동·숨김 불가한 플로팅" 이 최대 불만이므로, 어느 쪽이든 **Hide + 재표시 경로 + 위치 리셋**은 필수 계약.
2. **액션은 새로 정의하지 않는다**: Photoshop 의 바↔Quick Actions 미러가 보여주듯 바는 기존 액션의 **부분집합 표면**이다. composition 은 ADR-182 provider 레지스트리가 이미 surface 확장 계약을 갖고 있어 (`후속 표면은 provider 등록 + 진입 리스너만으로 편입`), 바는 surface 하나를 더 등록하고 T1 의 부분집합을 고른다.
3. **적격 없음 = 바 없음**: 빈 바·disabled 나열 금지 (Photoshop 자동 숨김 + Figma "조건 미충족 숨김" 관례 일치, 182 노출 정책과 동일).
4. **항목 상한**: 컨텍스트당 5 이하 + ⋯ 오버플로 (Photoshop 2~5, 182 T1 14항목 전부를 바에 올리면 Figma UI3 "접힘" 불만을 재현).
5. **모달 워크플로 훅**: Photoshop 은 Crop/Place/Transform 중 바를 확정 컨트롤로 전환한다. composition 의 텍스트 편집 오버레이·드래그 중에는 v1 에서 **숨김**으로 두고, 182 의 `modeOverride` 훅과 같은 자리에 "모드가 바 내용을 교체" 를 예약한다.
6. **파괴적 액션 배제**: 두 레퍼런스 모두 바/툴바에 Delete 를 두지 않는다. 182 는 메뉴에 Delete 를 포함했지만 (Pen 모델, 최하단 격리) 바는 상시 노출 표면이라 오클릭 비용이 다르다.
7. **성능**: 위치 모델 P 는 프레임당 재계산이 없고 선택 변경 시에만 렌더 — Skia 프레임 예산과 무관. S 는 `subscribeBounds` + zoom/pan 마다 DOM 이동 (TextEditOverlay 와 같은 비용 구조).
