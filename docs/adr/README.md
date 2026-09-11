# ADR (Architecture Decision Records) 관리 대시보드

> **이 파일은 "지금 열려 있는 것" 중심 대시보드다.** 완료 ADR 의 상세는 각 `completed/NNN-*.md`
> 본문이 정본이고, 사용자-가시 변경의 정본은 [CHANGELOG](../CHANGELOG.md) 다.
>
> **2026-09-09 정리**: 이 파일이 3.6MB (표 패딩 3.2MB · 실내용 395KB) 로 불어나 읽히지 않았다.
> 쌓여 있던 세션별 갱신 공지 · 완료 ADR 비고 · 2026-04 기준 우선순위 계획 · 변경 이력은
> [archive/README-notes-2026-09.md](archive/README-notes-2026-09.md) 로 **무손실 이관**했다.
>
> **최종 대조**: 2026-09-10 — 아래 개수·상태·일자는 `docs/adr/**` 파일 실측이다.

---

## 현황

| 구분                      |    개수 |
| ------------------------- | ------: |
| 완료 (`completed/`)       |     229 |
| ├ Implemented             |     193 |
| ├ Accepted                |      13 |
| ├ Superseded              |      14 |
| └ Deprecated              |       9 |
| 열려 있는 것 (`adr/*.md`) |      13 |
| ├ Proposed                |      11 |
| ├ Accepted (일부 착수)    |       1 |
| └ 부분 완료               |       1 |
| **합계**                  | **241** |

`completed/` 에는 ADR 외에 Phase 0 baseline 4건과 참조 자료 1건이 함께 있다 (완료 절 끝 참조).
`adr/` 직속에는 ADR 이 아닌 레퍼런스 1건 (`react-skia-zustand-frame-performance-design.md`) 이 있다.

---

## 지금 열려 있는 것

### 진행 중 / 미구현 (Proposed / In Progress)

#### [213](213-data-tool-contract-propose-review-apply.md) — 데이터 tool 계약 — 읽기 tool · `propose_data_change` 승인 경로 · `bind_collection` 정정 · "왜 실패했지?"

- **상태**: Proposed (2026-09-11) — 리서치 Track 3 (AI · AX)
- **규모**: 읽기 tool 4 (`list/get_collections` · `list/get_api_endpoints`, secret 마스킹) + `get_editor_state` 요약 + 프롬프트 주입 예산 · 쓰기 tool 1 `propose_data_change(DataChange)` → `AgentCommandConfirmDialog` 스키마 diff 뷰 승인 → 152 적용기 → History 1 + 감사 로그 (delete 계열 없음) · `bind_collection` 을 `{collectionId}` 형상으로 정정 · `explain_request_failure` ("왜 실패했지?") · agent 명령 `data.*` 4 · 사람이 부르는 AI 3종 (설명으로 테이블 · 붙여넣기 이해 · 반복 편집). 스키마는 152 `dataChange.ts` 단일 소스 (Anthropic strict ↔ Ollama zod). Phase 0~~7 / R1~~R7 / G0~~G5, HIGH 0. **선행: 152 Phase 1c (Phase 1 읽기 tool 은 독립)** · ADR-202 에는 의존하지 않음 (착수 시 어댑터 편입 — 결정 지점 2 후보). design breakdown `design/213-data-tool-contract-propose-review-apply-breakdown.md`
- **우선순위**: P2 — 212 와 병렬 가능 (형제), 첫 출시 = Phase 1 + Phase 3

#### [214](214-variables-owner-model-runtime-state.md) — Variables 소유자 모델 — 프로젝트 · 페이지 · 요소 상태와 소비 경로

- **상태**: Proposed (2026-09-11) — 사용자 판정 ⑤ (2026-09-10, 전역 + 컴포넌트 지역 변수 · 런타임 wiring)
- **규모**: 소비처 0 인 Variables 에 역할 부여 — 모델 하나 (`VariableDef` + `VariableOwner` project/page/element), 저장은 소유자별 (프로젝트 = 기존 store · 페이지 · 요소 = canonical `state?` 필드, 삭제 · 복제 · origin/instance 자동), 가시성 = 소유자 서브트리 (이름은 사슬 안 고유), 읽기 `{{ name }}` (캔버스 기본값 env · preview 런타임 env 같은 해석기), 쓰기 `setState` 액션 (set/toggle/increment/reset), 암묵 RAC 상태 이름 붙이기, 관리 표면 3 (Data 탭 인덱스 · Navigator 페이지 설정 · Properties 상태 절). Phase 0~~6 / R1~~R7 / G0~~G4, HIGH 0. 152 와 직교 (base). design breakdown `design/214-variables-owner-model-runtime-state-breakdown.md`
- **우선순위**: P2 — 212 Phase 1 뒤 (Variables 탭 표면 공유), 213 후속 `list_variables` 는 범위 밖

#### [013](013-quick-connect-data-binding.md) — Quick Connect 데이터 바인딩

- **상태**: Proposed
- **규모**: **Risk-First 재작성 2026-07-16** (reviews round 1 반영 — stale 전제 7건 정정). Phase 0~~5 / R1~~R5 / G0~G3, HIGH 0. **ADR-152 선행 필수** (착수 조건 G0 = 152 Implemented + Phase 0 재-inventory). design breakdown `design/013-quick-connect-data-binding-breakdown.md`
- **우선순위**: **P3**

#### [150](150-rac-pencil-residual-interaction-execution.md) — RAC·Pencil 잔여 상호작용 실행 — ~~Skia hover/pressed 상태 threading~~(철회) + collection 가상화 스크롤 60fps + projected drill-in/data edit UI (ADR-912 후속 실행)

- **상태**: Accepted (전체) · **A1 철회 2026-07-20** · A2 delivered(시각 확인 대기) · A3 미착수
- **규모**: **Phase A1(Skia hover/pressed/focusVisible 상태 threading) 철회 2026-07-20 (재판정)** — 빌더(Skia)가 pointer 연동으로 hover/pressed/focus 를 실시간 재현한 것은 **D1/D3 경계 오판**(그 역할은 Preview DOM 소관, RAC 자동 소유). A1 커밋 4건 역순 revert(`5e635ebbc`), 편집 보조 hover outline·선언적 상태(selected/disabled) 시각은 보존. 911 R-4 HIGH→MED / G-state 를 선언적 상태 parity 로 재정의. **A2(collection 가상화)/A3(drill-in·data edit)은 상호작용 시뮬레이션이 아니라 빌더의 대용량 표시·깊은 편집이라 유효 — 진행 유지.** G-A2/G-A3 (HIGH 2: window 동기화 / projected id 경계 — G-A1/R1 은 철회). design breakdown `design/150-rac-pencil-residual-interaction-execution-breakdown.md`
- **우선순위**: 사용자 확정 2026-07-13 (AskUserQuestion — 단일 실행 ADR)

#### [162](162-gridlist-template-subtree-projection.md) — GridList 카드 템플릿 임의 자식 실체화 + row-data 동적 매핑

- **상태**: Proposed
- **규모**: 카드 = origin 템플릿 서브트리 행별 실체화(composed 판정 `isComposedCollectionTemplate` opt-in, slot-only BC 0%) + 카드 높이 formula→실측 전환(§1.55c/rowMetric/window stride 단일화) + escape gate + 패널 임의 자식 prop 오소링. **ADR-159 base 의존 재획정(2026-07-24 사용자 confirm)**: 보간·오소링·dataTable 단일화는 159 소비(제2 엔진 금지, P2←159 P1 / P5←159 P4 선행), 본 ADR 은 구조 축만. Phase 0~~6, R1 HIGH(카드 높이) / R2~~R5 / G1~G4. design breakdown `design/162-gridlist-template-subtree-projection-breakdown.md`
- **우선순위**: 사용자 제안 2026-07-24

#### [201](201-large-file-upload-engine-component-server-contract.md) — 대용량 파일 업로드 — 독립 전송 엔진 `@composition/upload` + FileUpload 컴포넌트 + Spring 서버 계약

- **상태**: Proposed — 2026-09-02
- **규모**: 실측 2026-09-01: 입력 UI(FileTrigger/DropZone/ProgressBar catalog)만 있고 전송 런타임·XHR·Supabase Storage 0건, `renderFileTrigger` 가 파일명을 문서 prop 에 기록(잘못된 채널), CAPABILITY_REGISTRY 미등재. FILE_UPLOAD.md 5종 비교 — Uppy(100KB+, catalog 밖 UI)/multipart 자체 프로토콜(표준 호환 0)/Rust wasm(I/O 병목·CSP)/shared 내장(외부 사용 불가) 기각 → TS sans-I/O 코어 + TUS 1.0 + 독립 package(esm/cjs/IIFE) + Spring 참조 서버(Java 8/Spring 5)·JSP 예제. 신규 의존 0, GB 힙 Δ≤64MB, tusd 대조군, 보안 공격 corpus G4
- **우선순위**: **P2** (ADR-194 다음)

#### [202](202-builder-ai-compiler-first-command-execution.md) — Builder AI compiler-first 명령 실행

- **상태**: Proposed — 2026-09-02
- **규모**: 단순 요청도 `useAgentLoop`가 Agent-first로 보내고 fallback `IntentParser`는 metadata만 남겨 mutation하지 않는 구조를 부분 개정. direct 생성·편집·command는 catalog/factory/ADR-196에서 파생한 closed typed IR로 provider·Agent 0회 실행, 모호한 요청은 one-shot LLM IR, 반복 설계만 bounded Agent. leaf/complex/reusable/composed recipe 4분류와 composite prop/slot routing, palette/human-path parity, offline/host-neutral 계약을 G0~~G6으로 고정. ADR-134 D1~~D5·D9~~D11 및 ADR-196은 유지하고 D6~~D8만 Accepted 시 부분 대체
- **우선순위**: **P1** (review 후 착수)

#### [910](910-rac-pencil-component-architecture.md) — RAC core + Pencil format 1차 원리 컴포넌트 아키텍처

- **상태**: Proposed — **비착수 비교 기록** (실행 owner ADR-912 Implemented)
- **규모**: 독립 설계 ADR (사용자 요청 2026-06-01 "기존 spec 무시, RAC core + Pencil 방법론으로 새로 설계"). RAC(data/render 분리 + 접근성 hooks) + Pencil canonical document format 을 1차 원리로 백지 재유도 → 대안 E(Canonical 문서 SSOT + RAC primitive binding) 채택. **정본: 컴포넌트 = 노드 데이터(base/override 2층)** — 노드는 의미값(content/variant/size)을 `props` 에, 사용자 시각 override(fontSize/fill/padding/gap)를 `props.style` 에 보유. 시각 base(컴포넌트 default)는 노드가 아니라 theme rule 에서 resolve. `props.style` = "사용자가 base 를 덮어쓴 키만 담는 override layer"(키 존재=override, 부재=base) — base/override 는 노드 간(origin↔ref.descendants) 분리(ADR-907 Layer B 보존, 평면화 철회). **단일 공급원** — Properties Panel·Style Panel·DOM·Skia·Publish 가 같은 노드 하나 + 같은 theme rule 을 읽음. 패널은 `resolveEditContract(node)`(의미∪`props.style` 계약 합집합) 결과를 `section` 태그로 필터링한 두 view(저장 평면화 불필요). leaf=`PrimitiveBinding` ~~35 / 조합=reusable 문서 / 등록=단일 `componentCatalog` / 렌더=generic 렌더러 1개(traversal 1 + DOM·Skia backend 2, `toReactStyle`/`toSkiaStyle` 단일 어댑터가 base⊕override 병합). 잔존 HIGH 8건(T-1 generic 공통기반 / T-3·T-ADAPT base⊕override backend 어댑터 / T-4 collection virtualization↔Taffy / T-7 Skia state / T-PARITY 기능 퇴보 방어 / **T-PROJECT·T-DEEP ADR-920 흡수 Interactive Projected Tree**) — 전부 Gate 1:1(G-parity/G8/G9 포함) + family 격리. **[ADR-920](completed/920-rac-format-interactive-projected-tree.md) 흡수·supersede (2026-06-02)**: 같은 외부 입력의 Codex 독립 설계 중 collection Interactive Projected Tree(깊은 노드 hit-test/drill-in/edit-route)를 HC#7 + breakdown §4.12/§5.11/§7-4/⑪ 로 흡수. behavior/page frame/data 축은 ADR-131/132/135/136 관할이라 bridge 참조만. 설계 산출물 ①~~⑩ + ⑪(920 흡수 경계) breakdown 동봉. design breakdown `design/910-rac-pencil-component-architecture-breakdown.md`. **문서 위상: 점진 cutover 전략의 비교 기록 (비착수)** — 사용자 옵션 B 결정(2026-06-02)으로 점진 cutover(legacy 격리)는 착수하지 않고, 실제 `execute-adr` 착수는 [ADR-912](completed/912-rac-pencil-rebuild-cutover.md)(백지 직행) 단독. 910 은 supersede 없이 점진 전략 비교 기록으로 유지. 같은 목표 구조의 비실행 목표 참조(Target Reference)는 [ADR-911](911-rac-pencil-target-component-architecture.md). 910=점진 cutover / 911=목표 자체 / 912=백지 직행(착수).
- **우선순위**: **P1**

#### [911](911-rac-pencil-target-component-architecture.md) — RAC core + Pencil format 백지 목표 컴포넌트 아키텍처 (비실행 목표 참조)

- **상태**: Proposed — **비실행 목표 참조** (execute-adr 대상 아님)
- **규모**: **비실행 목표 참조(Target Reference) / 백지 목표 아키텍처 설계서** (사용자 요청 2026-06-02 "서두 조건 Status/Context/HC/SC 기반으로 재작성 — 현재코드 수정 설계서 아님"). ADR-910 이 현재 124 spec / family cutover / 레거시 제거를 다루는 **전환(cutover) 실행 설계서**가 된 데 대해, 911 은 현재 코드를 참조하지 않고 **"조건을 만족하는 목표 구조가 정적으로 무엇인가"** 만 1차 원리(RAC core + Pencil format)로 유도한다. 같은 대안 E(Canonical 문서 SSOT + RAC primitive binding) 채택 — 목표 구조가 910/912 와 수렴하되 전략이 다름(910=점진 cutover / 911=목표 자체 / 912=백지 직행). **착수/execute-adr/phase 반영은 ADR-912(백지 직행, 유일 착수)로 진행하고(사용자 옵션 B 2026-06-02, codex review 라우팅 동기화), 911 은 912 실행 중 목표 구조 drift 를 판정하는 reference 로 사용한다.** HC 1~7 ↔ 목표 구조 1:1 증명(breakdown ⑨). Risks 는 **목표 성립 불확실성만**(R-1 generic 공통기반 / R-2 base⊕override 단일 어댑터 / R-3 Interactive Projected Tree 60fps+깊은노드 / R-4 Skia 상태모델) — 마이그레이션 축 N/A, 실행 위험(정합성 회귀 / 등록 collapse / 레거시 제거)은 912 보유. Gate 는 증명 게이트(G-slice/G-adapter/G-projected/G-state) — 실행 게이트는 912. design breakdown `design/911-rac-pencil-target-component-architecture-breakdown.md`.
- **우선순위**: **P1**

#### [921](921-render-scene-backend-integration.md) — RenderScene·Backend 통합 — CanvasKit 실행 기준과 Rust 다중 백엔드 경계

- **상태**: Proposed
- **규모**: **2026-08-26 기준선 갱신 필요** — 187~190 이후 §6-2 파일 대량 변경, Phase 0 재freeze. OpenPencil v0.8.4의 derived scene/shared backend 구조를 architecture reference로 채택하되 `CompositionDocument` SSOT와 현행 CanvasKit oracle을 보존하는 contract-first hybrid. Phase 0~~3 = baseline freeze → renderer-neutral snapshot/reference compiler → CanvasKit adapter dual-run → production cutover. Rust compiler/native/read-only SDK는 측정·제품 trigger와 별도 승인 후 조건부. R1~~R5/R7 HIGH를 G0~~G6으로 관리. design breakdown `design/921-render-scene-backend-integration-breakdown.md`
- **우선순위**: **P1**

### 부분 완료

#### [019](completed/019-icon-system.md) — 아이콘 시스템 — Icon 선택/변경/추가

- **완료 범위**: Phase A+B+C+D 완료 (C2 simple element 경로, C4 SelectIcon+ComboBox 연동, C5 ComboBoxEditor IconPicker)
- **미완료 범위**: Phase E (추가 라이브러리)
- **우선순위**: P4

#### [027](027-inline-text-editing.md) — Canvas Inline Text Editing

- **완료 범위**: Phase A+B+C 완료 (TextEditOverlay + Quill + 멀티페이지 + Spec 컴포넌트 텍스트 편집)
- **미완료 범위**: Phase D (리치 텍스트/툴바)
- **우선순위**: P4

#### [025](completed/025-s2-named-color-palette.md) — S2 Named Color Palette 확장

- **완료 범위**: Phase 1~3 완료 (named palette 토큰 + resolver + 컴포넌트 적용)
- **미완료 범위**: Phase 4 (Inspector UI) 미구현 — Status Accepted 유지
- **우선순위**: P4

#### [041](completed/041-spec-driven-property-editor.md) — Spec-Driven Property Editor 자동 생성

- **완료 범위**: Phase 0~4 전체 완료. S2 섹션 재분류(Content/Appearance/State/Locale). **Spec 97개, Generic 71개, Hybrid 2개, Custom 25개**. 에디터 34개 삭제. PropertySizeToggle non-indicator 모드 전환.
- **미완료 범위**: 잔여 Hybrid 2개(Tabs/Slider), Custom 25개 중 자동화 가능 에디터 검토
- **우선순위**: **P2**

#### [198](completed/198-d3-renderer-pixel-parity-gate.md) — D3 Renderer Pixel Parity Gate

- **완료 범위**: Phase 0~~5 로컬 완료 (production CanvasKit SW leg + 실제 Preview leg · 계층 비교 L0~~L4 + negative probe · ratchet · 경로-스코프 pre-push smoke 7.4s) — 결함 4건 발견 (프레임 배경/테두리 · accent 토큰 · 하니스 폰트 비대칭 · catalog IFC → ADR-923) · ADR-205 G4 재사용
- **미완료 범위**: **Phase 6 보류 (2026-09-07 사용자 결정)**. CI smoke 는 Linux runner 0/N (환경 발산, G2 결정성 macOS 만 측정) · deploy 09-04 이후 실패 (ADR-205 drift step 가드 없음). 잔여 ratchet 9 region: disabled Button 채우기 0.90 (catalog disabled 배경 축 = ADR-908 계열) · `/appIcon.svg` 래스터 0.91 미조사 · 텍스트 AA 예산. 재개 조건: gh-pages 배포 필요 또는 해당 영역 착수
- **우선순위**: P4

> **참고**: ADR-029에 동일 번호의 [Text Edit Overlay UX 개선](completed/029-text-edit-overlay-improvements.md) 문서가 존재하며, ADR-027의 후속 개선으로 Phase 1-2 모두 구현 완료 (Accepted).

### 권장 착수 순서 — 2026-08-28 재산정

> **완료 이력** (execute-adr): 915(2026-07-16) → 151(07-17) → 148(07-17) → 149(07-19) → 150-A1(07-19, 이후 07-20 철회) → 154(07-19) → 153(07-27~~28, P4 는 G4 미달 미도입 종결) → 이후 155~~193 순차 종결 → 117(2026-08-28, Phase 0~~4 / G0~~G5 종결) → 195(2026-08-27) → 196(2026-08-28, Phase 0~~4 / G0~~G4 종결).
>
> 아래 표는 **남은 미착수 ADR 의 실행 순서**다. 위 "미구현 (Proposed)" 표의 P1/P2/P3 은 ADR 번호별 **중요도**이고, 본 표는 **준비도(리뷰 종결 여부)·의존 그래프·즉시 가치**로 재산정한 **실행 순서**다. 리뷰 파일(`reviews/{NNN}.md`)의 최신 round 가 pending 0 이면 CLAUDE.md §전제 확정 종결 계약에 따라 **전제 확정** — 구현 중 재질문 금지.

| 순위 | ADR                                                                                                                                                  | 착수 준비도                                                                                          | 차단 · 선행                                                                             |
| :--: | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
|  1   | [150](150-rac-pencil-residual-interaction-execution.md) (A3)                                                                                         | Accepted · A1 철회(2026-07-20 D1/D3 경계 재판정) · A2 delivered(시각 확인 대기) · A3 미착수          | A2 live 확인 + ADR-148 Phase 4 `canvasSceneNode` 표면 재실측 후 A3                      |
|  2   | [162](162-gridlist-template-subtree-projection.md)                                                                                                   | round 1 이슈 2건 fixed. 선행 의존 ADR-159 P1/P4 는 **Implemented 로 해소**                           | R1 HIGH(카드 높이 formula→실측 전환) 잔존 — Phase 0 재실측 필요                         |
|  3   | [921](921-render-scene-backend-integration.md)                                                                                                       | round 1 LOW 3건 fixed이나 **Phase 0 baseline 재freeze 선행 필요** (187~190 이후 §6-2 파일 대량 변경) | 재freeze 전 착수 금지                                                                   |
|  4   | [013](013-quick-connect-data-binding.md)                                                                                                             | Risk-First 재작성 완료(round 2 전부 fixed)                                                           | 착수 조건 G0 의 **152 Implemented 는 2026-09-11 충족** — 남은 것은 Phase 0 재-inventory |
|  5   | [212](212-data-panel-editor-redesign.md) · [213](213-data-tool-contract-propose-review-apply.md) · [214](214-variables-owner-model-runtime-state.md) | Proposed 2026-09-11 (리서치 DATA_PANEL_REDESIGN Track 2 · 3 · Variables) — 리뷰 전                   | 152 Implemented (2026-09-11) 로 선행 의존 전부 충족 — 리뷰 후 착수 가능                 |
|  —   | [910](910-rac-pencil-component-architecture.md) / [911](911-rac-pencil-target-component-architecture.md)                                             | 착수 대상 아님 (비착수 비교 기록 / 비실행 목표 참조)                                                 | 실행 owner = ADR-912 Implemented                                                        |

**착수 프롬프트** (착수 승인 시 복붙용 — Proposed ADR 은 `/execute-adr` 가 Accepted 전제라 승격 지시 포함)

<details>
<summary>1. ADR-194 (Accepted — 승인 없이 이어서 진행 가능)</summary>

```
/execute-adr 194

- Phase 0 inventory freeze 부터: §2 표 재grep · generate-css 의 chart 채널 emit 가능 여부 판정(R1) ·
  publish registry 가 registration contract test 에 포함되는지 · 등록 8지점 line 확정 ·
  size→layout 무효화 등재(R10) · ADR-117 Implemented의 `Path.MakeFromSVGString` 유지 계약 확인
- emit 불가 판정 시 Phase 3 에 generate-css emit 확장 선행 commit 추가 (G0 분기)
- 신규 런타임 의존 0 (HC1) 유지 — d3-shape 포함 어떤 외부 패키지도 추가 금지
- Phase 4 parity: 동일 scene → DOM d/rect 좌표 == Skia PathShape/RectShape 좌표 byte-identical
- Phase 5 live 는 builder 측 + 샘플 fallback 으로 종결 (152 격차 7 미수리 상태 전제, R7)
```

</details>

<details>
<summary>2. ADR-013 (152 Implemented 2026-09-11 — 착수 조건 G0 충족)</summary>

```
ADR-013 착수를 승인한다. 착수 조건 G0(152 Implemented — 2026-09-11 충족) 확인 +
Phase 0 재-inventory 후 Proposed → Accepted 승격 → /execute-adr 013

- 152 의 binding v2(collectionId + fieldMap) 계약 위에서만 Quick Connect 1클릭 자동화 배선
- Risk-First 재작성본(2026-07-16) 의 Phase 0~5 / R1~R5 / G0~G3 기준, stale 전제 7건은 재론 금지
```

</details>

---

## 완료 ADR (229)

> 상세는 각 본문이 정본이다. 구 README 의 **비고** 열 서술 (최장 셀 14KB — ADR-912 행이 표
> 전체를 그 폭으로 채워 3.2MB 를 만들었다) 은
> [archive/README-notes-2026-09.md §2](archive/README-notes-2026-09.md) 에 있다.

| ADR                                                                                 | 제목                                                                                                                                                           | 상태        | 일자                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| [923](completed/923-layout-vocabulary-closure.md)                                   | display 이원 계약 — TS IFC 시뮬레이션 제거·엔진 outer/inner 직결 (C′)                                                                                          | Implemented | 2026-09-03                                                           |
| [922](completed/922-photoshop-style-panel-layout-coordinator.md)                    | Photoshop식 패널 레이아웃 코디네이터 전환                                                                                                                      | Implemented | 2026-08-18                                                           |
| [920](completed/920-rac-format-interactive-projected-tree.md)                       | RAC Format Interactive Projected Tree                                                                                                                          | Superseded  | 2026-06-02                                                           |
| [916](completed/916-unified-rust-engine.md)                                         | 자체 단일 Rust 엔진 통합                                                                                                                                       | Implemented | 2026-07-06                                                           |
| [915](completed/915-catalog-prop-parity-restoration.md)                             | catalog binding.accepts prop parity 복원 (ADR-912 후속)                                                                                                        | Implemented | 2026-07-16                                                           |
| [914](completed/914-component-entry-universe-collapse.md)                           | Component Entry Universe Collapse                                                                                                                              | Implemented | 2026-06-22                                                           |
| [913](completed/913-catalog-reference-rebuild.md)                                   | catalog 컴포넌트 레퍼런스 기준 재구축                                                                                                                          | Implemented | 2026-06-22                                                           |
| [912](completed/912-rac-pencil-rebuild-cutover.md)                                  | RAC core + Pencil format 백지 직행 컴포넌트 아키텍처 (rebuild)                                                                                                 | Implemented | 2026-06-18                                                           |
| [909](completed/909-style-ssot-contract.md)                                         | Style SSOT Contract — Store Longhand Policy ↔ Consumer Norma…                                                                                                  | Implemented | 2026-04-24                                                           |
| [908](completed/908-fill-spec-schema-ssot.md)                                       | Fill Spec Schema SSOT 전환                                                                                                                                     | Implemented | 2026-04-24                                                           |
| [907](completed/907-collection-container-style-pipeline.md)                         | Collection/self-render 컨테이너 style pipeline 전수화                                                                                                          | Implemented | 2026-04-24                                                           |
| [906](completed/906-collection-spacing-runtime-contract.md)                         | Collection spacing 런타임 계약                                                                                                                                 | Superseded  | 2026-04-24                                                           |
| [905](completed/905-fill-noncanonical-background-payload-policy.md)                 | Fill 비정형 background payload 정책                                                                                                                            | Implemented | 2026-04-24                                                           |
| [904](completed/904-fill-ssot-preview-publish-adapter.md)                           | Fill SSOT + Preview/Publish 어댑터 전환                                                                                                                        | Implemented | 2026-04-24                                                           |
| [903](completed/903-ref-descendants-slot-composition-format-migration-plan.md)      | ref/descendants + slot 기본 composition 포맷 전환 계획                                                                                                         | Implemented | 2026-04-26                                                           |
| [902](completed/902-workspace-dot-background-layer.md)                              | Workspace Dot Background Layer                                                                                                                                 | Implemented | 2026-04-25                                                           |
| [900](completed/900-unified-skia-rendering-engine.md)                               | Unified Skia Rendering Engine — PixiJS/Taffy 제거 및 CSS3 단일 렌더러                                                                                          | Implemented | 2026-04-07                                                           |
| [211](completed/211-chart-display-budget-pixel-fit-window-decimation.md)            | 차트 표시 예산 — 픽셀 폭 기준 마크 수와 창·축약 계약 (번들 한도 7 KiB · initial 재승인)                                                                        | Implemented | 2026-09-11                                                           |
| [210](completed/210-chart-multi-field-series-presentation.md)                       | 차트의 다중 수치 컬럼 매핑과 시리즈 표시 계약 — 예산 예외 승인                                                                                                 | Implemented | 2026-09-10                                                           |
| [209](completed/209-chart-authoring-canvas-recharts-runtime.md)                     | 차트별 편집 경험과 Canvas·Recharts 런타임 분리                                                                                                                 | Implemented | 2026-09-10                                                           |
| [208](completed/208-radar-radial-grid-controls.md)                                  | radar/radial 제어 prop 과 차트 종류별 조건부 노출                                                                                                              | Implemented | 2026-09-09                                                           |
| [207](completed/207-polar-chart-radar-radial.md)                                    | 극좌표 차트 — radar · radial (ADR-194 기하 SSOT 의 극좌표 확장)                                                                                                | Implemented | 2026-09-08                                                           |
| [206](completed/206-engine-stretched-definite-propagation-grid-implicit-tracks.md)  | 엔진 늘어난 크기 definite 전파 + grid 암묵 트랙 준수                                                                                                           | Implemented | 2026-09-07                                                           |
| [205](completed/205-text-visual-axis-computed-seam.md)                              | 텍스트 시각 축 computed 단일 seam — letterSpacing 결선                                                                                                         | Implemented | 2026-09-05                                                           |
| [204](completed/204-virtualized-collection-min-content-floor.md)                    | 가상화 collection 의 min-content floor — 투영 행이 §4.5 자동 최소 크기에 도달…                                                                                 | Implemented | 2026-09-04                                                           |
| [203](completed/203-selection-fanout-layer-tree-virtualized-rows.md)                | 선택 변경 fan-out 제거 — Navigator 트리·Properties 행 단위 구독                                                                                                | Implemented | 2026-09-06                                                           |
| [200](completed/200-command-label-locale-resolution.md)                             | 명령·메뉴 라벨 locale 해소                                                                                                                                     | Implemented | 2026-08-30                                                           |
| [199](completed/199-component-semantics-action-registry.md)                         | 컴포넌트 시맨틱 액션 레지스트리 + 투영 불변식                                                                                                                  | Implemented | 2026-08-30                                                           |
| [198](completed/198-d3-renderer-pixel-parity-gate.md)                               | D3 Renderer Pixel Parity Gate                                                                                                                                  | Implemented | 2026-09-07                                                           |
| [197](completed/197-builder-chrome-state-icon-morph.md)                             | Builder chrome 상태 아이콘 morph — morphicons core vendoring + St…                                                                                             | Deprecated  | 2026-08-30                                                           |
| [196](completed/196-agent-command-surface.md)                                       | command registry 의 agent 호출 표면 — metadata 분리 · allowlist · 승…                                                                                          | Implemented | 2026-08-28                                                           |
| [195](completed/195-command-palette-execution-registry.md)                          | 명령 팔레트 실행 경로 — command registry 승격 (단축키 핸들러 SSOT)                                                                                             | Implemented | 2026-08-27                                                           |
| [194](completed/194-chart-component-headless-geometry.md)                           | 차트 컴포넌트 — headless 기하 SSOT + Skia/DOM 대칭 consumer                                                                                                    | Implemented | 2026-09-08                                                           |
| [193](completed/193-theme-aware-semantic-palette-map.md)                            | 테마별 semantic·named hue 팔레트 단계 매핑 단일 원천화 — dark 모드 Skia↔CSS 대…                                                                                | Implemented | 2026-08-27                                                           |
| [192](completed/192-contextual-action-bar.md)                                       | Contextual Action Bar — 선택 컨텍스트 기반 온캔버스 액션 표면 (Photoshop 모델)                                                                                 | Implemented | 2026-08-27                                                           |
| [191](completed/191-tailwind-theme-single-source-palette.md)                        | Tailwind v4 theme.css 단일 원천 팔레트 파생 — App.css :root / shared-…                                                                                         | Implemented | 2026-08-26                                                           |
| [190](completed/190-commit-descriptor-emitter-expansion.md)                         | commit descriptor emitter 확장 — generic style/layout/structur…                                                                                                | Implemented | 2026-08-24                                                           |
| [189](completed/189-commit-lane-incremental-record.md)                              | 커밋 레인 record 증분화 — dirty-root 서브트리 재기록                                                                                                           | Implemented | 2026-08-24                                                           |
| [188](completed/188-targeted-layout-and-skia-subtree-patching.md)                   | 타깃 레이아웃 입력과 Skia 서브트리 패치                                                                                                                        | Implemented | 2026-08-22                                                           |
| [187](completed/187-editor-presentation-transaction-and-typed-invalidation.md)      | 에디터 프레젠테이션 트랜잭션과 타입 기반 무효화                                                                                                                | Implemented | 2026-08-24                                                           |
| [186](completed/186-photoshop-default-zone-panel-placement.md)                      | Photoshop 기본 및 Pencil 9-zone 패널 배치 정책                                                                                                                 | Implemented | 2026-08-19                                                           |
| [185](completed/185-history-coverage-contract.md)                                   | history coverage 계약 — mutation 의 undo 기록 의무화                                                                                                           | Implemented | 2026-08-15                                                           |
| [184](completed/184-canonical-mutation-runner.md)                                   | canonical mutation 순서 러너 — 신규 경로의 구조적 순서 보증                                                                                                    | Implemented | 2026-08-15                                                           |
| [183](completed/183-layout-explain-channel.md)                                      | 레이아웃 explain 디버그 채널 — 엔진 판정 트레이스                                                                                                              | Implemented | 2026-08-15                                                           |
| [182](completed/182-builder-context-menu.md)                                        | 빌더 우클릭 컨텍스트 메뉴 — 대상별 통합 컨텍스트 메뉴 시스템                                                                                                   | Implemented | 2026-08-16                                                           |
| [181](completed/181-ruler-manual-guides.md)                                         | 눈금자(Ruler) + 수동 가이드 — 뷰포트 chrome 과 페이지 귀속 가이드 라인                                                                                         | Implemented | 2026-08-14                                                           |
| [180](completed/180-history-snapshots.md)                                           | 히스토리 스냅샷 — 선형 truncation 생존 복원 지점                                                                                                               | Implemented | 2026-08-13                                                           |
| [179](completed/179-snap-alignment-guides.md)                                       | 캔버스 스냅·정렬 가이드 — 페이지 축 우선, absolute 요소 확장                                                                                                   | Implemented | 2026-08-12                                                           |
| [178](completed/178-multi-select-move.md)                                           | 캔버스 다중 선택 이동 — 요소·페이지 멀티 드래그 + 이동 modifier                                                                                                | Implemented | 2026-08-12                                                           |
| [177](completed/177-page-position-document-data.md)                                 | 페이지 위치의 문서 데이터화 — 히스토리 기록 + 영속화                                                                                                           | Implemented | 2026-08-12                                                           |
| [176](completed/176-canvas-authoring-gesture-and-page-position-optimization.md)     | Canvas authoring gesture 및 page position 렌더링 최적화                                                                                                        | Implemented | 2026-08-01                                                           |
| [175](completed/175-viewport-interaction-scheduling.md)                             | 캔버스 뷰포트 상호작용 스케줄링 계약                                                                                                                           | Implemented | 2026-07-31                                                           |
| [174](completed/174-paragraph-retained-lifetime.md)                                 | Paragraph 수명 retained 전환 — 전역 LRU 폐지와 안전 폐기                                                                                                       | Implemented | 2026-07-31                                                           |
| [173](completed/173-gesture-raster-deferral.md)                                     | 제스처 중 재래스터 이연 — 컬링 기준면 정합과 기하 무효화                                                                                                       | Implemented | 2026-07-30                                                           |
| [172](completed/172-pan-path-derived-cost.md)                                       | 팬 경로 파생 비용 제거 — 카메라 이동과 파생 계층 분리                                                                                                          | Implemented | 2026-07-30                                                           |
| [171](completed/171-catalog-layout-delivery-unification.md)                         | catalog 레이아웃 값의 소비자 비대칭 해소                                                                                                                       | Implemented | 2026-08-26                                                           |
| [170](completed/170-engine-basic-axis-conformance-sweep.md)                         | 엔진 기본 축 전수 정합 격자 — display×size Chrome 오라클 sweep                                                                                                 | Implemented | 2026-07-28                                                           |
| [169](completed/169-container-intrinsic-sizing-propagation.md)                      | 컨테이너 intrinsic 크기 산출 (min/max-content)                                                                                                                 | Implemented | 2026-07-27                                                           |
| [168](completed/168-frame-preset-responsive-restructure.md)                         | Frame Preset 반응형 재구성 — 프리셋 카탈로그 · 반응형 계약 · 패널 재설계                                                                                       | Implemented | 2026-07-26                                                           |
| [167](completed/167-on-demand-frame-loop.md)                                        | on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지                                                                                                             | Deprecated  | 2026-07-26                                                           |
| [166](completed/166-shadow-token-theme-aware-ssot.md)                               | 그림자 토큰 theme-aware 승격 + 값 언어 TokenRef 통일 + 스케일 Spectrum 재정의                                                                                  | Implemented | 2026-07-25                                                           |
| [165](completed/165-intrinsic-sizing-measure-contract.md)                           | 레이아웃 intrinsic sizing 측정 계약 — min/max-content 스칼라 공급 + 엔진 fi…                                                                                   | Implemented | 2026-07-25                                                           |
| [164](completed/164-engine-ts-compensation-absorption.md)                           | 레이아웃 TS 보정 레이어의 엔진 흡수 — automatic minimum size + position:ab…                                                                                    | Implemented | 2026-07-25                                                           |
| [163](completed/163-builder-panel-structure-standardization.md)                     | 빌더 패널 표준 구조화 — 레퍼런스 기반 전 패널 DOM/클래스/CSS 정본 통일                                                                                         | Implemented | 2026-07-25                                                           |
| [161](completed/161-gridlist-ref-composite-parity.md)                               | GridList ref 기반 재사용 composite 전환                                                                                                                        | Implemented | 2026-07-23                                                           |
| [160](completed/160-collection-projection-metric-ssot.md)                           | collection projection 행 텍스트 측정 SSOT 단일화                                                                                                               | Implemented | 2026-07-22                                                           |
| [159](completed/159-collection-field-template-binding.md)                           | Collection 필드 템플릿 바인딩 — `{field}` 보간 + dataTable 단일 소스                                                                                           | Implemented | 2026-07-24                                                           |
| [158](completed/158-interactions-rules-capability-registry.md)                      | Interactions 재설계 — EventsPanel 대체 (한 줄 규칙 + RAC capability r…                                                                                         | Implemented | 2026-08-16                                                           |
| [157](completed/157-collection-builder-display-policy.md)                           | Data-bound Collection 빌더 표시 정책 — 샘플 행 + hatch placeholder                                                                                             | Implemented | 2026-08-26                                                           |
| [156](completed/156-engine-css-parity-alignment-margin.md)                          | composition-engine CSS 정합 복구 — 발산 17군 + Chrome 차등 oracle 도입                                                                                         | Implemented | 2026-07-18                                                           |
| [155](completed/155-hidden-panel-selection-fanout-gating.md)                        | 숨은 패널 selection fan-out 차단 — 패널 활성 gating                                                                                                            | Implemented | 2026-07-17                                                           |
| [154](completed/154-responsive-breakpoint-authoring.md)                             | 반응형 Breakpoint 저작 배선 — viewport 별 스타일 편집 + 3경로 출력                                                                                             | Implemented | 2026-07-19                                                           |
| [153](completed/153-render-optimization-measurement-first-adoption.md)              | 유사 빌더 렌더링 최적화 도입 — 측정 보강 우선 + Picture 캐시 단계 도입                                                                                         | Implemented | 2026-07-28                                                           |
| [152](completed/152-data-panel-collection-binding-integration.md)                   | Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합 — 계약 v2 (`collectionId` · `fieldId` · fieldMap) + `DataChange` 적용기 + History + publish snapshot | Implemented | 2026-09-11                                                           |
| [151](completed/151-builder-residual-parity-defect-remediation.md)                  | 빌더 잔여 CSS↔Skia 발산·잠재 결함 일소 전략                                                                                                                    | Implemented | 2026-07-17                                                           |
| [149](completed/149-events-panel-canonical-simplification.md)                       | EventsPanel 전면 재설계 — 2-depth UX + canonical events/actions p…                                                                                             | Implemented | 2026-07-19                                                           |
| [148](completed/148-reusable-slot-system-unification.md)                            | Reusable·Slot 시스템 단일화 — 전면 reusable entry 등록 + slot 모델 일반화                                                                                      | Implemented | 2026-07-17                                                           |
| [147](completed/147-listboxitem-slot-composition.md)                                | ListBoxItem Slot Composition Model                                                                                                                             | Superseded  | 2026-07-08                                                           |
| [146](completed/146-listboxitem-ref-template-row-projection.md)                     | ListBoxItem Ref Template and Row Projection                                                                                                                    | Implemented | 2026-05-28                                                           |
| [145](completed/145-listbox-template-element-single-component-proof.md)             | ListBox Template Element SSOT — 정상 tree화 적용 (industry-standa…                                                                                             | Implemented | 2026-05-27                                                           |
| [144](completed/144-collection-template-element-ssot.md)                            | Collection 컴포넌트 Template Element SSOT — RAC dynamic collecti…                                                                                              | Superseded  | 2026-05-27                                                           |
| [143](completed/143-canonical-token-field-realignment.md)                           | Canonical 시각 토큰 필드 정명 + theme/token SSOT 재정렬                                                                                                        | Implemented | 2026-05-19                                                           |
| [142](completed/142-starter-spec-component-system-cutover.md)                       | RAC primitive binding + canonical 문서 기반 컴포넌트 시스템 family 단위 c…                                                                                     | Implemented | 2026-06-02                                                           |
| [141](completed/141-rac-starter-spec-style-sync.md)                                 | react-aria-starter 참조 스타일의 Spec D3 반영                                                                                                                  | Implemented | 2026-05-18                                                           |
| [140](completed/140-press-scale-micro-interaction.md)                               | react-aria-starter press-scale micro-interaction 도입                                                                                                          | Implemented | 2026-05-17                                                           |
| [139](completed/139-component-registration-symmetry-gate.md)                        | 컴포넌트 등록·대칭 build-time gate                                                                                                                             | Implemented | 2026-05-17                                                           |
| [138](completed/138-component-palette-reusable.md)                                  | 컴포넌트 패널 복합 컴포넌트 reusable origin-instance 부착 — dynamic 검증 + 진…                                                                                 | Implemented | 2026-05-18                                                           |
| [137](completed/137-selection-consumer-contract.md)                                 | 선택 소비자 계약 — Page-bound Action 의 stale-mismatch 차단                                                                                                    | Implemented | 2026-05-15                                                           |
| [136](completed/136-scene-projection-version-ssot-hardening.md)                     | Scene Projection Version SSOT Hardening                                                                                                                        | Implemented | 2026-05-15                                                           |
| [135](completed/135-page-frame-projection-interaction-boundary.md)                  | Page-Frame Projection Interaction Boundary                                                                                                                     | Implemented | 2026-05-14                                                           |
| [134](completed/134-ai-assistant-llm-infrastructure-unification.md)                 | AI Assistant 차세대 아키텍처 — LLM 인프라 + 도구/UI 통합                                                                                                       | Implemented | 2026-08-29                                                           |
| [133](completed/133-events-panel-simplification.md)                                 | EventsPanel UX 단순화 (1년차 신입 baseline) + canonical events/acti…                                                                                           | Deprecated  | 2026-07-08                                                           |
| [132](completed/132-usecollectiondata-useasynclist-alignment.md)                    | useCollectionData useAsyncList 정합 + collections sink 통일 (+ d…                                                                                              | Implemented | 2026-05-13                                                           |
| [131](completed/131-events-data-actions-first-class-collections.md)                 | events/data/actions 일급 컴포넌트 루트 컬렉션                                                                                                                  | Implemented | 2026-05-13                                                           |
| [130](completed/130-layer3-canonical-vocabulary-alignment.md)                       | Layer 3 Canonical Vocabulary 정렬 — `type: "Group"` → `type: "…                                                                                                | Implemented | 2026-05-13                                                           |
| [128](completed/128-supabase-backend-decommission.md)                               | Supabase backend decommission — auth-only 격하 + cloud data la…                                                                                                | Implemented | 2026-05-12                                                           |
| [127](completed/127-canonical-traversal-helper-and-scene-model-redesign.md)         | Canonical-native traversal helper + scene model 재설계                                                                                                         | Implemented | 2026-05-10                                                           |
| [126](completed/126-element-type-deprecate.md)                                      | Element 타입 Deprecate — canonical-native consumer 전환 및 bounda…                                                                                             | Implemented | 2026-05-11                                                           |
| [125](completed/125-render-input-canonical-native-contract.md)                      | Render input canonical-native contract                                                                                                                         | Implemented | 2026-05-10                                                           |
| [124](completed/124-canonical-only-history-schema.md)                               | Canonical-only history entry schema                                                                                                                            | Implemented | 2026-05-10                                                           |
| [123](completed/123-cloud-document-row-schema.md)                                   | Cloud document-level row schema 단일화                                                                                                                         | Implemented | 2026-05-10                                                           |
| [122](completed/122-canonical-only-runtime-legacy-mirror-removal.md)                | Canonical-only runtime 전환 및 legacy mirror 제거                                                                                                              | Implemented | 2026-05-09                                                           |
| [121](completed/121-indexeddb-legacy-surface-cleanup.md)                            | IndexedDB legacy surface cleanup                                                                                                                               | Implemented | 2026-05-08                                                           |
| [120](completed/120-legacy-mirror-persistence-cleanup.md)                           | Legacy mirror persistence 제거 계획                                                                                                                            | Implemented | 2026-05-08                                                           |
| [119](completed/119-page-layout-order-mirror-cleanup.md)                            | Page/Layout order mirror 제거 및 canonical source-order 통합                                                                                                   | Implemented | 2026-05-08                                                           |
| [118](completed/118-children-array-order-ssot.md)                                   | children 배열 순서 기반 ordering SSOT 전환                                                                                                                     | Implemented | 2026-05-07                                                           |
| [117](completed/117-canvaskit-pathbuilder-upgrade.md)                               | CanvasKit PathBuilder 전환 및 0.42.0 업그레이드                                                                                                                | Implemented | 2026-08-28                                                           |
| [116](completed/116-canonical-document-ssot-transition.md)                          | Canonical Document SSOT 전환 계획                                                                                                                              | Implemented | 2026-05-02                                                           |
| [115](completed/115-remove-designkit-system.md)                                     | DesignKit 시스템 제거 — Theme/Variable 시스템과 중복 해소                                                                                                      | Implemented | 2026-04-27                                                           |
| [114](completed/114-imports-resolver-designkit-integration.md)                      | `imports` resolver + DesignKit 통합 — Superseded                                                                                                               | Superseded  | 2026-04-30                                                           |
| [113](completed/113-tag-type-rename-hybrid-cleanup.md)                              | `Element.tag → Element.type` rename + hybrid 6 필드 cleanup                                                                                                    | Implemented | 2026-05-02                                                           |
| [112](completed/112-editing-semantics-ui-5elements.md)                              | Editing Semantics UI 6요소 — reusable/ref/override 가시성 + detac…                                                                                             | Implemented | 2026-04-30                                                           |
| [111](completed/111-layout-frameset-pencil-redesign.md)                             | Layout/Slot Frameset 완전 재설계 — pencil app 호환                                                                                                             | Implemented | 2026-05-02                                                           |
| [110](completed/110-canonical-themes-variables-land-plan.md)                        | Canonical Document `themes` / `variables` 필드 Land Plan                                                                                                       | Implemented | 2026-04-27                                                           |
| [109](completed/109-body-spec-ssot-completion-publish-symmetry.md)                  | Body Spec SSOT 완결 + Publish consumer 대칭 복구                                                                                                               | Implemented | 2026-04-25                                                           |
| [108](completed/108-container-runtime-derived-styles.md)                            | `containerVariants` consumer 확장 — Spec runtime variant 의 Can…                                                                                               | Implemented | 2026-04-23                                                           |
| [107](completed/107-preview-publish-root-symmetry.md)                               | Preview/Publish `:root` + body 대칭 복구 via shared-tokens                                                                                                     | Implemented | 2026-04-22                                                           |
| [106](completed/106-a-color-family-skipcss-dismantle.md)                            | ADR-106-a: Color Family skipCSSGeneration 해체 — 수동 CSS 정당화 + …                                                                                           | Implemented | 2026-04-21                                                           |
| [106](completed/106-b-taggroup-css-skipcss-justification.md)                        | ADR-106-b: TagGroup.css skipCSSGeneration 정당화 + @sync 주석 4건 해소                                                                                         | Implemented | 2026-04-21                                                           |
| [106](completed/106-c-label-skipcss-ssot-recovery.md)                               | ADR-106-c: Label CSS skipCSSGeneration 정당화 — `--label-font-s…                                                                                               | Implemented | 2026-04-21                                                           |
| [106](completed/106-d-g4-residual-classification-final.md)                          | ADR-106-d: G4 잔존 3건 최종 분류 확정 — Tag 자연 해소 / Field G2 정당화 / Se…                                                                                  | Implemented | 2026-04-21                                                           |
| [106](completed/106-skipcssgeneration-audit-charter.md)                             | skipCSSGeneration 감사 Charter (G 카테고리 27 spec 분류)                                                                                                       | Implemented | 2026-04-21                                                           |
| [105](completed/105-a-sync-utils-constants-primitives.md)                           | ADR-105-a: @sync F3+F5 상수 primitives 이관 — BUTTON_SIZE_CONFIG…                                                                                              | Implemented | 2026-04-21                                                           |
| [105](completed/105-b-sync-spec-to-spec-primitives-sharing.md)                      | ADR-105-b: @sync F1 spec-to-spec 참조 primitives 공유                                                                                                          | Implemented | 2026-04-21                                                           |
| [105](completed/105-c-sync-spec-to-css-resolution.md)                               | ADR-105-c: @sync F2 spec-to-CSS 해소 — 자연 해소 확증 + 실질 작업 2건 처리 계획                                                                                | Implemented | 2026-04-21                                                           |
| [105](completed/105-d-sync-f4-f5-final-closure.md)                                  | ADR-105-d: @sync F4/F5 최종 종결 — CSS/Builder 잔존 주석 정당화 및 해소                                                                                        | Implemented | 2026-04-22                                                           |
| [105](completed/105-sync-annotation-audit-charter.md)                               | @sync 주석 체계적 감사 Charter (F 카테고리 consumer-to-consumer debt 해소…                                                                                     | Implemented | 2026-04-21                                                           |
| [104](completed/104-card-naming-rsp-alignment.md)                                   | Card 시리즈 네이밍 RSP/S2 정합 감사 — CardHeader/CardContent/CardFoote…                                                                                        | Implemented | 2026-04-21                                                           |
| [103](completed/103-checkbox-radio-items-justification.md)                          | CheckboxItems / RadioItems 정당화 — RAC 미존재 composition 중간 컨테이너…                                                                                      | Implemented | 2026-04-21                                                           |
| [102](completed/102-select-icon-justification.md)                                   | SelectIcon 정당화 — RAC 미존재 시각 element 유지 결정 (ADR-098-d 슬롯)                                                                                         | Implemented | 2026-04-21                                                           |
| [101](completed/101-combobox-child-naming-rsp-alignment.md)                         | ComboBox 자식 네이밍 RSP 정합 — ComboBoxItem/ComboBoxTrigger 비대칭 결정…                                                                                      | Implemented | 2026-04-21                                                           |
| [100](completed/100-select-child-naming-rsp-alignment.md)                           | Select 자식 네이밍 RSP 정합 — SelectItem/SelectTrigger 비대칭 결정 (ADR-…                                                                                      | Implemented | 2026-04-21                                                           |
| [099](completed/099-collection-section-expansion.md)                                | Collection Section/Header 확장 — ListBox/GridList/Menu (ADR-09…                                                                                                | Implemented | 2026-04-21                                                           |
| [098](completed/098-rsp-naming-audit-charter.md)                                    | RSP 네이밍 정합 감사 Charter — 리네이밍 우선순위 + 분할 후속 ADR 체계                                                                                          | Implemented | 2026-04-21                                                           |
| [097](completed/097-taggroup-items-ssot-hybrid.md)                                  | TagGroup `items` SSOT + TagList Hybrid Container (ADR-093-A1)                                                                                                  | Implemented | 2026-04-21                                                           |
| [096](completed/096-default-element-dimensions-ssot.md)                             | ComponentSpec `defaultWidth?/defaultHeight?` Schema 확장 + HTM…                                                                                                | Implemented | 2026-04-21                                                           |
| [095](completed/095-propagation-style-injection-rule.md)                            | Propagation schema 확장 — 자식 Element style 주입 rule                                                                                                         | Implemented | 2026-04-21                                                           |
| [094](completed/094-childspecs-registry-auto-registration.md)                       | childSpecs 자동 registry 등록 — Skia 축 SSOT 복구                                                                                                              | Implemented | 2026-04-21                                                           |
| [093](completed/093-synthetic-merge-containers-spec.md)                             | 중간 컨테이너 spec 신설 — TagList / RadioItems / CheckboxItems                                                                                                 | Implemented | 2026-04-21                                                           |
| [092](completed/092-card-slot-spec-modeling.md)                                     | Card slot 모델링 — CardHeader / CardContent / CardFooter spec 신설                                                                                             | Implemented | 2026-04-21                                                           |
| [091](completed/091-utils-record-dissolution.md)                                    | utils.ts + cssResolver.ts Record<string, number> 해체 — Class …                                                                                                | Implemented | 2026-04-21                                                           |
| [090](completed/090-gridlistitem-spec-and-skia-metric-ssot.md)                      | GridListItem.spec 신설 + Skia card metric SSOT + implicitStyle…                                                                                                | Implemented | 2026-04-21                                                           |
| [089](completed/089-containerstyles-position-slidertrack-lifting.md)                | ContainerStylesSchema.position? 신규 필드 + SliderTrack position…                                                                                              | Implemented | 2026-04-20                                                           |
| [088](completed/088-sizespec-columngap-slider-col-gap-dissolution.md)               | SizeSpec.columnGap? 신규 필드 + SLIDER_COL_GAP Record 해체                                                                                                     | Implemented | 2026-04-20                                                           |
| [087](completed/087-implicitstyles-residual-branches-categorized-sweep.md)          | implicitStyles 잔존 ~25 분기 카테고리별 sweep — 완전 SSOT 복귀                                                                                                 | Implemented | 2026-04-20                                                           |
| [086](completed/086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md) | implicitStyles size Record 해체 + Breadcrumb child layout SSOT…                                                                                                | Implemented | 2026-04-20                                                           |
| [085](completed/085-containerstyles-grid-template-lifting.md)                       | ContainerStylesSchema grid-template 확장 + ProgressBar/Meter p…                                                                                                | Implemented | 2026-04-20                                                           |
| [084](completed/084-implicitstyles-branch-dissolution.md)                           | implicitStyles 하드코딩 분기 해체 — 4 spec (Calendar/RangeCalendar/S…                                                                                          | Implemented | 2026-04-20                                                           |
| [083](completed/083-archetype-base-styles-lifting.md)                               | Layout Primitive 리프팅 — archetype base 의 layout 속성을 Spec cont…                                                                                           | Implemented | 2026-04-20                                                           |
| [082](completed/082-style-panel-spec-consumer-integration.md)                       | Style Panel Spec Consumer 통합 — containerStyles/composition.\…                                                                                                | Implemented | 2026-04-22                                                           |
| [081](completed/081-tokenref-build-time-drift-assertion.md)                         | TokenRef resolved-value build-time drift assertion — token 소…                                                                                                 | Implemented | 2026-04-20                                                           |
| [080](completed/080-layout-engine-spec-direct-read-through.md)                      | Layout engine containerStyles Spec direct read-through — imp…                                                                                                  | Implemented | 2026-04-20                                                           |
| [079](completed/079-spec-defaults-read-through-layout-primitive-ssot.md)            | Spec defaults read-through + Layout primitive SSOT 완전화                                                                                                      | Implemented | 2026-04-19                                                           |
| [078](completed/078-listboxitem-spec-and-generator-child-selector.md)               | ListBoxItem.spec 신설 + Generator 자식 selector emit 확장                                                                                                      | Implemented | 2026-04-19                                                           |
| [076](completed/076-listbox-items-ssot-hybrid.md)                                   | ListBox items SSOT + containerStyles 하이브리드 해체 (ListBoxItem 듀…                                                                                          | Implemented | 2026-04-18                                                           |
| [075](completed/075-render-longtask-fanout-decomposition.md)                        | Render longtask fan-out 해체 — SkiaCanvas rAF / StoreRenderBri…                                                                                                | Implemented | 2026-04-18                                                           |
| [074](completed/074-canvas-input-pipeline-decomposition.md)                         | 캔버스 입력 파이프라인 SSOT 재편 (pointerdown→render.frame 체감 최적화)                                                                                        | Implemented | 2026-04-18                                                           |
| [073](completed/073-select-combobox-items-ssot.md)                                  | Select/ComboBox items SSOT + `renderMenu` wiring 정리                                                                                                          | Implemented | 2026-04-18                                                           |
| [072](completed/072-hasChildren-convention-shell-only-tags.md)                      | `_hasChildren` 컨벤션 SSOT + Shell-only 컨테이너 태그 재분류                                                                                                   | Implemented | 2026-04-18                                                           |
| [071](completed/071-generator-container-styles-menu-restore.md)                     | Generator `containerStyles` 인프라 + Menu 정방향 복원                                                                                                          | Implemented | 2026-04-18                                                           |
| [070](completed/070-popover-item-css-ssot.md)                                       | MenuItem CSS 색상 SSOT — StateEffect hover/disabled 색상 emit 인프라                                                                                           | Implemented | 2026-04-17                                                           |
| [069](completed/069-input-frame-violation-mitigation.md)                            | 입력·프레임 Violation 완화 — same-turn store write 병합 + 프레임 플랜 부분 캐시                                                                                | Implemented | 2026-04-17                                                           |
| [068](completed/068-menu-items-ssot-and-menuitem-spec.md)                           | Menu items SSOT + MenuItem Spec 신설 (D2 + D3 동시 정합)                                                                                                       | Implemented | 2026-04-17                                                           |
| [067](completed/067-style-panel-skia-native-read-path.md)                           | 스타일 패널 Skia-native Read Path 전환 (Jotai 제거)                                                                                                            | Implemented | 2026-04-15                                                           |
| [066](completed/066-tabs-items-ssot-migration.md)                                   | Tabs items SSOT 전환 — RAC Collection Items 패턴 정합                                                                                                          | Implemented | 2026-04-15                                                           |
| [065](completed/065-panel-component-removal.md)                                     | Panel 컴포넌트 제거 — SSOT D2 위반 해소                                                                                                                        | Implemented | 2026-04-15                                                           |
| [064](completed/064-componentspec-shapes-variant-removal.md)                        | ComponentSpec shapes API — variant 파라미터 제거 + self-lookup 전환                                                                                            | Implemented | 2026-04-15                                                           |
| [063](completed/063-ssot-chain-charter.md)                                          | SSOT 체인 정본 정의 — 3-Domain 분할 (RAC/RSP/Spec)                                                                                                             | Accepted    | 2026-04-21                                                           |
| [062](completed/062-field-spec-rsp-conformance.md)                                  | Field 컴포넌트 Spec 정리 — RSP 참조 기반 variant 제거 + isQuiet 보강                                                                                           | Implemented | 2026-04-13                                                           |
| [061](completed/061-focus-ring-tokenization.md)                                     | Focus Ring 토큰화 — 50개 리터럴 해체                                                                                                                           | Implemented | 2026-04-13                                                           |
| [060](completed/060-form-control-indicator-schema.md)                               | Form Control Indicator 스키마 확장 — 매직 테이블 해체                                                                                                          | Implemented | 2026-04-13                                                           |
| [059](completed/059-composite-field-skip-css-dismantle.md)                          | Composite Field CSS SSOT 확립 — 대칭 파이프라인 복귀                                                                                                           | Implemented | 2026-04-15                                                           |
| [058](completed/058-text-tags-legacy-dismantle.md)                                  | TEXT_TAGS 예외 경로 해체 — Text/Heading/Paragraph/Kbd/Code Spec-Fi…                                                                                            | Implemented | 2026-04-11                                                           |
| [057](completed/057-text-spec-first-migration.md)                                   | specShapeConverter Text Shape Feature Parity 이식                                                                                                              | Implemented | 2026-04-10                                                           |
| [056](completed/056-base-typography-ssot.md)                                        | 프로젝트 레벨 Base Typography 단일 정본                                                                                                                        | Implemented | 2026-04-22                                                           |
| [055](completed/055-event-registry-ssot.md)                                         | 이벤트 레지스트리 SSOT 통합                                                                                                                                    | Implemented | 2026-04-06                                                           |
| [054](completed/054-local-llm-architecture.md)                                      | 로컬 LLM 아키텍처 (Ollama → node-llama-cpp)                                                                                                                    | Deprecated  | 2026-05-13                                                           |
| [053](completed/053-s2-props-coverage-expansion.md)                                 | S2 Props 커버리지 확장                                                                                                                                         | Implemented | 2026-04-05                                                           |
| [052](completed/052-s2-props-api-alignment.md)                                      | S2 Props API 정합성 마이그레이션                                                                                                                               | Implemented | 2026-04-05                                                           |
| [051](completed/051-pretext-text-measurement-integration.md)                        | 텍스트 측정 CSS 정합성 — Canvas 2D 내재화                                                                                                                      | Superseded  | 2026-04-08                                                           |
| [050](completed/050-container-overflow-property.md)                                 | Container Overflow 프로퍼티 — Preview CSS + Figma 스타일 WebGL 시각화                                                                                          | Implemented | 2026-04-03                                                           |
| [049](completed/049-canvas-drag-drop-pencil-parity.md)                              | Pencil 패턴 기반 Canvas Drag & Drop 정합성                                                                                                                     | Accepted    | 2026-04-01                                                           |
| [048](completed/048-declarative-props-propagation.md)                               | S2 Context 기반 선언적 Props Propagation                                                                                                                       | Accepted    | 2026-03-27                                                           |
| [047](completed/047-s2-popover-overlay-alignment.md)                                | S2 Popover/Overlay CSS 정합성 정렬                                                                                                                             | Implemented | 2026-03-26                                                           |
| [046](completed/046-s2-contract-expansion-form-colorfield-tabs.md)                  | S2 계약 확장 — Form, ColorField, Tabs                                                                                                                          | Implemented | 2026-03-29                                                           |
| [045](completed/045-s2-property-editor-alignment.md)                                | S2 Property Editor 프로퍼티 정합성 정렬                                                                                                                        | Implemented | 2026-03-29                                                           |
| [044](completed/044-project-renaming-xstudio-to-composition.md)                     | 프로젝트 리네이밍 — composition → composition                                                                                                                  | Implemented | 2026-04-07                                                           |
| [043](completed/043-selection-drag-alignment.md)                                    | Selection Drag Alignment - Pencil 패턴 기반 선택 이동 정렬                                                                                                     | Implemented | 2026-03-30                                                           |
| [042](completed/042-spec-dimension-injection.md)                                    | Spec Container Dimension Injection — Spec Shapes 레이아웃 크기 주입 패턴                                                                                       | Implemented | 2026-05-13                                                           |
| [041](completed/041-spec-driven-property-editor.md)                                 | Spec-Driven Property Editor — Spec 기반 프로퍼티 에디터 자동 생성                                                                                              | Accepted    | 잔여 Hybrid 2개(Tabs/Slider), Custom 25개 중 자동화 가능 에디터 검토 |
| [040](completed/040-visible-page-delta-runtime.md)                                  | Visible Page + Delta Runtime — 전체 요소 교체에서 visible-page/delta…                                                                                          | Implemented | 2026-03-14                                                           |
| [039](completed/039-page-scoped-rendering.md)                                       | Multi-page Canvas Page-Scoped Rendering — Visible Page 중심 렌더…                                                                                              | Implemented | 2026-03-13                                                           |
| [038](completed/038-figma-import.md)                                                | Figma 디자인 임포트 시스템                                                                                                                                     | Deprecated  | 2026-05-13                                                           |
| [037](completed/037-workspace-scene-runtime-rearchitecture.md)                      | Workspace Scene Runtime 재구성 — Scene Snapshot, Invalidation M…                                                                                               | Implemented | 2026-03-13                                                           |
| [036](completed/036-spec-first-single-source.md)                                    | Spec-First Single Source — Spec shapes 기반 CSS 자동 생성                                                                                                      | Superseded  | 2026-07-08                                                           |
| [035](completed/035-workspace-canvas-refactor.md)                                   | Workspace Canvas Runtime 리팩토링 - 동작 보존 기반 구조 단순화와 성능 최적화                                                                                   | Implemented | 2026-03-13                                                           |
| [034](completed/034-events-panel-renovation.md)                                     | Events Panel Renovation                                                                                                                                        | Deprecated  | 2026-05-13                                                           |
| [033](completed/033-css-property-ssot-consolidation.md)                             | CSS 속성 SSOT 통합 — 구조 속성 변수화 + 재선언 제거                                                                                                            | Implemented | 2026-03-11                                                           |
| [032](completed/032-events-data-integration.md)                                     | ADR-032 v2: Events Platform 재설계 - Capability, Effect, Recipe…                                                                                               | Deprecated  | 2026-05-13                                                           |
| [031](completed/031-card-s2-migration.md)                                           | Card 컴포넌트 React Spectrum S2 마이그레이션                                                                                                                   | Accepted    | 2026-03-09                                                           |
| [030](completed/030-s2-spectrum-only-components.md)                                 | React Spectrum S2 전용 컴포넌트 WebGL 마이그레이션                                                                                                             | Implemented | 2026-03-07                                                           |
| [029](completed/029-builder-css-dead-code-cleanup.md)                               | Builder CSS Dead Code 정리 — 유령 변수, 미사용 토큰, 모놀리식 파일 분리                                                                                        | Implemented | 2026-03-07                                                           |
| [029](completed/029-text-edit-overlay-improvements.md)                              | Text Edit Overlay UX 개선                                                                                                                                      | Accepted    | 2026-03-08                                                           |
| [028](completed/028-builder-css-scope-isolation.md)                                 | Builder CSS 스코프 격리 — `[data-context="builder"]` 단일 선택자 전환                                                                                          | Implemented | 2026-03-07                                                           |
| [026](completed/026-responsive-constraint-ui.md)                                    | Responsive Constraint UI — Figma식 시각적 제약 조건 → CSS 매핑                                                                                                 | Implemented | 2026-05-13                                                           |
| [025](completed/025-s2-named-color-palette.md)                                      | S2 Named Color Palette 확장                                                                                                                                    | Accepted    | 2026-03-08                                                           |
| [024](completed/024-s2-css-variable-migration.md)                                   | CSS 변수명 S2 체계 전환                                                                                                                                        | Superseded  | 2026-03-09                                                           |
| [023](completed/023-s2-component-variant-props.md)                                  | 컴포넌트 Variant Props S2 전환                                                                                                                                 | Accepted    | 2026-03-05                                                           |
| [022](completed/022-s2-color-token-migration.md)                                    | React Spectrum S2 색상 토큰 체계 전환                                                                                                                          | Accepted    | 2026-03-05                                                           |
| [021](completed/021-theme-system-redesign.md)                                       | 테마 시스템 개편 — Tint + Tailwind 기반 인라인 테마 패널                                                                                                       | Accepted    | 2026-03-09                                                           |
| [020](completed/020-design-kit-improvement.md)                                      | Design Kit 패널 분석 및 개선 계획                                                                                                                              | Superseded  | 2026-04-27                                                           |
| [019](completed/019-icon-system.md)                                                 | 아이콘 시스템 — Builder UI 아이콘 선택/변경/추가                                                                                                               | Implemented | 2026-03-08                                                           |
| [018](completed/018-component-css-restructure.md)                                   | 컴포넌트 CSS 구조 재작성 — react-aria-starter 패턴 기반                                                                                                        | Implemented | 2026-03-07                                                           |
| [017](completed/017-css-override-ssot.md)                                           | React-Aria CSS Override SSOT — M3 제거 + Tailwind 통합                                                                                                         | Implemented | 2026-03-04                                                           |
| [016](completed/016-photoshop-ui-ux.md)                                             | Photoshop 벤치마크 기반 UI/UX 적용 계획                                                                                                                        | Superseded  | 2026-08-26                                                           |
| [015](completed/015-sitemap-layout.md)                                              | Sitemap(Hierarchy) 워크플로우 엣지 추가 계획                                                                                                                   | Deprecated  | 2026-09-07                                                           |
| [014](completed/014-fonts.md)                                                       | FONTS 실행 계획서                                                                                                                                              | Implemented | 2026-03-05                                                           |
| [012](completed/012-rendering-layout-pipeline-hardening.md)                         | 렌더링/레이아웃 파이프라인 하드닝 실행계획                                                                                                                     | Superseded  | 2026-04-30                                                           |
| [011](completed/011-ai-assistant-design.md)                                         | composition AI 기능 업그레이드 설계                                                                                                                            | Superseded  | 2026-05-13                                                           |
| [010](completed/010-events-panel.md)                                                | Events Panel Smart Recommendations                                                                                                                             | Deprecated  | 2026-05-13                                                           |
| [009](completed/009-full-tree-wasm-layout.md)                                       | Figma-Class Rendering & Layout Architecture                                                                                                                    | Superseded  | 2026-04-08                                                           |
| [008](completed/008-layout-engine.md)                                               | ADR: 캔버스 레이아웃 엔진 전환 (전략 D)                                                                                                                        | Implemented | 2026-02-17                                                           |
| [007](completed/007-project-export.md)                                              | Project Export/Import 설계 문서                                                                                                                                | Implemented | 2026-01-02                                                           |
| [006](completed/006-child-composition-remaining.md)                                 | Child Composition Pattern — 전환 완료 보고서                                                                                                                   | Implemented | 2026-02-24                                                           |
| [005](completed/005-css-text-wrapping.md)                                           | CSS 텍스트 래핑 속성 체계적 지원                                                                                                                               | Implemented | 2026-03-03                                                           |
| [004](completed/004-preview-isolation.md)                                           | iframe for Preview Isolation                                                                                                                                   | Accepted    | 2024-01                                                              |
| [003](completed/003-canvas-rendering.md)                                            | PixiJS for Canvas Rendering                                                                                                                                    | Superseded  | 2026-02-05                                                           |
| [002](completed/002-styling-approach.md)                                            | ITCSS + tailwind-variants for Styling                                                                                                                          | Accepted    | 2024-01                                                              |
| [001](completed/001-state-management.md)                                            | Zustand for State Management                                                                                                                                   | Accepted    | 2024-01                                                              |

**Phase 0 baseline 문서** (ADR 아님 — 게이트 기준선): [035](completed/035-phase-0-baseline.md) · [037](completed/037-phase-0-baseline.md) · [039](completed/039-phase-0-baseline.md) · [040](completed/040-phase-0-baseline.md)

**참조 자료** (ADR 아님): [023 S2 Props 전수 조사 비교표](completed/023-s2-props-audit-report.md)

---

## Superseded / Deprecated — 사유와 후속

> 판정 이력: ADR-133 / ADR-134 supersede — 2026-05-13 / ADR-145 supersede ADR-144 — 2026-05-27 / 사용자 결정 ADR-038 — 2026-05-13 / 사용자 결정 ADR-133 폐기 — 2026-07-08 / ADR-167 G0 실측 기각 — 2026-07-26 / 사용자 결정 ADR-016 Superseded → ADR-192 — 2026-08-26 / 사용자 결정 ADR-197 계획 폐기 — 2026-09-03 / 사용자 결정 ADR-015 Deprecated — 2026-09-07

#### [015](completed/015-sitemap-layout.md) — Sitemap Hierarchy 워크플로우 엣지

- **Deprecated 일자**: 2026-09-07
- **사유 / 후속 처리**: **Deprecated — 의도적 미착수 (사용자 결정 2026-09-07)** — P1 hierarchy 엣지 코드 0건. 페이지 IA는 Navigator `PageTree`(`parent_id` 트리·DnD)가 담당하고, 캔버스 워크플로우는 nav/event 실제 이동을 보여준다. P2 `addPage` 방향은 이 ADR과 무관하게 이미 반영. P3는 별도 결정. 재개 시 본문 경로(`SkiaOverlay.tsx` 등) 미승계. 사용자-가시 변화 없음이라 CHANGELOG 엔트리 없음.

#### [197](completed/197-builder-chrome-state-icon-morph.md) — Builder chrome 상태 아이콘 morph — morphicons core vendoring + StateIcon 레지스트리 (canvas 미적용)

- **Deprecated 일자**: 2026-09-03
- **사유 / 후속 처리**: **계획 폐기 (사용자 결정 2026-09-03)** — 2026-08-30 구현 전량 롤백 ("기대보다 퀄리티가 떨어진다") 후 재개하지 않기로 확정. 코드 흔적 0 (`morphicons`/`MorphIcon`/`StateIcon` grep 0건), 사용자-가시 변화 net-zero 라 CHANGELOG 엔트리 없음. 문서는 음성 결과 기록으로만 보존 — 값이 남은 것은 본문 §롤백에서 남은 것 6항목 (전환 자체는 동작 / 초기 chunk +7,236 B gz / 교체 가능 지점 8곳뿐 / rAF 는 포그라운드 탭에서만 / `shared/ToggleButton` children element 계약 / 아이콘 정본 3중화 충돌). 같은 주제 재개는 이 문서가 아니라 새 ADR

#### [016](completed/016-photoshop-ui-ux.md) — Photoshop 벤치마크 기반 UI/UX 적용 계획 (v2)

- **Deprecated 일자**: 2026-08-26
- **사유 / 후속 처리**: **Superseded** — 실질 항목 전부 타 ADR 반영 또는 전제 소멸: Context Menu → ADR-182, Floating Panel → ADR-922 + ADR-186, History UI → ADR-180 (아이콘 12종·redo 흐림·점프 재실측 완료), Comments/Presence → ADR-128 전제 소멸, PixiJS 연동 → ADR-900 전제 소멸, AI Variations → ADR-134 후속 판정. 유일 미반영 **Contextual Action Bar** 는 Photoshop Web·Figma 리서치 후 [ADR-192](completed/192-contextual-action-bar.md) 재설계 (016 §5 설계안 미승계). WCAG AA 감사 → ADR-191 팔레트 단일화 후속. 사용자 결정 (2026-08-26)

#### [172](completed/172-pan-path-derived-cost.md) — 팬 경로 파생 비용 제거 — 카메라 이동과 파생 계층 분리

- **Deprecated 일자**: 2026-07-30
- **사유 / 후속 처리**: **실사용 회귀로 코드 전량 되돌림** (Implemented 당일). G1~G5 를 전부 통과했으나 측정 조건이 본 ADR 이 최적화한 경우(팬 + 가시 집합 불변, 합성 벤치 문서)만 골라 재고 있었다 — 실사용에서 성능 개선 체감 0. ADR-173 과 함께 `61a191b35` 로 되돌림. 재시도 선결 조건은 본문 §되돌림 기록

#### [173](completed/173-gesture-raster-deferral.md) — 제스처 중 재래스터 이연 — 컬링 기준면 정합 · 제스처 freeze + content Picture replay

- **Deprecated 일자**: 2026-07-30
- **사유 / 후속 처리**: **Phase 1 설계 실수 + 실사용 회귀로 코드 전량 되돌림** (Implemented 당일). 컬링 반경 200→512 는 blit 적중률을 위해 래스터 면적을 2배로 늘린 **거래**였고 실사용 문서에서 손해였다 — 직접 귀결로 텍스트 불특정 소실(가시 텍스트 1,416 > paragraph 캐시 상한 1,000 스래싱). Phase 1 재시도 금지

#### [167](completed/167-on-demand-frame-loop.md) — on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지 (Pen v1.2.1 차용 후보 ①)

- **Deprecated 일자**: 2026-07-26
- **사유 / 후속 처리**: **G0 실측 기각** — 유휴 비용 6.7ms/s = 코어 0.67% (213 샘플). HC3(idle wake 0) 은 `performanceMonitor` 무게이트 rAF 루프 탓 단독 달성 불가. 비용 질량은 상호작용 프레임 884ms/s(코어 88%)로 ADR-153 소관. wake 인벤토리 실측본(design §3)은 재개 시 유효. 리뷰 round 1 승인 후 게이트 기각

#### [144](completed/144-collection-template-element-ssot.md) — Collection 컴포넌트 Template Element SSOT — RAC dynamic collection 정통 패턴 적용

- **Deprecated 일자**: 2026-05-27
- **사유 / 후속 처리**: **Superseded by ADR-145**. Codex Round 4 독립 리뷰가 본 ADR 의 단일 Family axis (template element 존재 여부) 가 본질 axis 가 아님 발견 — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 멤버십 ↔ child element 자동 생성 ↔ items SSOT 강도 3 axis 직교. Tabs hybrid / Toolbar items 없음 / Menu Skia trigger only 등 11 컴포넌트 단일 일괄 처리 본질 정밀도 부족. 사용자 결정 (2026-05-27 "adr-144 폐기후 ListBox 단일 에 집중") — ADR-145 (ListBox 단일 시범) fork. Round 1-3 정정 이력 + Codex Round 2/4 결함 분석은 historical reference 로 보존, ADR-145 fork 결정 자료. 본문 `144-collection-template-element-ssot.md` (Deprecated marker + 폐기 사유 inline)

#### [133](completed/133-events-panel-simplification.md) — EventsPanel UX 단순화 (1년차 신입 baseline) + canonical events/actions 단일화 + ActionsPanel 흡수 + RAC convention 정합

- **Deprecated 일자**: 2026-07-08
- **사유 / 후속 처리**: **Deprecated — 후속: ADR-149 (2026-07-08 작성)**. 사용자 결정 (2026-07-08 "133은 폐기 후 재설계 대상") — 설계 목적(depth 4→2 / canonical primary / ActionsPanel 흡수 / RAC callback 정합) 보존, sub-decision D1~D9 + RAC/RSC 벤치마크 evidence 는 재설계 ADR 전제 검증 자료. ADR-148 과 도메인 직교(events vs reusable 등록·slot)라 흡수 대상 아님. ADR-010/032/034 의 "Replaced by ADR-133" 마킹은 historical 유지 — 재설계 ADR 이 최종 후속

#### [010](completed/010-events-panel.md) — Events Panel Smart Recommendations

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: **Replaced by ADR-133**. P0/P1 land 영역 (RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / 누락 경고 4 영역) ADR-133 D5 흡수. P1.5 UX 폴리싱 + P2 AI 자연어 생성 / 커맨드 팔레트 / 시뮬레이션 / 개인화 추천 → ADR-134 응용 이관

#### [032](completed/032-events-data-integration.md) — Events Platform 재설계 v2

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: **Replaced by ADR-133 + ADR-131 partial supersede 완결**. events/actions root collection schema → ADR-131 / canonical UI 표면 → ADR-133 D2/D3/D4. TriggerRegistry / EffectRegistry / CapabilityRegistry / RecipeRegistry / BindingRef AST / Condition DSL 완전 AST → ADR-134

#### [034](completed/034-events-panel-renovation.md) — Events Panel Renovation

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: **Replaced by ADR-133**. Panel UX 전면 개편 (4 depth → 2 depth) → ADR-133 D1 + canonical primary → D2. 7 섹션 IA / recipe 중심 UX / diagnostics / preview / Manual/Recipe/Broken 상태 모델 / Property Editor 이벤트 설정 제거 (108 에디터) → ADR-134

#### [038](completed/038-figma-import.md) — Figma 디자인 임포트 시스템

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: 사용자 결정: "현재 불필요하며 ADR 설계 규칙에 의거하여 설계되지 않아 필요시 재설계 해야 한다". 향후 재제안 시 adr-writing.md Risk-First 템플릿 + framing checkpoint 4 질문 + 3-domain 분류 절차 통과 의무

#### [011](completed/011-ai-assistant-design.md) — AI Assistant 설계 (Tool Calling)

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: **Replaced by ADR-134**. Phase A1~A4 land 산출물 (7개 도구 + AIPanel + AbortController + G.3 시각 피드백 + IntentParser fallback + aiVisualFeedback) 은 ADR-134 Phase 2 (벤더 SDK 제거 + secret isolation — 2026-08-18 노선 개정) + Phase 3 (canonical 정합) + Phase 8 (AIPanel UX 단순화) 에서 점진 전환. 작성 시점 (2026-01-31) 의 legacy `elementsMap`/`childrenMap` mutable subscription 기반 도구 시그니처가 canonical document SSOT (ADR-116/122) / data_tables SSOT (ADR-132) / events/actions root collection (ADR-131) / frame canonical (ADR-130) / AIPanel UX 1년차 신입 baseline (ADR-133) 와 미정합

#### [054](completed/054-local-llm-architecture.md) — 로컬 LLM 아키텍처 (Ollama → node-llama-cpp)

- **Deprecated 일자**: 2026-05-13
- **사유 / 후속 처리**: **Replaced by ADR-134**. Proposed 상태로 반영 0건. Provider 추상화 base 영역 + Hard Constraints 7개 + Gates G1-G6 모두 ADR-134 (단일 통합) 에 정합 갱신되어 흡수 — 단 Ollama 전용 어댑터 / node-llama-cpp 내장 / Qwen 고정 / 난이도 라우팅은 ADR-134 2026-08-18 노선 개정 (노선 α 기각) 으로 승계 종료. 작성 시점 (2026-04-05) 이후 land 된 canonical document SSOT / data_tables SSOT / events/actions root collection / frame canonical / AIPanel UX 1년차 신입 baseline 정합 미반영. design breakdown 본문 (`design/054-local-llm-architecture-breakdown.md`) 은 ADR-137+ 응용 영역 (AI 멀티모달 / CanvasKit 스키마 변환 / 인스턴스 도구 / AI 텍스트 생성 / 접근성 감사 / MCP Protocol) 미래 참조용으로 유지

#### [147](completed/147-listboxitem-slot-composition.md) — ListBoxItem Slot Composition Model (label/description/icon/SelectionIndicator)

- **Deprecated 일자**: 2026-07-08
- **사유 / 후속 처리**: Superseded by [ADR-148](completed/148-reusable-slot-system-unification.md) — Phase 1~5 반영분(조합 자식 slotRole + DOM `<Text slot>` emit)은 ADR-148 이 승계. 잔여 slot 확산은 ADR-148 Phase 4.

#### [920](completed/920-rac-format-interactive-projected-tree.md) — RAC Format Interactive Projected Tree — Pencil식 tree 구조 + Skia 하위 노드 직접 접근

- **Deprecated 일자**: 2026-06-02
- **사유 / 후속 처리**: Superseded by [ADR-910](910-rac-pencil-component-architecture.md) — 같은 외부 입력(react-aria-starter + Pencil format)을 ADR-910 이 1차 원리로 재구성하며 흡수.

---

## Spec SSOT 해체 ADR 체인 — **ADR-036 Fully Implemented 달성 (2026-04-22 세션 18)**

ADR-036 "Spec-First Single Source" 잔존 예외 경로 5축 및 후속 debt 전원 해체 완결. Charter-level 100% + 실 debt 0 (@sync / skipCSSGeneration G3-G4 / ADR-082 / ADR-078 잔존 workaround 전부 청산). 실 코드 Leaf CSS 자동 생성률 79.5% (93/117 spec) = symmetric consumer 구조적 상한 도달.

### 5축 해체 (Text / Composite / Form Control / Focus Ring / Layout primitive)

- [ADR-057](completed/057-text-spec-first-migration.md) — Text shape feature parity 이식 (Implemented 2026-04-13)
- [ADR-058](completed/058-text-tags-legacy-dismantle.md) — Text/Heading/Paragraph/Kbd/Code 예외 경로 해체 (Implemented)
- [ADR-059](completed/059-composite-field-skip-css-dismantle.md) — 59개 Composite `skipCSSGeneration: true` 해체 (Implemented 2026-04-15 B5 완결 + 2026-04-16 cssEmitMode/propagation 보완)
- [ADR-060](completed/060-form-control-indicator-schema.md) — Checkbox/Radio/Switch/Slider 매직 테이블 6개 해체 (Implemented 2026-04-13)
- [ADR-061](completed/061-focus-ring-tokenization.md) — Focus Ring 50개 리터럴 토큰화 (Implemented 2026-04-13)
- [ADR-079](completed/079-spec-defaults-read-through-layout-primitive-ssot.md) — Layout primitive SSOT 완전화 (ADR-078 post-fix workaround 4종 해체, Implemented 2026-04-19)

### Primitive 리프팅 체인 (ADR-083 ~ 096, 14 건)

ADR-083 archetype base-styles / ADR-084 implicitStyles 분기 해체 / ADR-085 containerStyles grid-template / ADR-086 implicitStyles size Record / ADR-087 implicitStyles 잔존 분기 sweep / ADR-088 sizeSpec columnGap / ADR-089 containerStyles position / ADR-090 GridListItem Skia metric SSOT / ADR-091 utils Record / ADR-092 Card slot / ADR-093 synthetic-merge container / ADR-094 childSpecs registry 자동 등록 / ADR-095 Propagation 주입 / ADR-096 default element dimensions — **전원 Implemented 2026-04-19~21**.

### 자식 네이밍 RSP 정합 (ADR-098 Charter + 6 슬롯, ADR-099 ~ 104)

ADR-098 Charter + ADR-099 (098-c Collection Section/Header) / ADR-100 (098-a Select) / ADR-101 (098-b ComboBox) / ADR-102 (098-d SelectIcon) / ADR-103 (098-e CheckboxItems/RadioItems) / ADR-104 (098-f Card 시리즈) — **전원 Implemented 2026-04-21**.

### SSOT audit Charter (ADR-105 + ADR-106)

- [ADR-105](completed/105-sync-annotation-audit-charter.md) + sub ADR-105-a/b/c/d — `@sync` 37건 전원 해소 (Implemented 2026-04-21)
- [ADR-106](completed/106-skipcssgeneration-audit-charter.md) + sub ADR-106-a/b/c/d — `skipCSSGeneration: true` 27건 분류 완결, G3-G4 debt 0 (Implemented 2026-04-21)

### 3-Domain Charter (ADR-063)

- [ADR-063](completed/063-ssot-chain-charter.md) — D1(DOM/접근성=RAC) / D2(Props=RSP 참조) / D3(시각=Spec SSOT) 분할 명문화 (Accepted 2026-04-21)

### Base Typography / :root 대칭 (ADR-056 + ADR-107)

- [ADR-056](completed/056-base-typography-ssot.md) — `themeConfigStore.baseTypography` + Canvas/Preview/Publish 3경로 Base Typography SSOT (Implemented 2026-04-22 세션 15)
- [ADR-107](completed/107-preview-publish-root-symmetry.md) — `shared-tokens.css :root` font-family + line-height + Preview body 하드코딩 제거 + `handleThemeBaseTypography` documentElement.style 확장, Gate G1-G6 전원 PASS (Implemented 2026-04-22 세션 18)

**체인 완결 시점**: 2026-04-22 세션 18 (HEAD `a82bd9f3`). ADR-036 → "Fully Implemented" 재승격 근거 충족.

## Events Panel 설계 문서군

- [ADR-032](completed/032-events-data-integration.md): 이벤트 플랫폼 상위 아키텍처
- [ADR-034](completed/034-events-panel-renovation.md): Events Panel 전면 UX 개편 결정
- [events-panel-wireframe.md](design/events-panel-wireframe.md): 화면 구조 와이어프레임
- [events-panel-state-model.md](design/events-panel-state-model.md): 패널 상태 모델
- [events-panel-recipe-system.md](design/events-panel-recipe-system.md): recipe 시스템 상세 설계
- [events-panel-binding-diagnostics.md](design/events-panel-binding-diagnostics.md): binding diagnostics 설계
- [events-panel-review-checklist.md](design/events-panel-review-checklist.md): 설계 리뷰 체크리스트

## Workspace Runtime 설계 문서군

- [ADR-035](completed/035-workspace-canvas-refactor.md): 1차 runtime 구조 정리
- [workspace-canvas-refactor-breakdown.md](design/workspace-canvas-refactor-breakdown.md): ADR-035 작업 분해
- [ADR-037](completed/037-workspace-scene-runtime-rearchitecture.md): Scene Snapshot/Interaction Model 후속 구조 재구성 완료
- [ADR-039](completed/039-page-scoped-rendering.md): visible page 중심 page-scoped rendering 완료
- [ADR-040](completed/040-visible-page-delta-runtime.md): visible page + delta update 모델로 상태 동기화 계약 전환 완료
- [039-phase-0-baseline.md](completed/039-phase-0-baseline.md): ADR-039 baseline 및 budget
- [037-phase-0-baseline.md](completed/037-phase-0-baseline.md): ADR-037 phase gate 기준
- [workspace-scene-runtime-breakdown.md](design/workspace-scene-runtime-breakdown.md): ADR-037 실행 분해
- [workspace-scene-phase-1-scenesnapshot.md](design/workspace-scene-phase-1-scenesnapshot.md): Phase 1 상세 구현 설계

---

---

## 보류 항목

| 출처       | 항목                      | 사유               | 재개 조건         |
| ---------- | ------------------------- | ------------------ | ----------------- |
| ADR-006    | Table/Tree 자식 조합 패턴 | 다단계 중첩 복잡도 | 별도 설계 필요    |
| ADR-010 P2 | AI 이벤트 생성            | 장기 계획          | AI 인프라 성숙 후 |

---

---

---

## ADR 작성 가이드라인

> **규칙**: [`.agents/rules/adr-writing.md`](../../.agents/rules/adr-writing.md) — Codex용 Risk-First Design Loop 엔트리포인트. legacy 상세가 필요할 때만 [`.claude/rules/adr-writing.md`](../../.claude/rules/adr-writing.md)를 참고한다.
>
> **생성**: "ADR 생성" 또는 `/create-adr` — 번호 자동 할당 + 템플릿 적용 + 이 README 동시 갱신.

---

> Status 가 Proposed 면 위 `### 진행 중 / 미구현` 절에, 완료 승격 시 `## 완료 ADR` 표로 옮긴다.
>
> **아카이브 규칙**: 세션별 진행 서술을 이 파일에 쌓지 않는다 — 그 정본은 CHANGELOG 와 각 ADR 본문이다.
