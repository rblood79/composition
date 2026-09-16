package com.composition.upload.web;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

import com.composition.upload.config.UploadProperties;
import com.composition.upload.service.AuditLog;
import com.composition.upload.service.SessionOwnerResolver;

/**
 * 세션 부트스트랩 — JSP 예제와 클라이언트 {@code getHeaders()} 가 CSRF 토큰을 얻는 경로.
 *
 * <ul>
 *   <li>{@code GET /session} → JSON {@code {"owner": "...", "csrfToken": "..."}} (owner 는 미인증이면 null)</li>
 *   <li>{@code GET /session/dev-login?owner=alice} → 세션에 소유자 설정. {@code upload.devLogin.enabled=true} 일 때만 (운영 금지)</li>
 * </ul>
 * 실제 서비스는 애플리케이션 로그인이 {@link SessionOwnerResolver#SESSION_ATTRIBUTE} 를 넣거나 컨테이너 principal 을 쓴다.
 */
@Controller
public class SessionController {

    private final UploadProperties properties;

    public SessionController(UploadProperties properties) {
        this.properties = properties;
    }

    @RequestMapping(value = "/session", method = RequestMethod.GET, produces = "application/json")
    public void session(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(true);
        String token = CsrfTokens.ensure(session);
        Object owner = session.getAttribute(SessionOwnerResolver.SESSION_ATTRIBUTE);
        if (owner == null && request.getUserPrincipal() != null) {
            owner = request.getUserPrincipal().getName();
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"owner\":" + jsonString(owner == null ? null : owner.toString())
            + ",\"csrfToken\":" + jsonString(token) + "}");
    }

    @RequestMapping(value = "/session/dev-login", method = RequestMethod.GET)
    public void devLogin(@RequestParam("owner") String owner, HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        if (!properties.isDevLoginEnabled()) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        String cleaned = AuditLog.sanitize(owner).trim();
        if (cleaned.isEmpty() || cleaned.length() > 128) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(SessionOwnerResolver.SESSION_ATTRIBUTE, cleaned);
        CsrfTokens.ensure(session);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().write("logged in as " + cleaned);
    }

    private static String jsonString(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '"' || c == '\\') {
                sb.append('\\').append(c);
            } else if (c < 0x20) {
                sb.append(String.format("\\u%04x", (int) c));
            } else {
                sb.append(c);
            }
        }
        return sb.append('"').toString();
    }
}
