# ADR-199 Phase 0 — 표면 인벤토리 freeze (G0)

> 본문: [199-component-semantics-action-registry.md](../completed/199-component-semantics-action-registry.md) · breakdown [§2](../design/199-component-semantics-action-registry-breakdown.md)
> 기준 commit: `740d15162` · 측정일 2026-08-30 · 전부 소스 직접 인용 (실행 측정 아님 — 정적 freeze)

이 문서가 **이관 후 동일성 판정의 기준선**이다. Phase 2·3 이후 각 표면의 항목·라벨·순서·가용성이 아래와 달라지면 G2 실패로 본다. 아래 "의도적 통일" 로 표시한 항목만 예외이며, 그 변경은 HC5 (사용자 가시 회귀 0) 의 예외로 ADR 본문에 명시돼야 한다.

## 1. 액션 × 표면 매트릭스

| 액션 id                   | Properties 패널                                    | 컨텍스트 메뉴 (ADR-182)                              | 액션 바 (ADR-192)             | 단축키 / agent                                   |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `go-to-origin`            | 아이콘 전용, `Go to component`                     | `원본으로 이동 / Go to component`                    | 메뉴 항목 파생, allowlist 1번 | 없음                                             |
| `detach-instance`         | 아이콘 전용, `Detach instance`                     | `인스턴스 분리 / Detach instance`                    | allowlist 2번                 | `⌘⌥X` (`capture: true`) · agent `detachInstance` |
| `toggle-component-origin` | 라벨 버튼, `Create component` / `Detach component` | `컴포넌트 만들기 / Create component` (원본이면 분리) | allowlist 3번                 | `⌘⌥K` · agent `toggleComponentOrigin`            |
| `select-instances`        | 아이콘 전용, `Select instances (N)`                | **없음**                                             | **없음**                      | 없음                                             |

### 1-1. 노출 순서 (좌→우 / 위→아래)

| 표면            | 순서                                                                                       | 인용                                                           |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Properties 패널 | `go-to-origin` → `detach-instance` → `select-instances` → `toggle-component-origin`        | `ComponentSemanticsSection.tsx:227` / `:238` / `:257` / `:273` |
| 액션 바         | `go-to-origin` → `detach-instance` → `toggle-component-origin` → `duplicate`               | `actionBarPolicy.ts:50-55`                                     |
| 컨텍스트 메뉴   | **`toggle-component-origin` → `go-to-origin` → `detach-instance`** (패널·바와 앞뒤가 반대) | `canvasContextMenuProviders.ts:339` / `:360` / `:379`          |

**발산 D1 (순서)**: 메뉴만 컴포넌트 축이 맨 앞이다. 같은 3개 묶음이 표면에 따라 다른 순서로 선다 — ADR-199 가 없애려는 대상 그 자체. 이관 시 **레지스트리 배열 순서 (패널·바 기준) 로 통일**하는 것이 의도된 변경이며, 메뉴 순서 변경 1건은 HC5 의 명시 예외로 처리한다.

### 1-2. 라벨 어법

| 표면        | 어법                                    | 인용                                                    |
| ----------- | --------------------------------------- | ------------------------------------------------------- |
| 패널        | 영문 단독                               | `ComponentSemanticsSection.tsx:144-145`, `:227`, `:241` |
| 메뉴        | `한국어 / English` 병기                 | `canvasContextMenuProviders.ts:342-344`, `:361`, `:381` |
| 단축키 표기 | `description` 영문 + `i18n.ko`          | `keyboardShortcuts.ts:450-451`, `:462-463`              |
| 바          | 메뉴 항목을 그대로 표시 (자체 문자열 0) | `actionBarPolicy.ts:2-8` 주석                           |

**발산 D2 (라벨)**: 문자열 원본이 2계열. 레지스트리는 `label: { en, ko }` 한 곳에 두고 표면이 자기 어법으로 고른다 (breakdown §3).

## 2. 가용성 조건 (표면별 실제 판정식)

| 액션                      | 패널                                                                          | 메뉴                                                                                                | 바                                                                              |
| ------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `go-to-origin`            | `isInstance` 로 **버튼 노출**, `!originElement` 면 `disabled` (`:229`)        | `isSingleSelection && nonBodyCount === 1 && originElement` — **미노출** (`:337`, `:359`)            | 메뉴에 `go-to-origin` 존재 = `instance` 컨텍스트 판정 (`actionBarPolicy.ts:79`) |
| `detach-instance`         | `isInstance && canDetachInstance(element)` (`:237`)                           | `selectedElements.find(canDetachInstance)` — **다중 선택에서도 첫 detachable 1개** (`:250`, `:378`) | `instance`·`multi` allowlist 양쪽 (`:50-56`)                                    |
| `toggle-component-origin` | 섹션이 뜨면 **항상** 노출, 라벨만 `isOrigin` 으로 뒤집힘 (`:144-145`, `:273`) | `isSingleSelection && nonBodyCount === 1` (`:337`)                                                  | `single`·`frame`·`instance` allowlist (`:45-55`)                                |
| `select-instances`        | `isOrigin && instanceIds.length > 0` (`:255`)                                 | —                                                                                                   | —                                                                               |

**발산 D3 (가용 표현 방식)**: 원본이 없는 인스턴스에서 패널은 **비활성 버튼**, 메뉴는 **항목 자체 없음**. 두 표면의 "없음" 이 서로 다른 형태다.
**발산 D4 (선택 기수)**: `detach-instance` 만 메뉴에서 다중 선택을 받는다 (`find` — 첫 detachable). 패널은 단일 선택 전용, 바는 `multi` 컨텍스트에도 실린다. 레지스트리의 `isAvailable(target)` 이 단일 노드를 받는 계약이면 이 다중 경로는 표면 쪽 필터로 남아야 한다 — **Phase 1 descriptor 설계 시 반영 필요**.

**발산 D5 (판정 축)**: 패널·메뉴 모두 `isEditingSemanticsOrigin` 하나로 컴포넌트 축을 가르고 (`ComponentSemanticsSection.tsx:130`, `canvasContextMenuProviders.ts:249`), 바는 항목 id 존재로 역추론한다 (`actionBarPolicy.ts:68-86`). 축 자체는 이미 일치 — 이관 대상은 축이 아니라 **호출 지점 3곳**.

## 3. 실행 + 확인 경로

| 경로                                     | 실행                                        | 확인 다이얼로그 라벨 fallback                                                           |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 패널                                     | `ComponentSemanticsSection.tsx:174`, `:179` | `:165` — **origin 이름까지 되짚음** (`getComponentDisplayName(element, originElement)`) |
| 메뉴                                     | `canvasContextMenuProviders.ts:395`, `:346` | `:386-391` — `componentName ?? customId ?? type ?? id` (origin 미조회)                  |
| 패널 단축키 (`CanvasSelectionShortcuts`) | `:142`                                      | `:132`                                                                                  |
| 전역 단축키                              | `useGlobalKeyboardShortcuts.ts:266`, `:239` | `:256`                                                                                  |
| agent                                    | `agentCommands.ts:184`, `:176`              | executor confirm 게이트가 담당 — 이 함수 미호출 (`:178` 주석)                           |

**발산 D6 (확인 문구)**: 같은 다이얼로그가 4곳에서 각자 payload 를 만든다. 패널만 원본 이름을 되짚으므로 **같은 인스턴스를 분리해도 표면에 따라 다이얼로그 문구가 다르다**. 이관 시 패널 규칙으로 통일 (R2 · breakdown §5).

## 4. 4상태 × 3표면 기준선 (G2 대조표)

노드 상태는 두 축의 곱이다 — `isEditingSemanticsInstance` × `isEditingSemanticsOrigin` (`editingSemantics.ts:43`, `:55`).

| 상태                      | 패널 항목 (순서대로)                                                                                  | 메뉴 컴포넌트 블록                   | 바 (`instance` 컨텍스트 판정) |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------- |
| **Standard**              | `Create component` (라벨)                                                                             | `컴포넌트 만들기 / Create component` | `single` — duplicate + toggle |
| **Origin** (N=0)          | `Detach component` (라벨)                                                                             | `컴포넌트 분리 / Detach component`   | `single`                      |
| **Origin** (N>0)          | `Select instances (N)` → `Detach component` (라벨)                                                    | `컴포넌트 분리 / Detach component`   | `single`                      |
| **Instance**              | `Go to component` → `Detach instance` → `Create component` (라벨)                                     | 만들기 → 원본 이동 → 인스턴스 분리   | `instance` — 4항목            |
| **Instance·Origin** (N>0) | `Go to component` → `Detach instance` → `Select instances (N)` → `Detach component` (**아이콘 전용**) | 분리 → 원본 이동 → 인스턴스 분리     | `instance`                    |

**패널 폭 제약**: 아이콘 3개 + 라벨 = 235px > 툴바 폭 215px 이므로 `Instance·Origin && N>0` 조합에서만 컴포넌트 축이 아이콘 전용으로 좁아진다 (`ComponentSemanticsSection.tsx:147-148`, `:262-268` 주석 — 2026-08-30 live 실측). 레지스트리 이관 후에도 이 분기는 **표면 고유 렌더 규칙**으로 패널에 남는다 (레지스트리는 라벨/아이콘 둘 다 제공, 표면이 고른다).

## 5. 이관 시 보존 의무 / 의도적 통일 구분

| #   | 항목                                               | 처리                                                                 |
| --- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 메뉴의 컴포넌트 축 선두 순서 (D1)                  | **의도적 통일** — 레지스트리 순서로 변경, HC5 명시 예외              |
| 2   | 메뉴 한/영 병기 · 패널 영문 (D2)                   | **보존** — 표면이 `label.ko`/`label.en` 을 고름                      |
| 3   | 원본 없는 인스턴스: 패널 비활성 / 메뉴 미노출 (D3) | **보존** — `isAvailable` 과 `isEnabled` 를 분리하거나 표면 규칙 유지 |
| 4   | `detach-instance` 의 다중 선택 경로 (D4)           | **보존** — 표면 필터로 남김, descriptor 는 단일 노드 계약            |
| 5   | 확인 다이얼로그 문구 (D6)                          | **의도적 통일** — 패널 규칙으로, 스냅샷 테스트 고정 (R2)             |
| 6   | 패널 폭 215px 아이콘 전용 분기                     | **보존** — 표면 고유 렌더 규칙                                       |

## 6. 수치 기준선 (HC2, 2026-08-30 실측)

| 대상                                        |  값 | 인용                                                                                          |
| ------------------------------------------- | --: | --------------------------------------------------------------------------------------------- |
| `SHORTCUT_DEFINITIONS` 엔트리               |  72 | `keyboardShortcuts.ts:35`                                                                     |
| `COMMAND_META` 엔트리                       |  72 | `commandMeta.ts:139` (`Record<ShortcutId, …>` — `commandMeta.static.test.ts:77` 이 동수 단언) |
| ADR-182 항목 id (separator 제외)            |  18 | `canvasContextMenuProviders.ts` — `align` 서브메뉴 자식 6 별도                                |
| 바 allowlist 계약 집합                      |   7 | `actionBarPolicy.test.ts:229-236`                                                             |
| `detachInstance` 표면 호출부                |   5 | 메뉴·패널·패널단축키·전역단축키·agent                                                         |
| `toggleComponentOrigin` 표면 호출부         |   4 | 메뉴·패널·전역단축키·agent                                                                    |
| `requestEditingSemanticsDetachConfirmation` |   4 | 메뉴·패널·패널단축키·전역단축키                                                               |
| 술어의 잔존 `type` 참조                     |   1 | `editingSemantics.ts:47` (`isEditingSemanticsInstance`) — Phase 4 제거 대상                   |

---

## 7. Phase 2 live 실측 (G2, 2026-08-30 Chrome MCP)

builder `localhost:5173` 실 프로젝트, Properties 패널 · 캔버스 우클릭 메뉴 · 선택 액션 바.

| 상태                  | 패널 (실측)                                                       | 기준선(§4) 일치 |
| --------------------- | ----------------------------------------------------------------- | :-------------: |
| Standard              | `Create component` (라벨)                                         |       ✅        |
| Origin (N=1)          | `Select instances (1)` (아이콘) → `Detach component` (라벨)       |       ✅        |
| Instance              | `Go to component` → `Detach instance` → `Create component` (라벨) |       ✅        |
| Instance·Origin (N=0) | `Go to component` → `Detach instance` → `Detach component` (라벨) |       ✅        |

- 액션 바 (Instance): ⌖ → ◇− → ◇+ → 복제 — 레지스트리 순서대로 (아이콘 확대 캡처로 확인).
- 컨텍스트 메뉴 (Instance·Origin, 캔버스 우클릭): `원본으로 이동 → 인스턴스 분리 → 컴포넌트 …` — **순서 통일 확인** (종전 만들기 선두 → 이제 패널·바와 같은 순서).
- 컨텍스트 메뉴 (pure Origin, `type:"Button" reusable:true`): `컴포넌트 분리 / Detach component` ✅
- 이관 전후 항목 집합·순서·라벨 변화는 D1 (메뉴 순서) 1건뿐 — HC5 명시 예외와 일치.

### 발산 D7 (live 에서만 보임 — 정적 freeze 로는 안 잡힘)

**같은 노드에서 패널과 캔버스 메뉴의 컴포넌트 축 라벨이 반대다.**

- 노드: `93cac1f4…` — store 실측 `{ type: "ref", ref: "fc5fd6ab…", reusable: true }` (Instance·Origin)
- 패널: `Detach component` (원본 맞음)
- 캔버스 우클릭 메뉴: `컴포넌트 만들기 / Create component` — **이미 원본인 노드를 다시 원본으로 만드는 no-op 진입점**
- pure origin (`type:"Button" reusable:true`) 은 메뉴도 `분리` 로 정상 → `reusable` 자체는 사영에 살아 있고, **`ref` 노드의 사영에서만** 인스턴스 자신의 `reusable` 이 사라진다.

이관 전후 동일하므로 Phase 2 회귀 아님 — **선행 결함**이다. 술어는 이미 사영 불변 필드만 읽는데 (HC3) **사영이 그 필드를 싣지 않는** 반대쪽 절반이라, HC3 의 짝으로 Phase 4 에서 다룬다. 후보 경로: `renderers/rendererInput.ts:476` (`interactionNodesMap = renderTree.renderNodesMap`) · `skia/StoreRenderBridge.ts:242-281` (`toSyntheticSceneNode` — `reusable` 은 복사하지만 `ref`/`masterId`/`componentRole` 은 복사하지 않는다).
