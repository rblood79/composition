package com.composition.upload.web;

import java.io.IOException;
import java.util.Locale;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 계약 §4 — {@code POST + X-HTTP-Method-Override: PATCH|DELETE} 를 그 메서드로 바꾼다 (WAF·프록시가 PATCH 를
 * 거르는 환경). 바디 스트림은 건드리지 않는다. 허용 값 밖 (PUT 등) 은 400 (corpus C12).
 */
public class MethodOverrideFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String override = request.getHeader(TusHeaders.METHOD_OVERRIDE);
        if (override == null || !"POST".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        final String method = override.trim().toUpperCase(Locale.ROOT);
        if (!"PATCH".equals(method) && !"DELETE".equals(method)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setHeader(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().write("X-HTTP-Method-Override allows PATCH or DELETE only");
            return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override
            public String getMethod() {
                return method;
            }
        }, response);
    }
}
