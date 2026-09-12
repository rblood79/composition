> **⚠️ 레거시 문서**: 현재 아키텍처와 일치하지 않을 수 있습니다. 역사적 참조 목적.

# Inspector 통합 테스트 가이드

## ✅ 완료된 통합 작업

### 1. Builder ↔ Inspector 양방향 동기화

- **Builder → Inspector**: `useEffect`를 통한 선택된 요소 자동 동기화
- **Inspector → Builder**: `useSyncWithBuilder` 훅을 통한 변경사항 자동 반영 (500ms debounce)
- **매핑 레이어**: `elementMapper.ts`를 통한 타입 안전성 보장

### 2. 통합된 파일들

```
src/builder/inspector/
├── index.tsx                      # ✅ Builder store와 통합
├── hooks/
│   └── useSyncWithBuilder.ts      # ✅ 양방향 동기화 훅
└── utils/
    └── elementMapper.ts           # ✅ 타입 변환 유틸리티
```

## 🧪 테스트 시나리오

### 시나리오 1: 요소 선택

1. Builder에서 컴포넌트 클릭
2. Inspector가 자동으로 해당 요소 정보 표시
3. 4개 탭(속성/스타일/데이터/이벤트) 모두 표시 확인

**예상 결과**:

- Inspector 헤더에 컴포넌트 타입과 ID 표시
- PropertiesSection에 variant, size 등 속성 표시
- StyleSection에 의미 클래스 편집기 표시
- DataSection에 데이터 바인딩 옵션 표시
- EventSection에 지원 이벤트 목록 표시

### 시나리오 2: 속성 변경 (PropertiesSection)

1. Button 컴포넌트 선택
2. Inspector > 속성 탭에서 variant를 'primary' → 'secondary' 변경
3. 500ms 후 Builder에 반영 확인
4. Preview iframe에서 버튼 스타일 변경 확인

**예상 결과**:

- Inspector에서 변경한 속성이 Builder store에 저장됨
- Preview가 자동으로 업데이트됨
- Undo/Redo 히스토리에 기록됨

### 시나리오 3: 스타일 편집 (StyleSection)

1. 컴포넌트 선택
2. 스타일 탭 > SemanticClassPicker에서 `.primary` 클래스 추가
3. CSS Variable Editor에서 `--color-primary` 수정
4. Preview Panel에서 실시간 미리보기 확인

**예상 결과**:

- 의미 클래스가 요소에 추가됨
- CSS 변수 변경이 즉시 반영됨
- Preview Panel이 변경사항 표시

### 시나리오 4: 데이터 바인딩 (DataSection)

1. Table 컴포넌트 선택
2. 데이터 탭 > Cloud Collection 선택
3. 테이블명 입력, 컬럼 선택
4. 필터 조건 추가

**예상 결과**:

- CloudCollectionEditor가 표시됨
- 테이블 목록이 Cloud에서 로드됨
- 선택한 컬럼이 저장됨
- 필터 조건이 적용됨

### 시나리오 5: 이벤트 핸들러 (EventSection)

1. Button 컴포넌트 선택
2. 이벤트 탭 > `+ onPress` 클릭
3. Action Type을 'Navigate' 선택
4. Path를 '/dashboard' 입력
5. 추가 액션 추가 (예: Show Toast)

**예상 결과**:

- EventList에 'onPress' 이벤트 추가됨
- EventEditor에서 액션 편집 가능
- NavigateActionEditor가 표시됨
- 여러 액션을 순서대로 추가 가능
- 액션 순서 변경 (↑↓ 버튼) 가능

### 시나리오 6: 다중 액션 체인

1. Button의 onPress 이벤트 선택
2. 액션 추가:
   - #1: Validate Form (formId: loginForm)
   - #2: API Call (POST /api/login)
   - #3: Navigate (/dashboard)
   - #4: Show Toast (success message)
3. 각 액션의 설정 확인

**예상 결과**:

- 4개 액션이 순서대로 표시됨
- 각 액션 에디터가 올바른 config 표시
- 액션 순서 변경 가능
- 개별 액션 삭제 가능

## 🐛 잠재적 이슈 체크리스트

### 타입 관련

- [ ] Element 타입이 semantic_classes, css_variables 필드를 가지고 있는지
- [ ] ComponentElementProps가 index signature를 가지고 있는지
- [ ] DataBinding 타입이 Cloud/State/Static 모두 지원하는지

### 동기화 관련

- [ ] Builder에서 선택 변경 시 Inspector 업데이트 확인
- [ ] Inspector 변경 시 Builder store 업데이트 확인
- [ ] Debounce가 너무 길어 UX가 나쁘지 않은지 (현재 500ms)
- [ ] 빠른 연속 변경 시 동기화 누락이 없는지

### UI/UX 관련

- [ ] 탭 전환이 부드럽게 작동하는지
- [ ] 긴 내용이 스크롤 가능한지
- [ ] 에러 메시지가 적절하게 표시되는지
- [ ] 로딩 상태가 표시되는지 (Cloud 테이블 로드 등)

### 성능 관련

- [ ] 많은 요소가 있을 때 선택 성능 확인
- [ ] 복잡한 컴포넌트의 Inspector 렌더링 성능
- [ ] CSS Variable Editor의 색상 선택 성능
- [ ] Event Editor의 많은 액션 처리 성능

## 📝 테스트 결과 기록

### 환경

- 브라우저:
- OS: macOS
- Node 버전:
- 날짜: 2025-10-04

### 발견된 이슈

1.
2.
3.

### 해결된 이슈

1.
2.
3.

### 추가 개선 사항

1.
2.
3.

## 🚀 다음 단계

### 완료 후

1. ✅ Storybook 문서화
2. ✅ E2E 테스트 작성
3. ✅ 레거시 코드 제거 (`inspector/design/`, 기존 `inspector/events/`)
4. ✅ 성능 최적화 (React.memo, useMemo)
5. ✅ 접근성 개선 (ARIA labels, 키보드 네비게이션)

### 추가 기능

1. Custom Action Editor 구현
2. Data Binding Preview 기능
3. Event Handler 테스트 실행 기능
4. Semantic Class 검색/필터 기능
5. CSS Variable 색상 picker 개선
