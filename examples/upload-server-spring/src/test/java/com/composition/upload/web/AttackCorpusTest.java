package com.composition.upload.web;

import static org.junit.Assert.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.Test;
import org.springframework.mock.web.MockHttpSession;

import com.composition.upload.AbstractTusTest;

/**
 * 계약 §8-1 공격 corpus — 서버 측 (G4). traversal 12종 (T1~T12) + C1~C7. 전부 400 이고 세션 행이 생기지 않는다.
 * 타인 URL (C10) · CSRF (C11) · 미인증 (C16) 은 OwnershipAndCsrfTest, offset/길이/override/만료/매직바이트는 TusFlowTest.
 */
public class AttackCorpusTest extends AbstractTusTest {

    /** T1~T12 — 평문 (base64 인코딩 전). */
    private static final String[] TRAVERSAL = {
        "../../etc/passwd",                       // T1
        "..\\..\\windows\\win.ini",               // T2
        "/etc/passwd",                            // T3
        "C:\\Windows\\system32\\cmd.exe",         // T4
        "....//....//etc/passwd",                 // T5
        "..%2f..%2fetc%2fpasswd",                 // T6
        "..\uFF0F..\uFF0Fetc\uFF0Fpasswd",        // T7 — 전각 solidus
        "..",                                     // T8
        ".",                                      // T9
        "webapps/ROOT/shell.jsp",                 // T10
        "../../webapps/ROOT/shell.jsp",           // T11
        "\\\\fileserver\\share\\evil.exe",        // T12 — UNC
    };

    @Test
    public void traversalFilenamesAreRejectedWithoutCreatingSessions() throws Exception {
        String owner = uniqueOwner("traversal");
        MockHttpSession s = sessionFor(owner);
        assertEquals(12, TRAVERSAL.length);
        for (String name : TRAVERSAL) {
            mvc.perform(tusPost(s, 16, metadata(name)))
                .andExpect(status().isBadRequest());
        }
        assertEquals("no session row may exist after rejected creates", 0, repository.countActiveByOwner(owner));
    }

    @Test
    public void nullByteInFilenameIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("c1"));
        mvc.perform(tusPost(s, 16, metadata("report.pdf\u0000.jsp"))).andExpect(status().isBadRequest());
    }

    @Test
    public void crlfInFilenameIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("c2"));
        mvc.perform(tusPost(s, 16, metadata("a.txt\r\nX-Injected: 1"))).andExpect(status().isBadRequest());
    }

    @Test
    public void windowsReservedNamesAreRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("c3"));
        for (String name : new String[] { "CON", "nul.txt", "com1.pdf", "Lpt9.png" }) {
            mvc.perform(tusPost(s, 16, metadata(name))).andExpect(status().isBadRequest());
        }
    }

    @Test
    public void overlongFilenameIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("c4"));
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 256; i++) {
            sb.append('a');
        }
        mvc.perform(tusPost(s, 16, metadata(sb + ".txt"))).andExpect(status().isBadRequest());
        // 한글 (UTF-8 3바이트) — 문자 수는 255 이하지만 바이트가 255 를 넘는 경우
        StringBuilder ko = new StringBuilder();
        for (int i = 0; i < 100; i++) {
            ko.append('가');
        }
        mvc.perform(tusPost(s, 16, metadata(ko + ".txt"))).andExpect(status().isBadRequest());
    }

    @Test
    public void disallowedExtensionsAreRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("c5"));
        for (String name : new String[] { "shell.jsp", "run.exe", "noextension", "trailing." }) {
            mvc.perform(tusPost(s, 16, metadata(name))).andExpect(status().isBadRequest());
        }
    }

    @Test
    public void relativePathSegmentsFollowTheSameRules() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("relpath"));
        String[] bad = { "../x/a.txt", "/abs/a.txt", "dir\\a.txt", "CON/a.txt", "a/../b/a.txt" };
        for (String rel : bad) {
            mvc.perform(tusPost(s, 16, "filename " + b64("a.txt") + ",relativePath " + b64(rel)))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(tusPost(s, 16, "filename " + b64("a.txt") + ",relativePath " + b64("photos/2026/a.txt")))
            .andExpect(status().isCreated());
    }

    @Test
    public void malformedMetadataIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("meta"));
        // base64 아님
        mvc.perform(tusPost(s, 16, "filename not*base64")).andExpect(status().isBadRequest());
        // filename 누락
        mvc.perform(tusPost(s, 16, "filetype " + b64("text/plain"))).andExpect(status().isBadRequest());
        // 헤더 자체 누락
        mvc.perform(tusPost(s, 16, null)).andExpect(status().isBadRequest());
        // 키 중복
        mvc.perform(tusPost(s, 16, "filename " + b64("a.txt") + ",filename " + b64("b.txt")))
            .andExpect(status().isBadRequest());
        // filetype 이 MIME 형식이 아님
        mvc.perform(tusPost(s, 16, "filename " + b64("a.txt") + ",filetype " + b64("<script>")))
            .andExpect(status().isBadRequest());
    }

    @Test
    public void negativeOrMissingUploadLengthIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("len"));
        mvc.perform(tusPost(s, -1, metadata("a.txt"))).andExpect(status().isBadRequest());
        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_METADATA, metadata("a.txt"))
                .header(TusHeaders.CSRF_TOKEN, csrf(s)))
            .andExpect(status().isBadRequest());
    }
}
