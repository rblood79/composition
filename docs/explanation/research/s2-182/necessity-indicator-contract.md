# S2 1.8.2 필수 표시 조립 계약

2026-11-06. 실제 catalog 자식 연결을 구현했다. 구조 구현과 아래 검증 통과를 전체 S2/Builder 완료로 확대하지 않는다.

## 구현된 트리

```text
Field
└─ Label (기존 RAC context와 접근성 id 유지)
   ├─ Text slot="label-content"
   ├─ Text slot="necessity-space" children="NBSP"
   ├─ Icon slot="necessity-icon" iconName="s2-asterisk"
   └─ Text slot="necessity-label"
```

대상은 TextField, TextArea, NumberField, SearchField, ColorField, DateField,
TimeField, DatePicker, DateRangePicker, CheckboxGroup, RadioGroup, Select, ComboBox다.
다른 Label 소비자는 기존 본문 렌더를 유지한다. Label 원본은 size를 받아 필드 크기를
실제 Icon 자식의 part rule 조건까지 전달한다.

## 상태와 편집

- 부모 필드의 label이 비면 Label을 생략한다. icon 모드에서는 required일 때 Icon을, label 모드에서는 required/optional Text를 표시한다.
- 필드의 명시 모드가 Form보다 우선하며, Reset 후에는 Form 값을 다시 읽는다.
- 본문과 표시 문구는 Label의 composition value binding인 `{fieldLabel}`·`{necessityLabel}`을 사용한다. RAC Label이 render props를 제공한다고 가정하지 않으며 catalog record 값을 fallback으로 읽는다.
- 표시 앞의 NBSP도 실제 Text 자식이다. 본문 RichText의 문자열·범위를 변경하지 않으며 표시가 없으면 간격 자식도 숨긴다.
- 본문·표시의 Typography는 Label 원본을 읽는다. 명시적인 Text/Icon 스타일은 기본값과 같은 값이어도 우선한다.
- Icon 경로·viewBox는 설치 S2 1.8.2 Asterisk다. S/M은 M 경로(8), L/XL은 각각의 경로(10)를 사용한다.
- Label catalog에 자식 기본색과 baseline margin을 선언하고 typed part rule로 해석한다. Label은 기존 CSS 생성을 생략하므로 DOM binding도 해당 part layout을 전달한다.
- locale 문구 34개는 설치 S2 문자열을 복사했다(Apache-2.0). 언어·script/region을 해석하고 지원하지 않는 언어는 영어로 복원한다.
- Select·CheckboxGroup은 required도 접근성 이름에 포함한다. 일반 필드는 required 중복 안내를 숨기고 optional은 읽는다.
- catalog의 문자열 suffix와 React span 자동 주입은 제거했다. 작성한 표시 자식을 삭제하면 새 표시를 자동 생성하지 않는다.

## 수정한 소비자

| 경로                                                 | 계약                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `document/generated/reusableOriginLibrary.ts`        | 13개 필드 Label의 실제 자식과 원본 size 전달                       |
| `document/codeCatalogLibrary.ts`, `rulePartRules.ts` | Label typed part의 slot·크기·기본색·margin 컴파일                  |
| `runtime/presence.ts`                                | 작성 자식의 존재·내용·Form/field 의존성                            |
| `runtime/compositionRoot.ts`                         | Label을 컨테이너로 측정하고 자식에 타입·색·크기를 전달             |
| `runtime/valueBindings.ts`                           | Label의 composition 값과 코드/런타임 바인딩 vocabulary             |
| `runtime/boxModel.ts`                                | 동일 glyph 크기를 레이아웃·DOM·Canvas가 소비                       |
| `runtime/domBinding.runtime.ts`                      | 작성 자식 렌더, Label 본문 중복 방지, 접근성·slot·part layout 전달 |
| `components/Icon.tsx`                                | Label 안의 glyph는 span으로 렌더하고 필요한 role/aria 전달         |
| Builder `canvasBinding.ts`                           | Label 자체에서 중복 본문을 그리지 않음                             |
| 문서·상태 테스트                                     | 새 계약 번호와 실제 자식 검증으로 갱신                             |

## 저장 경계

현재 Library 계약은 **61**이다. 계약 60 이하 문서는 거부한다. 기존 인스턴스의 주소를
자동 재작성하지 않는다. 새 계약 인스턴스의 child override 저장·재로드 및 Undo/Redo를 검사했다.
이 변경은 구버전 개발 프로젝트의 호환 지원을 의미하지 않는다.

## 검증 범위와 남은 게이트

통과 근거는 `.agent/runs/2026-11-06-s2-182-necessity-compose/report.md`에 기록한다.
브라우저 검사는 production catalog DOM, 공유 CSS, Rust WASM 및 IndexedDB를 사용한다.
Canvas text metrics·Icon 경로/크기·일부 위치와 S2 실제 SVG/DOM geometry를 검사했다.

아직 완료하지 않은 범위:

- 직접 Builder의 팔레트→Layers→Property→저장 재열기 흐름(브라우저 연결 host 불가, native 전용 창 생성 시간초과).
- 여러 줄 Label의 마지막 줄에 표시를 붙이는 동작과 전체 화면 pixelmatch.
- 터치 입력 크기·전체 locale·전체 필드의 S2 시각 전수 대조.
- Code View JSX 전체 편집 왕복(이번 검증은 자식 override의 페이지 CSS 보존).
- Publish 실제 실행과 복합 배치 통합 검증.

이 항목을 의도적 시각 차이로 분류하지 않는다. 위 게이트를 완료하기 전에는 전체 필수 표시 컴포넌트 완료로 판정하지 않는다.
