package com.composition.upload.web;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.Test;
import org.springframework.mock.web.MockHttpSession;
import javax.servlet.http.Cookie;
import org.springframework.test.web.servlet.MvcResult;

import com.composition.upload.AbstractTusTest;
import com.composition.upload.service.SessionOwnerResolver;

/** P3 소유자 바인딩 (C10) · P5 CSRF (C11) · 미인증 (C16). */
public class OwnershipAndCsrfTest extends AbstractTusTest {

    @Test
    public void anotherPrincipalGets403OnHeadPatchDelete() throws Exception {
        MockHttpSession alice = sessionFor(uniqueOwner("alice"));
        MockHttpSession bob = sessionFor(uniqueOwner("bob"));
        String location = create(alice, "alice.png", 16);

        mvc.perform(tusHead(bob, location)).andExpect(status().isForbidden());
        mvc.perform(tusPatch(bob, location, 0, bytes(8, (byte) 1))).andExpect(status().isForbidden());
        mvc.perform(tusDelete(bob, location)).andExpect(status().isForbidden());

        // offset 무변경, 세션 존속
        mvc.perform(tusHead(alice, location))
            .andExpect(status().isOk())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "0"));
        assertEquals(0L, repository.findById(idOf(location)).getUploadOffset());
    }

    /** 계약 §5 "토큰 획득" — GET 이 세션 토큰을 XSRF-TOKEN 쿠키 (HttpOnly 아님) 로 실어 스크립트 클라이언트가 헤더로 되돌린다. */
    @Test
    public void getExposesCsrfTokenAsReadableCookieMatchingSession() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("cookie"));
        MvcResult result = mvc.perform(get("/session").session(s))
            .andExpect(status().isOk())
            .andExpect(cookie().exists(TusHeaders.CSRF_COOKIE))
            .andReturn();
        Cookie c = result.getResponse().getCookie(TusHeaders.CSRF_COOKIE);
        assertNotNull(c);
        assertFalse(c.isHttpOnly());
        assertEquals(s.getAttribute(CsrfTokens.SESSION_ATTRIBUTE), c.getValue());
        // 쿠키값을 헤더로 되돌리면 POST 가 통과한다 (검증은 헤더 ↔ 세션 하나뿐)
        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.CSRF_TOKEN, c.getValue())
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_LENGTH, "16")
                .header(TusHeaders.UPLOAD_METADATA, metadata("via-cookie.png")))
            .andExpect(status().isCreated());
    }

    @Test
    public void missingCsrfTokenIs403OnStateChangingMethods() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("csrf"));
        String location = create(s, "c.png", 16);

        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_LENGTH, "16")
                .header(TusHeaders.UPLOAD_METADATA, metadata("no-csrf.png")))
            .andExpect(status().isForbidden());
        mvc.perform(patch(location).session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_OFFSET, "0")
                .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
                .content(bytes(8, (byte) 1)))
            .andExpect(status().isForbidden());
        mvc.perform(delete(location).session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0"))
            .andExpect(status().isForbidden());
        // override 경로도 같은 검사
        mvc.perform(post(location).session(s)
                .header(TusHeaders.METHOD_OVERRIDE, "PATCH")
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_OFFSET, "0")
                .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
                .content(bytes(8, (byte) 1)))
            .andExpect(status().isForbidden());

        assertEquals(0L, repository.findById(idOf(location)).getUploadOffset());
        // HEAD 는 면제
        mvc.perform(tusHead(s, location)).andExpect(status().isOk());
    }

    @Test
    public void wrongCsrfTokenIs403() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("csrf-wrong"));
        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_LENGTH, "16")
                .header(TusHeaders.UPLOAD_METADATA, metadata("w.png"))
                .header(TusHeaders.CSRF_TOKEN, "not-the-token"))
            .andExpect(status().isForbidden());
    }

    @Test
    public void unauthenticatedIs401() throws Exception {
        MockHttpSession anonymous = new MockHttpSession();
        anonymous.setAttribute(CsrfTokens.SESSION_ATTRIBUTE, "anon-token");
        mvc.perform(post("/upload").session(anonymous)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_LENGTH, "16")
                .header(TusHeaders.UPLOAD_METADATA, metadata("anon.png"))
                .header(TusHeaders.CSRF_TOKEN, "anon-token"))
            .andExpect(status().isUnauthorized());

        MockHttpSession owner = sessionFor(uniqueOwner("owner"));
        String location = create(owner, "o.png", 16);
        mvc.perform(tusHead(anonymous, location)).andExpect(status().isUnauthorized());
        mvc.perform(patch(location).session(anonymous)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_OFFSET, "0")
                .header(TusHeaders.CSRF_TOKEN, "anon-token")
                .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
                .content(bytes(8, (byte) 1)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    public void ownerFromSessionAttributeIsBoundToTheRow() throws Exception {
        String owner = uniqueOwner("bound");
        MockHttpSession s = sessionFor(owner);
        String location = create(s, "b.png", 16);
        assertEquals(owner, repository.findById(idOf(location)).getOwnerId());
        assertEquals(owner, s.getAttribute(SessionOwnerResolver.SESSION_ATTRIBUTE));
    }
}
