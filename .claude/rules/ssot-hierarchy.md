# SSOT 체인 정본 — 3-Domain 분할

> **정본**: composition 프로젝트 전체의 SSOT/권위 관계를 규정하는 최상위 규칙. 모든 ADR, skill, agent, 규칙 파일은 본 문서를 참조한다. 본 문서가 ADR-063(charter)의 명시적 부연이며, D3 SSOT 메커니즘은 ADR-142(2026-06-02 Implemented)로 재정의됐다. 다른 문서와 충돌 시 본 문서 우선.

> §0 역사적 맥락 · §2 용어 사전 · §5 주요 ADR 관계 (2026-08-31 분리) 와 §9 사례 · 집행 · 허용 패턴 (2026-11-19 분리) 은 [ssot-hierarchy-context.md](ssot-hierarchy-context.md) 에 있다 — 그 파일의 frontmatter `paths` (ADR 문서 · catalog · rendering · Canvas) 작업 시 자동 로드. 절 번호는 인용 안정성을 위해 그대로 둔다.

## 1. 3-Domain 분할 (핵심)

composition 아키텍처는 **3개의 독립 domain**으로 구성된다. 각 domain은 고유 권위를 가지며 경계 교차 금지.

| Domain              | 권위                                                                      | 내용                                                      | catalog 개입                      |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| **D1. DOM/접근성**  | **설치된 `react-aria-components` (절대)**                                 | HTML 구조, ARIA 속성, 키보드 동작, 포커스 관리, 접근성    | **금지 — 관찰·소비만**            |
| **D2. Props/API**   | **S2 `@react-spectrum/s2` 1.8.2 (고정) → design-data → v3 → custom 확장** | prop 이름 · 값 (isEmphasized, variant, staticColor 등)    | 타입 선언만, 구현은 RAC + custom  |
| **D3. 시각 스타일** | **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens (SSOT)**                | 화면에 보여지는 style 전부 — 색상/크기/폰트/레이아웃/형태 | **Frame/Group/Slot 포함 catalog** |

### D1 (DOM/접근성)

- **소유자**: 설치된 `react-aria-components` 패키지 — unstyled primitive 라이브러리. 버전 범위는 `pnpm-workspace.yaml` `catalogs.default` 가 정하고 (설치되는 판은 `pnpm-lock.yaml` 이 고정) `apps/builder` · `packages/shared` 가 소비한다
- **정본 판정**: DOM·ARIA·동작 질문은 설치된 패키지 소스 (`node_modules/react-aria-components`) 로 답한다. 읽기용 문서는 `react-aria` skill (`.claude/skills/react-aria/references/` — 공식 Agent Skill 스냅샷, 설치본과 다르면 설치본). 예제 코드 (RAC starter 등, 2026-09-29 저장소에서 제거) 는 권위가 없다
- **composition 역할**: RAC가 출력하는 DOM 구조를 **그대로 사용**. 수정/확장 금지
- **선택 이유**: RAC가 unstyled이므로 스타일 자유도 확보 가능 (← 이것이 RAC 선택의 본질적 이유)
- **금지 사항**:
  - RAC 컴포넌트의 DOM 구조 재작성
  - aria 속성 수동 작성 (RAC가 제공하는 것 사용) — 사용자 컴포넌트 (catalog · Preview · Publish) 한정, 빌더 chrome 은 아래 예외
  - 접근성 동작 변경
- **Table 칸 범위 선택 예외 (ADR-315 Phase 6, 사용자 답 2026-11-20 — 범위는 아래 목록으로 닫는다)**: 사용자 컴포넌트 Table 의 「Cell selection」 (`runtime/tableCellSelection.ts`) 만 RAC 가 주지 않는 것을 직접 다룬다 — (1) body 칸의 `aria-selected` (· 시트용 `data-selected`) 와 grid 의 `aria-multiselectable` (APG grid 패턴), (2) 키: Shift + 화살표 (범위 확장 — focus 이동은 RAC 의 것) · Ctrl / Cmd + A (전체) · Ctrl / Cmd + C (브라우저 `copy` 에 탭 구분 글자) · Esc (해제), (3) 포인터: 끌기 · Shift 클릭 · Ctrl / Cmd 클릭. 그대로 두는 것: 칸 focus 이동 · 행 · 칸의 DOM · 정렬 · 폭 조절. 행 선택과 한 표에서 같이 켜지 않는다 (사용자 결정 5). 머리글 · 다른 컴포넌트는 대상이 아니다 — 이 목록을 넘는 구현은 규칙 위반이다. 속성은 ref 로 붙인다 (RAC `render` prop 은 원래 태그를 넘기지 않는다). **넓힘 (ADR-317 — 사용자 승인 2026-11-25, 목록 정본 = ADR-317 breakdown §4)**: 「Paste」 를 켠 표만 (Phase 2, 2026-11-26) — (4) 브라우저 `paste` (`text/plain` — 마지막 범위의 왼쪽 위부터, 키 자체는 가로채지 않는다) · `cut` (복사 + 비움) · Delete · Backspace (범위 비움), (5) 표 안에 focus 가 있을 때 document 의 `beforecopy` · `beforecut` · `beforepaste` 막기 (Safari 편집 메뉴 — react-aria `useClipboard` 와 같다), (6) 결과 알림 영역 하나 — RAC Table 요소 밖 형제 `role="status"` (화면 낭독 전용, `CatalogTable`). 「Fill handle」 을 켠 표만 (Phase 3) — (7) 마지막 범위의 오른쪽 아래 칸 안 손잡이 요소 하나 (`aria-hidden`) 의 끌기 (document 포인터 listener · 표 가장자리 자동 스크롤) 와 Ctrl / Cmd + D. 쓰기는 「Editable」 열의 데이터 칸만 (`editTableCells`).
- **TokenField 필수 · 오류 예외 (S2 체크리스트 §4.1 TokenField 4단계, 사용자 결정 2026-11-23 — 범위는 아래 목록으로 닫는다)**: 설치본 RAC TokenField 는 `isRequired` · validation 이 없고 (`AriaTokenFieldProps` — `isDisabled` · `isReadOnly` 만), TokenInput 은 `aria-*` prop 을 DOM 에 넘기지 않는다 (`filterDOMProps` — 전역 속성 · `data-*` 만). 그래서 사용자 컴포넌트 TokenField 만 (`runtime/tokenField.components.tsx`) (1) TokenInput (`role="textbox"` contenteditable) 에 `aria-required` · `aria-invalid` 를 ref 로 붙이고 (field 의 `isRequired` · `isInvalid` — 꺼지면 지운다), (2) 오류 문구 요소 (`CatalogTokenFieldError` — RAC FieldError context 가 없어 우리가 그리는 `span`, invalid 일 때만) 에 id 를 준다. 문구를 가리키는 것은 RAC 의 `aria-describedby` prop 이다 (`useField` 가 설명 id 와 합친다 — 직접 작성 아님). 그 밖의 속성 · 다른 컴포넌트는 대상이 아니다. RAC 가 TokenField 에 required · validation 을 넣으면 이 예외를 지우고 RAC 것을 쓴다.
- **Resizable 손잡이 예외 (ADR-318, 사용자 답 2026-11-25 「react-aria 훅 + D1 예외」 — 구현 Phase 6 끝 2026-11-26, 범위는 아래 목록으로 닫는다)**: RAC 에 분할창이 없어 사용자 컴포넌트 Resizable 의 `ResizableHandle` 요소 하나만 (`runtime/resizable.components.tsx` — 실행 중 Preview · Publish) 직접 다룬다 — (1) 속성: `role="separator"` · `aria-orientation` (선의 방향 — 가로 Group 이면 `vertical`) · `aria-valuenow` (앞 Panel 의 지금 크기 %, 정수 — px 로 접힌 Panel 은 손잡이를 뺀 자리의 % 로) · `aria-valuemin` · `aria-valuemax` (앞 Panel 이 줄고 늘 수 있는 끝 — 접을 수 있으면 접힌 크기, 뒤 Panel 의 최소를 뺀 값) · `aria-controls` (앞 Panel 요소의 `id`) · `aria-label` (작성값, 없으면 i18n 기본 문구) · `aria-disabled` · `tabIndex` (`0`, 끌 수 없으면 `-1`), (2) 키 (Handle 에 focus 가 있을 때만): Group 축 방향 화살표 (5 % 한 단계) · Home · End (앞 Panel 을 가장 작게 · 크게) · Enter (`collapsible` 이면 접기 · 펼치기) — 축과 다른 화살표 · 그 밖의 키는 `continuePropagation`, 설치본 `useMove` 의 `onKeyDown` 은 화살표 넷을 모두 삼켜 붙이지 않는다, (3) 포인터: 끌기 (`useMove` 의 포인터 handler · pointerdown 의 pointer capture) · 더블클릭 (접기 · 펼치기). Handle 안의 grip 장식 (`span.resizable-grip`) 은 separator 의 자식이라 보조기기에 나가지 않는다. 그대로 두는 것: Group · Panel 은 role 없는 `div` (Panel 은 `aria-controls` 대상인 `id` 만), Panel 안 내용의 DOM · 키 · focus, focus 순서 (문서 순서), RTL 은 대상 아님 (사용자 결정 2026-11-24). 이 목록을 넘는 구현은 규칙 위반이다 — 대조 게이트 `adr318D1List.static.test.ts`. RAC 가 분할창을 내면 이 예외를 지우고 RAC 것을 쓴다.
- **빌더 chrome 예외 — 수동 ARIA 허용 (사용자 결정 2026-11-10)**: 빌더 패널 · 메뉴 등 chrome 은 RAC 컴포넌트가 렌더 비용을 키우는 곳에서 ARIA 속성을 직접 적을 수 있다 (예: 패널 `Section` — RAC `Disclosure` 대신 자체 구현). 속성 이름 · 값은 설치본 RAC · react-aria hook 이 같은 패턴에 내는 계약 (`aria-expanded` · `aria-controls` · `role` · `aria-labelledby` …) 을 따른다. 사용자 컴포넌트는 예외 없음 — Preview · Publish 의 DOM 계약은 RAC 그대로다. **Why**: RAC `DisclosurePanel` 은 닫혀도 내용을 DOM 에 숨겨 두는데, 패널 `Section` 은 닫힌 구획의 내용을 렌더하지 않는다 — 구획이 많은 Design · Navigator 패널이 무거워져 처음부터 RAC 를 쓰지 않았다. 빌더 chrome 은 ADR-305 로 사용자 컴포넌트와 분리돼 있어 이 예외가 사용자 문서에 닿지 않는다.

### D2 (Props/API)

- **정본 순서 (2026-10-09 사용자 결정 — 「S2 1.8.0 고정 우선」, 1.8.0 은 당시 판 · 지금 고정 판은 아래 1번)**: prop 이름 · 값은 위에서부터 처음 답하는 곳을 따른다.
  1. **S2 `@react-spectrum/s2` 1.8.2** (버전 고정 = `apps/builder/package.json` 의 설치 버전 — 올릴 때는 이 줄과 oracle fixture (`adr295-s2-oracle.json` · `adr259-s2-oracle.json`, 생성기로만 갱신) 를 같이 고친다. 2026-11-05 1.8.1 → 1.8.2: 패키지 차이는 `style-macro.ts` 의 JSON import 형식과 빌드 클래스 접미사뿐이라 D2 타입 · D3 값 변화 없음). S2 는 RAC 위에 Spectrum 2 를 얹은 구현이라, 동작 · 상태 · 데이터 prop 은 RAC 이름 그대로이고 (`isSelected` · `selectedKeys` · `orientation` …) 시각 prop 은 Spectrum 축이다 (`variant` · `size` · `isEmphasized` · `fillStyle` · `staticColor` · `isQuiet` · `density`). 이 표면을 그대로 가져오면 D1 과 이름이 충돌하지 않는다. 읽기용 문서는 `react-spectrum` skill (`.claude/skills/react-spectrum/references/components/` — 공식 Agent Skill 스냅샷, 타입과 다르면 설치본).
  2. S2 에 없는 컴포넌트 · 축: **spectrum-design-data** (Spectrum 디자인 정본의 컴포넌트 스키마 — design-data MCP).
  3. 거기에도 없으면 **v3 `@adobe/react-spectrum`** (Spectrum 1 구현 — RAC 가 아니라 react-aria hooks 기반이라 동작 이름이 RAC 와 다를 수 있다: v3 `selectionStyle` ↔ RAC `selectionBehavior`).
  4. 어디에도 없으면 **composition 확장** — `packages/shared/src/catalog/document/d2Provenance.ts` 에 type · key 와 출처 (`v3` · `rac` · `composition`) 를 적는다 (2026-10-14 전까지는 binding 머리말).
- **게이트 (2026-10-14)**: `apps/builder/src/builder/catalogRuntime/__tests__/d2S2Alignment.static.test.ts` 가 설치된 S2 의 TypeScript 타입 (상속한 RAC prop 포함) 과 모든 binding 의 보이는 `accepts` 키 · `options` 값을 대조한다 — S2 에 없는 키는 `d2Provenance.ts` 에 있어야 하고, S2 가 선언하는 키가 거기 있으면 낡은 것으로 막는다. **Why**: 「S2 1.8.0 정본」 (당시 판) 결정 뒤 전수 대조가 없어 Tooltip 의 배치 prop 5 (S2 는 TooltipTrigger 소유) · TooltipTrigger `closeDelay` (S2 가 뺌) · TableView `allowsSorting` (S2 는 Column 단위 — DOM 이 버리던 죽은 칸) · field 12종 `labelAlign: center` (S2 `start · end`) 가 남아 있었다. S2 의 상위집합인 RAC prop (Calendar `visibleDuration` ⊃ S2 `visibleMonths`) 은 `rac` 출처로 둔다.
- **Why**: RAC 는 headless 라 테마를 바꿀 수 있어 채택했고 (D1), prop 개념은 Spectrum 이 앞서 따랐다. 기준이 "RSP" 로만 적혀 v3 · S2 이름이 섞였다 (Meter `warning` · `critical` = v3, Checkbox `variant` ≠ S2 · v3 `isEmphasized` — 2026-10-09 전수 조사). S2 의 스타일은 쓰지 않는다 — 시각 값은 D3 (catalog) 가 정본이다.
- **마이그레이션 기준**: **RAC + custom 구현으로 달성 가능한 범위 전부** 채택
  - 예: `isQuiet` — RAC 지원 가능 → 채택
  - 예: `contextualHelp` — RAC에 직접 없으나 custom 구현 가능 → 채택
  - 기본 정책: **채택 방향**. 명시적 기각은 매우 드묾
- **금지 사항**:
  - 위 정본 순서에 없는 커스텀 prop 임의 도입 (디자인 일관성 훼손) — 확장은 4번으로 명시한다
  - RSP prop 중 RAC로 구현 불가능한 것을 억지 구현

### D3 (시각 스타일)

> 일반 컴포넌트의 SSOT 는 catalog(`COMPONENT_RULES_TABLE`, `packages/shared/src/catalog/`) + theme/tokens root collection(ADR-110)이다. Frame/Group/Slot에도 같은 원칙을 적용한다.

- **SSOT (일반 컴포넌트)**: catalog `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`) + theme/tokens root collection. `PrimitiveBinding` (`packages/shared/src/catalog/bindings/index.ts` 의 `PRIMITIVE_BINDINGS` 가 전체 목록) 이 코드 정의를 담당
- **CSS 생성**: `packages/rendering/scripts/generate-css.ts`가 catalog의 structure·size·variant를 읽는다. 별도 native spec 입력은 없다.
- **값 정본 = S2 설치본, 이름 = 저장소 (ADR-295, 2026-10-31)**: 사용자 컴포넌트의 치수 값 (radius · 글자 단계 · 행간 식 · control 높이 · 아이콘 단 · 여백 · 간격 · 막대 두께) 은 설치된 `@react-spectrum/s2` 의 style macro · 표가 정본이고, TokenRef 이름 (`{radius.md}` · `{size.height.M}`) · 패널 라벨 (XS ~ XL) 은 저장소 것을 그대로 쓴다. 값의 형 (고정 · `scale` 배율 · 글자 상대 · 높이 상대) 도 S2 를 따르며 터치 기기 값 (`scale` 1.25 · 글자 기준 17) 은 resolver 가 두 벌로 낸다. rule 값과 설치본의 대조는 `d3S2Alignment.static.test.ts`, S2 와 다르게 둔 리터럴은 `componentRulesTable.static.test.ts` 의 분류 목록 (의도적 · 대기 0) 이 막는다. 빌더 chrome 은 대상이 아니다 — [css-tokens.md](css-tokens.md) §컨트롤 크기.
- **상태 우선순위 = 조건 트리 순서 한 곳 (ADR-297, 2026-11-02)**: variant 칠과 그 상태 (hover · pressed · selected · emphasized · quiet · fillStyle · staticColor · disabled · invalid) 는 rule 의 `paint` 조건 트리 하나이고 우선순위는 키 순서다 (마지막에 맞는 가지가 이김 — S2 style macro 와 같은 모양). Canvas 는 평가 (`resolveCatalogPaint`), 생성 CSS 는 compile (`compileConditionTree` — 트리 순서 = cascade) 로 같은 트리를 읽는다. 상태 칠을 한 consumer 에만 두거나 두 번째 파생식 (color-mix · opacity) 으로 만들지 않는다 — 상세 [canvas-rendering.md](canvas-rendering.md) §2.5.5.
- **목적**: **Builder(Skia)와 Preview/Publish(DOM/CSS)의 시각 정합성 유지**
- **consumer (대등, symmetric)**:
  - **Builder** = Skia 렌더 (`apps/builder/src/builder/workspace/canvas/skia/*`)
  - **Preview/Publish** = DOM + CSS 렌더 (shared catalog runtime + catalog에서 생성한 CSS)
- **대칭 원칙**: "CSS가 기준, Skia가 따라간다"가 아니며, 역도 아님. **두 경로가 동일 SSOT(catalog)로부터 동일 시각 결과를 산출**하는지 검증
- **대칭 정의 재확인**: 대칭은 "구현 방법"이 아니라 **"시각 결과"의 동일성**. Skia가 arc 그리든 DOM이 border-radius 쓰든 **보여지는 결과가 같으면 통과**
- **금지 사항**:
  - 수동 CSS가 SSOT(catalog)에서 파생이 아니라 독립 정의
  - `@sync` 주석으로 CSS 파일 간 참조 (SSOT 거치지 않은 consumer-to-consumer)
  - Skia 전용 시각 표현 (DOM/CSS로 재현 불가능한 효과를 도입)

children·RAC slot·필수 부품·상태 주체·값 바인딩의 구현·검증은
[RAC 조립 계약](../skills/composition-patterns/rules/domain-rac-composition.md)을 따른다.

**컴포넌트별 부품 노드 · 소유 축 (ADR-251 이후)**: field 가족의 부품 (Label · Input · Button …) 은 부품 원본의 instance 이고 모양은 부품 자신의 rule, 부모 rule 은 배치만 — 글자 축 · style 축의 소유자, picker 의 ListBox · Popover, quiet, 라벨 행 · 도움말, 바탕의 제목 · 설명, 그룹 묶음 노드, toggle indicator, Color 조작기, Table 열 트랙의 구현 사실은 [catalog-subparts.md](catalog-subparts.md) (catalog · catalogRuntime · Canvas catalog 작업 시 자동 로드). 금지: 자식 style 을 RAC 내부 sub-part 로 운반하는 custom prop 신설 (RSP 미규정 — D2 위반).

**D1 ↔ D3 분리 사례 (RAC `Group` ↔ canonical `frame`)**: [ssot-hierarchy-context.md](ssot-hierarchy-context.md) §9.

## 3. 경계 판정 기준

D3 SSOT(catalog)가 어디까지 관여하는지의 판정:

| 요소                                           | 어느 domain? | SSOT 관여                        |
| ---------------------------------------------- | ------------ | -------------------------------- |
| `<div role="...">` 같은 DOM 태그/속성          | D1           | ❌                               |
| `aria-invalid`, `aria-label` 등 ARIA           | D1           | ❌                               |
| 키보드 네비게이션 동작                         | D1           | ❌                               |
| `isQuiet: boolean` props 선언                  | D2           | ✅ (타입만)                      |
| `variant: string` props 선언 (RSP에 없는 경우) | D2 위반      | ❌ (ADR-062로 제거)              |
| 색상 (background/border/text)                  | D3           | ✅ (catalog SSOT)                |
| 크기 (height/padding/gap)                      | D3           | ✅ (catalog SSOT)                |
| 폰트 (size/weight/family)                      | D3           | ✅ (catalog SSOT + theme/tokens) |
| 형태 (border-radius/shadow)                    | D3           | ✅ (catalog SSOT)                |
| 애니메이션/transition                          | D3           | ✅ (catalog SSOT)                |
| layout flow (flex-direction 등)                | D3           | ✅ (catalog SSOT)                |

**회색지대 판정 원칙**: 의심스러우면 **"Builder와 Preview가 시각적으로 달라질 수 있는 요소인가?"** 질문. 그렇다면 D3 → catalog SSOT.

**생성 CSS archetype 미지정 = 중립 상자 (ADR-223)**: [ssot-hierarchy-context.md](ssot-hierarchy-context.md) §9.

## 4. 집행 메커니즘

→ [ssot-hierarchy-context.md](ssot-hierarchy-context.md) §9 (대칭 검증 수단 · 위반 대응 표 · ADR 의 domain 명시 의무).

## 6. 금지 패턴 요약

- ❌ catalog이 DOM 구조 지정 (D1 침범)
- ❌ catalog에 RSP 미규정 prop 도입 (D2 위반) — ADR-062
- ❌ 수동 CSS가 SSOT(catalog)에서 파생 아님 (D3 위반) — ADR-059
- ❌ `@sync` 주석으로 CSS↔CSS 참조 (D3 symmetric 위반)
- ❌ "CSS가 기준, Skia 따라가" 언어 사용 (대칭 위반)
- ❌ Skia 전용 시각 효과를 도입 (대칭 결과 불가능)
- ❌ 컴포넌트당 spec 파일 신규 생성 — 어떤 컴포넌트에도 (ADR-142 로 폐기, 마지막 3개와 `packages/specs` 는 ADR-248 에서 삭제. 예외 없음)
- ❌ RAC 컴포넌트 DOM 재작성 또는 ARIA 수동 작성 (D1 침범) — 사용자 컴포넌트. 빌더 chrome 의 수동 ARIA · Table 칸 범위 선택 · TokenField 필수 · 오류 · Resizable 손잡이는 §1 D1 예외

## 7. 허용 패턴

→ [ssot-hierarchy-context.md](ssot-hierarchy-context.md) §9.

## 8. 참조

- D3 SSOT 재정의 (컴포넌트당 spec → catalog, 2026-07-08 본 문서 반영 · 2026-10-04 Frame/Group/Slot 통합과 specs 패키지 제거): [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md), [ADR-036 Superseded 안내](../../docs/adr/completed/036-spec-first-single-source.md)
- 역사적 맥락 확장: 메모리 `ssot-chain-definition`
- ADR 현황: [docs/adr/README.md](../../docs/adr/README.md)
- composition 패턴: [SKILL.md](../skills/composition-patterns/SKILL.md)
- 대칭 검증 skill: [cross-check](../skills/cross-check/SKILL.md)
