# 코딩 컨벤션

## 스타일링 가이드

### Tailwind CSS v4 사용 규칙

#### 1. 버전 정보
- Tailwind CSS v4 사용
- PostCSS 플러그인: @tailwindcss/postcss

#### 2. CSS 파일 작성 규칙
```css
/* 올바른 사용 */
@import "tailwindcss";

/* 잘못된 사용 - 사용하지 않음 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 3. PostCSS 설정
```javascript
// postcss.config.js
export default {
    plugins: {
        "@tailwindcss/postcss": {},    // tailwindcss가 아닌 @tailwindcss/postcss 사용
        autoprefixer: {},
    },
};
```

#### 4. 유틸리티 클래스 사용
- Tailwind의 유틸리티 클래스는 직접 사용
- 커스텀 스타일이 필요한 경우 @layer utilities 내에서 정의
```css
@layer utilities {
    .custom-class {
       font-size:var(--text-sm)/* Tailwind 변수 명시적 으로 사용 */;
    }
}
```

#### 5. 컴포넌트 스타일링
- 컴포넌트별 스타일은 해당 컴포넌트의 CSS 파일에 정의
- 전역 스타일은 apps/builder/src/index.css에 정의

#### 6. 반응형 디자인
- Tailwind의 반응형 접두사 사용 (sm:, md:, lg:, xl:)
- 모바일 퍼스트 접근 방식 준수

#### 7. 다크 모드
- Tailwind의 다크 모드 클래스 사용 (dark:)
- 다크 모드 전환은 시스템 설정 따름

#### 8. 성능 최적화
- 불필요한 중첩 스타일 피하기
- 유틸리티 클래스 재사용
- 커스텀 스타일 최소화
