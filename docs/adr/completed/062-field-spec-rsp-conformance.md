# ADR-062: Field 컴포넌트 Spec 정리 — RSP 참조 기반 variant 제거 + isQuiet 보강

> **SSOT domain**: D2 (Props/API). 본 ADR은 RSP 미규정 variant prop 제거 + 누락 isQuiet 보강 = D2 규칙 정립. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md), charter: [ADR-063](063-ssot-chain-charter.md).

## Status

Implemented — 2026-04-13 (Phase 1~3 완료, Phase 4 문서/상태 갱신 중)

## Context

composition의 Field 계열 컴포넌트 Spec은 React Spectrum(이하 RSP) 레퍼런스 표준에서 벗어난 `variant` prop을 보편적으로 도입하고 있다. 2026-04-13 실측 결과:

- **RSP 11/11 Field 컴포넌트** (TextField, TextArea, NumberField, SearchField, ColorField, DateField, TimeField, DatePicker, DateRangePicker, ComboBox, Select): `variant` prop 미존재, `isQuiet: boolean`만 시각 variant 개념으로 제공
- **composition 11/11 Field 컴포넌트**: 전부 `variant` prop 선언 — 총 8종 값 혼재 (`default / accent / neutral / purple / negative / positive / error / filled`)
- **composition isQuiet 누락 6개**: TextArea / SearchField / ColorField / DateField / TimeField / ComboBox — RSP 표준 prop조차 미구현

상세 매트릭스: [breakdown 문서](../design/completed/062-field-spec-rsp-conformance-breakdown.md#조사-매트릭스-2026-04-13-실측)

ADR-059 v2 Phase 1 Step 1(TextField 시험대) 실행 중 발견: variant 이름이 Spec(`accent/neutral/...`)과 CSS(`primary/secondary/tertiary/error/filled`)에서 완전 불일치하여 manual CSS variant 블록 전체가 dead code. 이 상태에서 `skipCSSGeneration` 해체를 진행하면 잘못된 variant 개념이 CSSGenerator 출력에 굳어짐.

SSOT 체인 해석 ([ADR-063 charter](063-ssot-chain-charter.md) / [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) 참조):

본 ADR은 **3-domain 분할 중 D2(Props/API) 정리**.

- **D1 (DOM/접근성)** = Adobe RAC 절대 권위. Spec 관여 금지. 본 ADR 범위 밖.
- **D2 (Props/API)** = RSP 참조 + RAC/custom 구현 범위 마이그레이션. **본 ADR의 대상 영역**. RSP 미규정 prop(현재 variant)은 D2 규칙 위반 → 제거. RSP 규정 prop(isQuiet)은 누락 시 보강.
- **D3 (시각 스타일)** = Spec SSOT, Builder(Skia)/Preview(DOM+CSS) 대등 symmetric consumer. 본 ADR은 variant 제거로 D3 내부 variant 이름 불일치(Spec↔CSS dead code) 간접 해소.

**D2 판정 기준**: "RSP가 규정한 Field API 형태인가?"가 첫 질문. 현재 Field의 `variant` prop은 RSP에 없음 + RAC 코어에도 없음 → **D2 위반**. 반대로 isQuiet은 RSP에 있고 RAC로 지원 가능 → D2에 마이그레이션 대상.

**역사적 연속성 — charter는 신규 원칙이 아니라 기존 실태의 명문화**:

composition은 3-domain 분할을 이미 암묵적으로 적용해 왔다:

- **ADR-058 Phase 5 Deferred (2026-04-11)**: rendererMap이 `spec.element` 미사용 — 하드코딩 or React Aria 기본값 사용. "엄격한 Spec-First SSOT"보다 "React Aria 구조 수용"을 선택 → **D1(DOM 축) RAC 수용의 명시적 선례**.
- **ADR-057 기존 구현 재사용 (2026-04-11)**: ADR-005의 Skia 렌더러와 textWrapUtils를 재작성하지 않고 재사용 — 외부 검증 설계 존중 계통.
- **ADR-061 Focus Ring / ADR-060 Form Control Indicator**: D3 내부 정리. Spec에 focus/indicator 수치 SSOT화.

본 ADR은 이 흐름에서 **D2 정리를 담당**. charter(ADR-063)의 3-domain 분할 하에서 variant는 D2 규칙 위반으로 **명확히 분류** 가능 — 이전의 "Spec이 유지 가능한가" 논쟁은 D2 규칙 앞에서 불필요.

**데이터 저장 실태 (2026-04-13 확인)**:

프로젝트/element 데이터 = 사용자 브라우저 IndexedDB. Supabase sync 코드는 `apps/builder/src/dashboard/index.tsx` 에 wired 상태이나 실운용상 미사용 — 본 ADR은 실운용 상태 기준, 중앙 집계 데이터 부재 전제 유지. 기존 저장 data에 잔존할 `variant` 키는 **마이그레이션 없이 런타임 제거**로 처리 (아래 Skia 런타임 소비자 수정 참조). 본 ADR은 **기존 데이터 마이그레이션 기능을 도입하지 않는다** — 시각적 breaking change(variant 기반 색상 일부 소실)는 명시적으로 수용.

**variant 런타임 소비자 전수 조사 (2026-04-13 실측 grep 결과 58건)**:

`variant` prop은 단순 Spec 타입이 아니라 4개 계층에서 능동 소비됨:

1. **Skia 렌더러 (3파일)** — `buildSpecNodeData.ts`, `specTextStyle.ts`, `specTextStyleForOverlay.ts`
2. **공용 훅 (1파일)** — `apps/builder/src/builder/workspace/canvas/hooks/useSpecRenderer.ts`
3. **Spec 렌더러 핵심 (3파일)** — `packages/specs/src/renderers/{ReactRenderer,PixiRenderer,CSSGenerator}.ts`
4. **Spec 검증 스크립트 (2파일)** — `packages/specs/scripts/{validate-specs,validate-tokens}.ts` (`variants` 객체 부재 시 오류 발생)
5. **Shared 렌더러 (2파일)** — `packages/shared/src/renderers/{FormRenderers,LayoutRenderers}.tsx` (`data-variant` 속성 출력)
6. **Properties 패널 (1파일)** — `apps/builder/src/builder/panels/properties/generic/SpecField.tsx` (`Object.keys(spec.variants)` UI 옵션 생성)
7. **Builder 타입 정의 (1파일)** — `apps/builder/src/types/builder/unified.types.ts` 내 Field 계열 `variant?: "default" | ...` 타입 선언(338/367/598/640/668/755/897행 등 15건)

**규모 재산정**: Spec 11 + CSS 11 + 런타임 소비자 11 + 타입 정의 1 = **실제 변경 파일 34개 (내부 수정 지점 58건+)**. 초기 ADR 초안(25파일)은 축소 평가였음.

**Spec에서 `variants` 객체만 제거하면 위 소비자에서 lookup 실패** → 런타임 오류 + validate-specs 검증 실패. 따라서 Spec/CSS/소비자 변경은 **동일 커밋에 원자적 수행** 필수.

추가 고려: `validate-specs.ts`가 현재 `variants` 부재를 에러로 판정 → **validator 규칙 완화**도 본 ADR 범위.

**선행 의존 (Precondition)**:

- **[ADR-064](064-componentspec-shapes-variant-removal.md)** 완료 필수 — `RenderSpec.shapes` 시그니처에서 `variant` 파라미터 제거 + 83 Spec self-lookup 전환. 본 ADR의 Field 개별 `variants` 객체 제거는 ADR-064가 caller의 lookup 책임을 해제한 이후에만 안전. ADR-064 미완료 상태에서 Field `variants` 삭제 시 런타임 오류.

**Hard Constraints**:

1. RSP 표준 API 준수 — `variant` prop 부재, `isQuiet: boolean` 제공
2. Spec 변경 후 CSS↔Skia 11/11 대칭 통과 — Gate G2에서 `parallel-verify` skill로 집행
3. Spec 변경 후 `pnpm build:specs` 외부(Field 가 아닌) 컴포넌트 generated CSS 0 byte diff
4. Spec 변경 후 `pnpm type-check` 3 tasks 통과
5. 접근성 회귀 0 — `aria-invalid` 경로가 기존 `variant="negative"` 시각 표시를 완전 대체 (Storybook 스크린샷 diff 기반 검증)
6. Storybook 스토리 + unit/integration 테스트가 **variant 의존분 마이그레이션 후** 통과 (variant 테스트는 isInvalid/isQuiet 기반으로 전환 or 삭제). **Soft 성격** — Hard는 최종 pass, 중간 변경은 허용.
7. `validate-specs.ts` / `validate-tokens.ts`가 `variants` 없는 Field Spec을 정상 처리 (validator 규칙 완화 포함)

**Infrastructure 전제 (실측 확인 완료 2026-04-13)**:

- `--tint` 전역 시스템: `packages/shared/src/components/styles/theme/preview-system.css` — 단, **per-component 오버라이드 미지원** (`apps/builder/src/builder/main/BuilderCore.tsx`에서 전역 1개만 세팅). 본 ADR의 `variant → tint` 이관은 **per-instance → 전역** 축소를 수반 (Negative에 기재)
- `/cross-check` skill은 단일 컴포넌트용 → Gate G3는 `parallel-verify` skill 또는 11회 순차 실행

**Soft Constraints**:

- ADR-022(시맨틱 토큰) / ADR-036(Spec-First SSOT)와 정합
- **ADR-059 v2 부분 종속** — ADR-062 완료는 ADR-059의 variant 이름 블로커만 해제. ADR-059 breakdown에 기술된 나머지 블로커(size 3중 불일치, state selectors, bridge 변수, base defaults, filled variant, composition 계약 부재)는 **독립 과제**로 ADR-059 v2 재개 시 별도 처리
- 변경 규모: **핵심 코드 34파일 + Storybook/테스트 ~20파일 = 총 ~54파일 (내부 수정 지점 58건+)** — 단일 개발자 3~4일 예상

## Alternatives Considered

### 대안 A: 일괄 제거 (마이그레이션 없음)

- 설명: 11개 Spec의 `variant` prop 타입 + `variants` 객체 + `defaultVariant` 삭제. 11개 CSS의 variant 블록 삭제. **4개 계층의 runtime 소비자 11파일** 수정 — Skia(3) + 훅(1) + Spec 렌더러(3) + Shared 렌더러(2) + SpecField UI(1) + validators(2)에서 variant lookup 제거 및 기본 색상 토큰 직접 참조로 전환. `unified.types.ts`의 Field variant 타입 정의 삭제. isQuiet은 6개 컴포넌트에 일괄 추가. 기존 IndexedDB 저장 데이터의 `variant` 키는 TypeScript/소비자 모두 참조하지 않으므로 자연 소거. 변환 로직/마이그레이션 스크립트 **없음**. ColorField `filled` variant는 단순 제거 (telemetry 미도입).
- 근거: RSP 11/11 일관된 표준. Adobe Spectrum, Radix UI, Shadcn 모두 Field 계열에 variant 미사용. 프로젝트 데이터가 IndexedDB 분산이라 중앙 마이그레이션이 비현실. 시각적 breaking change를 초기 단계의 수용 가능한 비용으로 판정.
- 위험:
  - 기술: **H** — 34파일 / 58+ 수정 지점. 11개 Field별 기본 색상 토큰 선정은 단순 치환이 아니라 **컴포넌트별 시각 정책 재결정**(accent/neutral → 통일된 단일 스타일로 수렴 시 디자인 의도 재정립 필요). validator 규칙 완화로 기존 R1~R3 검증 일부 약화. Storybook/테스트 수정 범위 확정 어려움.
  - 성능: **L** — 런타임 영향 없음
  - 유지보수: **M** — 이후 RSP 표준 준수로 장기 이득은 크나, 본 ADR 1회 작업의 결정 비용이 평균 컴포넌트 작업보다 큼
  - 마이그레이션: **L** — 마이그레이션 기능 미도입. 시각적 breaking change 명시적 수용

### 대안 B: 점진 제거 + deprecated 경고

- 설명: `variant` prop을 `@deprecated` 표시만 하고 1~2개월간 유지. 새 API로 `isQuiet + isInvalid` 권장. 런타임 호환 레이어(variant → 내부 상태 매핑)로 흡수. 향후 별도 ADR에서 최종 제거.
- 근거: 대형 라이브러리(MUI v4→v5, Ant Design v3→v4)의 deprecation 패턴. 사용자 학습 곡선 완만.
- 위험:
  - 기술: **M** — 호환 레이어 + 경고 인프라 필요
  - 성능: **L**
  - 유지보수: **H** — deprecated 코드를 장기 유지, SSOT 원칙 일시 훼손 (Spec이 두 경로 공존)
  - 마이그레이션: **L** — 완화된 전환

### 대안 C: Hybrid — variant 유지 + 비표준 확장 명시 문서화

- 설명: `variant` prop을 **Spec에 유지**하되 "RSP 표준 외 composition 고유 확장"으로 **명시적 문서화**. `packages/specs`에 `COMPOSITION_SPEC_EXTENSIONS.md` 생성 + 각 Spec의 `variants` 객체 상단에 `@extension` 주석 통일. isQuiet 누락 6개는 보강 (이 부분만 RSP 준수). 단, variant 이름을 **프로젝트 전반에 걸쳐 통일** (accent/neutral/negative 3종으로 수렴 권장) — CSS/Skia 정합 회복.
- 근거: charter 이전의 느슨한 해석(Spec=SSOT, RSP는 단순 참조)에 근거. charter 도입 이후 D2 규칙과 충돌하나 역사적 완전성을 위해 제시. 기존 34파일 변경을 피함.
- 위험:
  - 기술: **M** — variant 이름 통일 작업 (CSS 5종 → Spec 3종으로 수렴), 타 파일 그대로
  - 성능: **L**
  - 유지보수: **H** — "RSP 외 확장" 문서화는 신규 개발자 온보딩에 추가 학습 필요. 장기적으로 RSP 훅/S2 전환 시 재정리 발생 — ADR-052/053 계열 미래 작업 비용 재전가
  - 마이그레이션: **L** — 사용자 API 유지

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  H   |  L   |    M     |      L       |     1      |
|  B   |  M   |  L   |    H     |      L       |     1      |
|  C   |  M   |  L   |    H     |      L       |     1      |

**루프 판정**: 3개 대안 모두 HIGH 1개. CRITICAL 0. Threshold 1차 실패 → 추가 루프 검토:

- 새 대안 D("variant 삭제 + Spec 단일 `variants: { default }` 유지로 validator 충격 최소화")는 A의 축소판으로 위험 구조 유사 → 독립 가치 낮음
- HIGH를 완전히 회피할 경로 없음: (i) variant 유지는 유지보수 H (장기 부채), (ii) variant 제거는 기술 H (1회 대규모 편집), (iii) 점진 전환은 유지보수 H (중복 경로)
- **3종 중 HIGH 수용 불가피**.

**HIGH 수용 정량 기준 (본 ADR에서 명시적 적용)**:

1. **회수 가능성** — HIGH 위험이 1회성 편집/작업 완료로 해소되는가, 아니면 시간에 따라 누적되는가? 전자 우선.
2. **Gate 관리 가능성** — HIGH 위험을 Phase별 Gate로 분할 검증 가능한가? Gate 통과 실패 시 revert 가능한가?
3. **Charter 3-domain 정합성** — HIGH 수용이 D1/D2/D3 분할과 충돌하지 않는가?

본 ADR의 HIGH 수용은 위 3개 기준을 모두 충족하는 A에 한해 승인. B/C는 유지보수 HIGH가 시간에 따라 누적되며 Gate로 관리 불가 → 수용 거부.

## Decision

**대안 A: 일괄 제거 (마이그레이션 없음)**를 선택한다.

선택 근거 (HIGH 1개 수용):

1. **D2 규칙 복원 (first principle)** — [charter](063-ssot-chain-charter.md)의 D2는 RSP 참조 + RAC 지원 범위 마이그레이션으로 규정. A만 유일하게 D2 규칙에 정합 (B는 deprecated 경로 유지로 이탈 지속, C는 variant 유지로 D2 예외 창설).
2. **A의 HIGH(기술)는 1회성 편집 비용** — 34파일 원자적 커밋은 완료 시 회수 가능한 부채. B/C의 HIGH(유지보수)는 **장기 부채**로 시간에 따라 증가.
3. **ADR-059 v2 variant 블로커만 해금** — variant 이름 불일치는 해제. **ADR-059 재개는 불가** — 나머지 블로커(size 3중 불일치, state selectors, bridge 변수, base defaults, composition 계약 부재)가 남아있어 별도 선행 과제 필요. 즉 본 ADR 완료 = ADR-059 재개 전제 중 하나 해제일 뿐이며 전제 전체 충족은 아님.
4. **미래 작업 비용 감소** — React Aria 훅/S2 변환(ADR-052/053) 시 variant prop 정리 중복 작업 회피.
5. **마이그레이션 불필요** — IndexedDB 분산 저장으로 중앙 마이그레이션 비현실. 시각적 breaking change를 초기 단계의 수용 가능한 비용으로 판정.

기각 사유:

- **대안 B 기각**: 유지보수 HIGH(deprecated 코드 장기 잔존)는 charter 3-domain 분할을 장기 훼손(D2 규칙과 호환 레이어의 이중 경로)하며 ADR-036 재승격 차단. 사용자 전환 완화 이득은 composition 초기 단계에서 weight 낮음.
- **대안 C 기각**:
  1. **D2 규칙 위반 (first principle)** — [charter](063-ssot-chain-charter.md)의 D2(Props/API)는 "RSP 참조 + RAC/custom 구현 범위 마이그레이션"으로 규정. Field variant는 RSP에 없고 RAC 코어에도 없으므로 **D2 수용 대상 아님**. "variant 유지 + 비표준 확장 문서화"는 D2 규칙을 우회하는 예외 창설 — charter의 분할 체계 훼손. Spec=SSOT는 D3(시각)에 한정 적용되며 Field variant는 D2 영역에 속함.
  2. **사용 증거 부재 (보완)** — `apps/` grep 결과 Field variant prop 실제 호출 0건. 원칙 위반을 정당화할 정량 근거도 없음.
  3. **RSP 설계 결정의 연쇄 비용 (보완)** — RSP "Field=structural, 색상=다른 경로" 분리는 접근성·API 일관성 검증 결과. 이 분리를 깨면 React Aria 훅 전환(ADR-052) 및 S2 전환(ADR-053) 시 모든 Field 재작업 필수.
  4. **변경 회피의 착시 (보완)** — C는 "34파일 변경 피함"처럼 보이나, CSS/Skia/Spec 3경로 variant 이름 정렬(TextField의 `primary/secondary/tertiary/filled` vs Spec `accent/neutral/purple/negative/positive` 완전 불일치)은 여전히 필요. 변경 회피 규모는 표면보다 작음.

> 구현 상세: [062-field-spec-rsp-conformance-breakdown.md](../design/completed/062-field-spec-rsp-conformance-breakdown.md)

## Gates

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| --- | --- | --- | --- |
| G1: Spec+소비자 정리 | Phase 1 각 컴포넌트 | `pnpm type-check` 통과 + `pnpm build:specs` 외부 컴포넌트 0 byte diff + validator 통과 (validator 규칙 완화 포함) | 해당 컴포넌트 revert, 다음 단위 진행 |
| G2: 대칭 회귀 | Phase 3 완료 | 11/11 컴포넌트 대칭 통과 — `parallel-verify` skill로 일괄 집행 | 실패 컴포넌트 Skia shapes 재작업 |
| G3: 접근성·테스트 | Phase 4 완료 | Storybook 스크린샷 diff 리뷰 완료 (의도적 변경만 승인) + 기존 unit/integration 테스트 pass (variant 테스트는 isInvalid 기반으로 마이그레이션) | 회귀 시나리오별 보강 |

**잔존 HIGH 위험**: 대안 A 기술 HIGH 1건 (Risk Threshold Check 기준). Gate G1/G2/G3의 단계별 검증으로 관리. 위험 수용 근거는 위 Decision #1~5 참조.

## Consequences

### Positive

- **RSP 표준 완전 준수** — 11/11 Field 컴포넌트가 `isQuiet + isInvalid + 전역 tint` 조합으로 단일화
- **Charter D2 규칙 준수 복원** — Field props API가 RSP 참조 기반으로 정렬. D3(시각)에서 Spec SSOT + CSS/Skia symmetric consumer 관계는 charter 정본대로 유지
- **ADR-059 v2 재개 가능** — skipCSSGeneration 해체의 전제 조건 충족
- **dead code 대규모 정리** — TextField CSS variant 블록 5개, ColorField `filled`, 기타 미사용 variant CSS 제거
- **신규 컴포넌트 온보딩 가속** — 앞으로 Field 계열은 variant 선언 없이 RSP 패턴 따라 구현
- **React Aria 훅/S2 전환 시 추가 정리 불필요** — ADR-052/053 연관 작업의 후속 비용 감소
- **마이그레이션 인프라 불필요** — load hook 변환/feature flag/telemetry 파이프라인 없이 단순 배포

### Negative

- **시각적 breaking change (명시적 수용)** — 기존 IndexedDB 프로젝트에 저장된 `variant` 키는 런타임에서 자동 무시. `variant="negative"` 기반 오류 색상 표시는 **소실** (사용자는 `isInvalid` 상태 prop으로 마이그레이션 수동). 본 ADR은 이를 초기 단계의 수용 가능한 비용으로 판정.
- **per-instance 색상 의도 소실** — `variant="accent|purple|neutral"`은 전역 `--tint`로 1:N 축소. 같은 프로젝트에서 TextField A에 `accent`, TextField B에 `purple`을 지정한 경우 둘 다 전역 tint 단일 색상으로 수렴. per-component tint 오버라이드를 위한 prop 신설은 variant 리브랜딩에 불과하며 RSP 표준 일탈 재발 — 도입 거부. 사용자가 디자인 의도 유지가 필요하면 element-level `style={{ "--tint": "var(--purple)" }}` CSS override로 대응 가능(공식 지원 아님).
- **ColorField `filled` 디자인 의도 소실** — Spec/CSS에서 단순 제거. telemetry 미도입 (초기 단계 계측 인프라 부재). **관찰 실행 계획**: (i) 수집 주체 = 개발자 본인이 ColorField 사용 리뷰 요청/이슈를 모니터링, (ii) 관찰 기간 = 본 ADR 머지 후 **6주**, (iii) 후속 ADR 발동 threshold = "filled 요청 1건 이상 or 특정 디자인 의도 명시적 제기" 시. 기간 내 관찰 0건이면 ColorField.spec.ts의 filled 참조 제거 ADR 없이 정리 확정(`feature/colorfield-filled-cleanup` 브랜치에 후속 커밋).
- **Phase 1~4 작업 실 3~4일** — 본 ADR이 완료되기 전 ADR-059 v2의 variant 블로커만 중단 해제. ADR-059의 size/state/composition 블로커는 별도 과제로 남음 (ADR-059 재개 조건은 본 ADR 완료 + 별도 선행 작업).
