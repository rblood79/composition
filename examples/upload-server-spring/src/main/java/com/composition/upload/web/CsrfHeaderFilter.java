package com.composition.upload.web;

import java.io.IOException;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.springframework.web.filter.OncePerRequestFilter;

/**
 * P5 — 업로드 경로의 상태 변경 요청 (POST · PATCH · DELETE, override 반영 후) 은 {@code X-CSRF-TOKEN} 헤더가
 * 세션 토큰과 같아야 한다. 없거나 다르면 403 (corpus C11). HEAD/OPTIONS/GET 은 면제.
 * GET 요청 (JSP 페이지 로드) 에서는 세션 토큰을 만들어 둔다 — JSP 가 meta 태그로 내보내고, 같은 값을
 * {@code XSRF-TOKEN} 쿠키 (HttpOnly 아님, Spring Security CookieCsrfTokenRepository 관례) 로도 실어
 * composition preview/publish 같은 스크립트 클라이언트가 {@code document.cookie} 에서 읽어 헤더로 되돌린다
 * (계약 §5 "토큰 획득"). 검증은 헤더 ↔ 세션 토큰 대조 하나뿐이라 쿠키 위조로는 통과할 수 없다.
 */
public class CsrfHeaderFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method)) {
            String token = CsrfTokens.ensure(request.getSession(true));
            Cookie cookie = new Cookie(TusHeaders.CSRF_COOKIE, token);
            cookie.setPath(contextPathOrRoot(request));
            cookie.setHttpOnly(false);
            cookie.setSecure(request.isSecure());
            response.addCookie(cookie);
            chain.doFilter(request, response);
            return;
        }
        if (isUploadPath(request) && isStateChanging(method)) {
            HttpSession session = request.getSession(false);
            if (!CsrfTokens.matches(session, request.getHeader(TusHeaders.CSRF_TOKEN))) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setHeader(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
                response.setContentType("text/plain;charset=UTF-8");
                response.getWriter().write("missing or invalid CSRF token");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private static String contextPathOrRoot(HttpServletRequest request) {
        String context = request.getContextPath();
        return context == null || context.isEmpty() ? "/" : context;
    }

    private static boolean isStateChanging(String method) {
        return "POST".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method);
    }

    /** 컨텍스트 경로를 뺀 서블릿 경로가 /upload 또는 /tus-lib/upload 로 시작하면 보호 대상. */
    private static boolean isUploadPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) {
            path = path.substring(context.length());
        }
        return path.equals("/upload") || path.startsWith("/upload/")
            || path.equals("/tus-lib/upload") || path.startsWith("/tus-lib/upload/");
    }
}
