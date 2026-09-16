package com.composition.upload;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;

import org.junit.Before;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.composition.upload.config.UploadProperties;
import com.composition.upload.service.ExpiredUploadReaper;
import com.composition.upload.service.SessionOwnerResolver;
import com.composition.upload.service.UploadSessionRepository;
import com.composition.upload.service.UploadSessionService;
import com.composition.upload.web.CsrfHeaderFilter;
import com.composition.upload.web.CsrfTokens;
import com.composition.upload.web.MethodOverrideFilter;
import com.composition.upload.web.TusHeaders;

/** MockMvc + 운영과 같은 필터 체인 (override → CSRF). 세션은 소유자·CSRF 토큰 속성을 직접 넣는다. */
@RunWith(SpringJUnit4ClassRunner.class)
@WebAppConfiguration
@ContextConfiguration(classes = TestConfig.class)
public abstract class AbstractTusTest {

    protected static final byte[] PNG_HEADER = { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    @Autowired
    protected WebApplicationContext wac;
    @Autowired
    protected UploadSessionRepository repository;
    @Autowired
    protected UploadSessionService service;
    @Autowired
    protected UploadProperties properties;
    @Autowired
    protected ExpiredUploadReaper reaper;

    protected MockMvc mvc;

    @Before
    public void setUpMockMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(wac)
            .addFilters(new MethodOverrideFilter(), new CsrfHeaderFilter())
            .dispatchOptions(true)
            .build();
    }

    // ---------------------------------------------------------------- sessions

    /** 로그인 + CSRF 토큰이 있는 세션. */
    protected static MockHttpSession sessionFor(String owner) {
        MockHttpSession s = new MockHttpSession();
        s.setAttribute(SessionOwnerResolver.SESSION_ATTRIBUTE, owner);
        s.setAttribute(CsrfTokens.SESSION_ATTRIBUTE, "csrf-" + UUID.randomUUID());
        return s;
    }

    /** 테스트마다 다른 소유자 — H2 in-memory 를 클래스 간에 공유하므로 quota 계산이 섞이지 않게 한다. */
    protected static String uniqueOwner(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    protected static String csrf(MockHttpSession s) {
        return (String) s.getAttribute(CsrfTokens.SESSION_ATTRIBUTE);
    }

    // ---------------------------------------------------------------- request builders

    protected static String b64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    protected static String metadata(String filename) {
        return "filename " + b64(filename);
    }

    protected static MockHttpServletRequestBuilder tusPost(MockHttpSession s, long length, String metadataHeader) {
        MockHttpServletRequestBuilder b = post("/upload")
            .session(s)
            .header(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION)
            .header(TusHeaders.UPLOAD_LENGTH, String.valueOf(length))
            .header(TusHeaders.CSRF_TOKEN, csrf(s));
        if (metadataHeader != null) {
            b.header(TusHeaders.UPLOAD_METADATA, metadataHeader);
        }
        return b;
    }

    protected static MockHttpServletRequestBuilder tusPatch(MockHttpSession s, String location, long offset, byte[] body) {
        return patch(location)
            .session(s)
            .header(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION)
            .header(TusHeaders.UPLOAD_OFFSET, String.valueOf(offset))
            .header(TusHeaders.CSRF_TOKEN, csrf(s))
            .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
            .content(body);
    }

    /** §4 — POST + X-HTTP-Method-Override: PATCH. */
    protected static MockHttpServletRequestBuilder tusPatchViaOverride(MockHttpSession s, String location, long offset,
                                                                       byte[] body) {
        return post(location)
            .session(s)
            .header(TusHeaders.METHOD_OVERRIDE, "PATCH")
            .header(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION)
            .header(TusHeaders.UPLOAD_OFFSET, String.valueOf(offset))
            .header(TusHeaders.CSRF_TOKEN, csrf(s))
            .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
            .content(body);
    }

    protected static MockHttpServletRequestBuilder tusHead(MockHttpSession s, String location) {
        return head(location)
            .session(s)
            .header(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION);
    }

    protected static MockHttpServletRequestBuilder tusDelete(MockHttpSession s, String location) {
        return delete(location)
            .session(s)
            .header(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION)
            .header(TusHeaders.CSRF_TOKEN, csrf(s));
    }

    // ---------------------------------------------------------------- flows

    /** 생성 후 Location 을 돌려준다 (201 검증 포함). */
    protected String create(MockHttpSession s, String filename, long length) throws Exception {
        MvcResult r = mvc.perform(tusPost(s, length, metadata(filename)))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andExpect(header().exists(TusHeaders.UPLOAD_EXPIRES))
            .andExpect(header().string(TusHeaders.TUS_RESUMABLE, TusHeaders.TUS_VERSION))
            .andReturn();
        return r.getResponse().getHeader("Location");
    }

    protected static String idOf(String location) {
        return location.substring(location.lastIndexOf('/') + 1);
    }

    protected static byte[] bytes(int n, byte fill) {
        byte[] out = new byte[n];
        Arrays.fill(out, fill);
        return out;
    }

    /** PNG 서명 + 채움 바이트 — 매직바이트 검사를 통과하는 본문. */
    protected static byte[] pngBytes(int total) {
        byte[] out = bytes(total, (byte) 0x41);
        System.arraycopy(PNG_HEADER, 0, out, 0, Math.min(PNG_HEADER.length, total));
        return out;
    }

    protected static byte[] slice(byte[] src, int from, int to) {
        return Arrays.copyOfRange(src, from, to);
    }
}
