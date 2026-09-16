package com.composition.upload.web;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;

import javax.servlet.http.HttpSession;

/** 세션 CSRF 토큰 (P5). 세션 속성 {@value #SESSION_ATTRIBUTE} — JSP 는 {@code ${sessionScope.CSRF_TOKEN}} 으로 읽는다. */
public final class CsrfTokens {

    public static final String SESSION_ATTRIBUTE = "CSRF_TOKEN";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private CsrfTokens() {
    }

    /** 세션에 토큰이 없으면 만들고, 있으면 그대로 돌려준다. */
    public static String ensure(HttpSession session) {
        Object existing = session.getAttribute(SESSION_ATTRIBUTE);
        if (existing instanceof String && !((String) existing).isEmpty()) {
            return (String) existing;
        }
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(HEX[(b >> 4) & 0xF]).append(HEX[b & 0xF]);
        }
        String token = sb.toString();
        session.setAttribute(SESSION_ATTRIBUTE, token);
        return token;
    }

    /** 상수 시간 비교. 세션·토큰·헤더 중 하나라도 없으면 false. */
    public static boolean matches(HttpSession session, String headerValue) {
        if (session == null || headerValue == null || headerValue.isEmpty()) {
            return false;
        }
        Object stored = session.getAttribute(SESSION_ATTRIBUTE);
        if (!(stored instanceof String)) {
            return false;
        }
        return MessageDigest.isEqual(
            ((String) stored).getBytes(StandardCharsets.UTF_8),
            headerValue.getBytes(StandardCharsets.UTF_8));
    }
}
