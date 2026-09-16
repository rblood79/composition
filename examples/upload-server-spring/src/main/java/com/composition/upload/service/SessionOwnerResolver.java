package com.composition.upload.service;

import java.security.Principal;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

/**
 * 기본 구현 — 컨테이너 인증 principal ({@code request.getUserPrincipal()}) 이 있으면 그 이름, 없으면 세션 속성
 * {@value #SESSION_ATTRIBUTE} (애플리케이션 로그인이 넣어 둔 사용자 id). 둘 다 없으면 null (401).
 */
public class SessionOwnerResolver implements OwnerResolver {

    public static final String SESSION_ATTRIBUTE = "UPLOAD_OWNER_ID";

    @Override
    public String resolve(HttpServletRequest request) {
        Principal principal = request.getUserPrincipal();
        if (principal != null && principal.getName() != null && !principal.getName().isEmpty()) {
            return principal.getName();
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object owner = session.getAttribute(SESSION_ATTRIBUTE);
        if (owner instanceof String && !((String) owner).isEmpty()) {
            return (String) owner;
        }
        return null;
    }
}
