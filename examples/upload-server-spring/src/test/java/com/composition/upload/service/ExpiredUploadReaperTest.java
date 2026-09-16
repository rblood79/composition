package com.composition.upload.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import org.junit.Test;
import org.springframework.mock.web.MockHttpSession;

import com.composition.upload.AbstractTusTest;

/** S7 — TTL GC. 만료된 활성 세션만 파일 + 행 삭제, 살아 있는 세션과 APPROVED 는 유지. */
public class ExpiredUploadReaperTest extends AbstractTusTest {

    @Test
    public void reapRemovesExpiredActiveSessionsOnly() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("gc"));

        String expired = create(s, "expired.bin", 16);
        mvc.perform(tusPatch(s, expired, 0, bytes(8, (byte) 1))).andExpect(status().isNoContent());
        Path expiredFile = service.fileOf(repository.findById(idOf(expired)));
        assertTrue(Files.exists(expiredFile));
        repository.updateExpiresAt(idOf(expired), Instant.now().minusSeconds(5));

        String alive = create(s, "alive.bin", 16);

        byte[] png = pngBytes(16);
        String approved = create(s, "approved.png", png.length);
        mvc.perform(tusPatch(s, approved, 0, png)).andExpect(status().isNoContent());
        assertEquals(UploadStatus.APPROVED, repository.findById(idOf(approved)).getStatus());
        // APPROVED 는 expires_at 이 지나도 GC 대상이 아니다 (활성 상태만)
        repository.updateExpiresAt(idOf(approved), Instant.now().minusSeconds(5));

        int removed = reaper.reap();
        assertTrue("at least the expired session must be removed", removed >= 1);

        assertNull(repository.findById(idOf(expired)));
        assertFalse(Files.exists(expiredFile));
        mvc.perform(tusHead(s, expired)).andExpect(status().isNotFound());

        assertNotNull(repository.findById(idOf(alive)));
        mvc.perform(tusHead(s, alive)).andExpect(status().isOk());

        UploadSession kept = repository.findById(idOf(approved));
        assertNotNull(kept);
        assertEquals(UploadStatus.APPROVED, kept.getStatus());
        assertTrue(Files.exists(service.fileOf(kept)));
    }

    @Test
    public void reapIsIdempotent() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("gc-twice"));
        String expired = create(s, "twice.bin", 16);
        repository.updateExpiresAt(idOf(expired), Instant.now().minusSeconds(5));
        reaper.reap();
        assertNull(repository.findById(idOf(expired)));
        // 두 번째 실행은 예외 없이 0 이상
        assertTrue(reaper.reap() >= 0);
    }
}
