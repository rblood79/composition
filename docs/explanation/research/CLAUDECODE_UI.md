# Claude Code UI 리서치 노트

## 개요

- GitHub의 [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)는 Claude Code 및 Cursor CLI를 위한 통합 UI로, 서버(Node/Express)와 Vite 기반 클라이언트가 결합된 풀스택 레퍼런스이다.
- 실시간 프로젝트 동기화, 코드 편집, 터미널 접속, Git 작업 등 생산성 기능을 제공하며 모바일 대응 UI까지 포함하고 있다.

## composition에 적용을 고려할 만한 기술 및 패턴

### 1. 실시간 데이터 동기화를 위한 서버-클라이언트 아키텍처

- `server/index.js`는 `chokidar`로 로컬 프로젝트 파일 변화를 감시하고(`setupProjectsWatcher`) WebSocket으로 클라이언트에 브로드캐스트한다. `connectedClients` 집합을 관리하면서 변경 유형, 경로 등을 포함한 메시지를 보내 실시간 갱신을 구현한다.
- composition의 CMS/프로젝트 데이터도 현재는 목업 기반이지만, 이후 실서비스와 연계할 때 파일/리소스 변경 알림이나 공동 편집 내역을 실시간으로 전파하는 용도로 유사한 구조를 참고할 수 있다. `src/services` 계층에 이벤트 스트림을 추가하고, 백엔드에서 WebSocket 게이트웨이를 운영하도록 설계하면 된다.

### 2. 재접속이 가능한 WebSocket 커스텀 훅과 컨텍스트

- `src/utils/websocket.js`의 `useWebSocket` 훅은 토큰 유효성 검사, 서버 설정 fetch, `localhost` 환경 자동 보정, 연결 종료 시 지수형은 아니지만 지연 재연결 등을 처리한다. 이를 `WebSocketProvider` 컨텍스트로 노출하여 어느 컴포넌트에서도 동일한 API로 실시간 데이터를 소비하게 했다.
- composition에서도 향후 협업 알림, 작업 상태 업데이트 등을 실시간으로 처리하려면 `hooks` 폴더에 TypeScript 기반 WebSocket 훅을 추가하고 `contexts` 또는 `providers` 계층을 도입하는 방식을 검토할 수 있다. 인증 토큰 기반 URL 구성, 재연결 로직, 메시지 히스토리 관리를 이 패턴으로 정리하면 재사용성이 높아진다.

### 3. 테마/디바이스 환경에 반응하는 ThemeContext

- `src/contexts/ThemeContext.jsx`는 초기 로드 시 `localStorage`와 `matchMedia`를 확인해 다크모드 여부를 결정하고, 문서 루트 클래스와 메타 태그(`theme-color`, `apple-mobile-web-app-status-bar-style`)를 동적으로 조정한다. 시스템 테마가 바뀌면 수동 설정 여부를 감안해 자동으로 동기화한다.
- composition는 Tailwind 4 기반이므로 테마 스위처를 도입하면 디자인 시스템 활용성이 커진다. React 19 + TypeScript에 맞춰 제네릭 컨텍스트 훅과 `useEffect`를 조합해 메타 태그까지 제어하면 PWA나 모바일 WebView 최적화에도 도움이 된다.

### 4. Tailwind 구성요소의 변형 전략

- `src/components/ui/button.jsx`는 `class-variance-authority`(CVA)로 Tailwind 클래스를 구조화하고, `cn` 유틸을 통해 variant/size 옵션을 조합한다. 이 패턴은 `tailwind-merge`와 함께 스타일 충돌을 방지하면서 일관된 컴포넌트 API를 제공한다.
- composition는 이미 `tailwind-variants`를 도입하고 있으므로, CVA 패턴을 참고해 버튼/배지 외에도 입력, 카드 등 공통 컴포넌트를 variant 기반으로 확장할 수 있다. 이를 통해 Builder나 Dashboard 영역에서 상태별 스타일 정의를 통일할 수 있다.

### 5. CLI 배포를 위한 패키징 전략

- `package.json`은 `bin` 필드를 통해 `server/index.js`를 npx 명령으로 배포하고, `files` 배열로 배포 범위를 제한한다. `server/index.js`는 `.env`를 직접 파싱해 환경변수를 설정하고, Express 서버와 WebSocket, CLI 프로세스(`node-pty`, `cross-spawn`)를 한 번에 기동한다.
- composition도 향후 내부 도구나 데스크톱 유틸리티 형태로 배포할 계획이 있다면, 유사하게 `bin` 엔트리를 구성해 "one-click" 개발 서버를 제공하는 방식을 고려할 수 있다. Storybook/디자인 시스템 미리보기나 Builder 전용 서버를 CLI 명령으로 배포하면 온보딩이 단순해진다.

## 적용 시 유의사항

- Claude Code UI는 보안상 WebSocket 인증, API 키 검증 등 서버 단에서 많은 검증 로직을 둔다. composition에 적용할 때도 Cloud 등과의 토큰 호환, 권한 체크를 명확히 설계해야 한다.
- `node-pty`, `better-sqlite3` 등 네이티브 의존성이 포함되어 있어 브라우저 단독 배포와는 빌드 타깃이 다르다. 필요한 패턴만 선별하여 프런트엔드/백엔드 분리 구조에 맞게 경량화해야 한다.
