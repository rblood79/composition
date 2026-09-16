package com.composition.upload.web;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

import org.junit.Test;
import org.springframework.mock.web.MockHttpSession;

import com.composition.upload.AbstractTusTest;
import com.composition.upload.TestConfig;
import com.composition.upload.service.UploadSession;
import com.composition.upload.service.UploadStatus;

/** 계약 §1·§2 — 정상 흐름과 응답 코드 (G2 서버 측). */
public class TusFlowTest extends AbstractTusTest {

    @Test
    public void optionsExposesCapabilities() throws Exception {
        mvc.perform(options("/upload"))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.TUS_RESUMABLE, "1.0.0"))
            .andExpect(header().string(TusHeaders.TUS_VERSION_HEADER, "1.0.0"))
            .andExpect(header().string(TusHeaders.TUS_EXTENSION, "creation,expiration,termination,checksum"))
            .andExpect(header().string(TusHeaders.TUS_MAX_SIZE, String.valueOf(TestConfig.TEST_MAX_SIZE)))
            .andExpect(header().string(TusHeaders.TUS_CHECKSUM_ALGORITHM, "sha1,sha256"));
    }

    @Test
    public void createPatchCompleteApproved() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("flow"));
        byte[] file = pngBytes(24);
        String location = create(s, "photo.png", file.length);

        mvc.perform(tusPatch(s, location, 0, slice(file, 0, 16)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "16"))
            .andExpect(header().exists(TusHeaders.UPLOAD_EXPIRES));
        mvc.perform(tusPatch(s, location, 16, slice(file, 16, 24)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "24"));

        UploadSession row = repository.findById(idOf(location));
        assertEquals(UploadStatus.APPROVED, row.getStatus());
        assertEquals(24L, row.getUploadOffset());
        assertArrayEquals(file, Files.readAllBytes(service.fileOf(row)));
        // 디스크 파일명은 UUID — 원본명은 DB 에만 (S2)
        assertEquals(row.getId(), service.fileOf(row).getFileName().toString());
        assertEquals("photo.png", row.getFileName());
    }

    @Test
    public void headReportsServerOffsetForResume() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("resume"));
        byte[] file = pngBytes(32);
        String location = create(s, "resume.png", file.length);
        mvc.perform(tusPatch(s, location, 0, slice(file, 0, 8))).andExpect(status().isNoContent());

        mvc.perform(tusHead(s, location))
            .andExpect(status().isOk())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "8"))
            .andExpect(header().string(TusHeaders.UPLOAD_LENGTH, "32"))
            .andExpect(header().exists(TusHeaders.UPLOAD_EXPIRES))
            .andExpect(header().string(TusHeaders.UPLOAD_METADATA, metadata("resume.png")))
            .andExpect(header().string("Cache-Control", "no-store"));

        // 재개: 서버 offset 부터 나머지 전송
        mvc.perform(tusPatch(s, location, 8, slice(file, 8, 32)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "32"));
        assertEquals(UploadStatus.APPROVED, repository.findById(idOf(location)).getStatus());
    }

    @Test
    public void offsetMismatchIs409WithServerOffset() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("offset"));
        String location = create(s, "a.png", 32);
        mvc.perform(tusPatch(s, location, 8, bytes(8, (byte) 1)))
            .andExpect(status().isConflict())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "0"))
            .andExpect(header().string(TusHeaders.TUS_RESUMABLE, "1.0.0"));
        assertEquals(0L, repository.findById(idOf(location)).getUploadOffset());
    }

    @Test
    public void uploadLengthOverMaxIs413() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("big"));
        mvc.perform(tusPost(s, TestConfig.TEST_MAX_SIZE + 1, metadata("big.bin")))
            .andExpect(status().isPayloadTooLarge())
            .andExpect(header().string(TusHeaders.TUS_MAX_SIZE, String.valueOf(TestConfig.TEST_MAX_SIZE)));
    }

    @Test
    public void chunkBeyondUploadLengthIs413AndOffsetUnchanged() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("over"));
        String location = create(s, "over.bin", 16);
        mvc.perform(tusPatch(s, location, 0, bytes(20, (byte) 2)))
            .andExpect(status().isPayloadTooLarge());
        mvc.perform(tusHead(s, location)).andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "0"));
    }

    @Test
    public void chunkOverServerChunkMaxIs413() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("chunk"));
        String location = create(s, "chunk.bin", TestConfig.TEST_CHUNK_MAX * 2);
        mvc.perform(tusPatch(s, location, 0, bytes((int) TestConfig.TEST_CHUNK_MAX + 1, (byte) 3)))
            .andExpect(status().isPayloadTooLarge());
        mvc.perform(tusPatch(s, location, 0, bytes((int) TestConfig.TEST_CHUNK_MAX, (byte) 3)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, String.valueOf(TestConfig.TEST_CHUNK_MAX)));
    }

    @Test
    public void deferLengthIsRejected() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("defer"));
        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_DEFER_LENGTH, "1")
                .header(TusHeaders.UPLOAD_METADATA, metadata("d.txt"))
                .header(TusHeaders.CSRF_TOKEN, csrf(s)))
            .andExpect(status().isBadRequest());
    }

    @Test
    public void wrongContentTypeIs415() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("ct"));
        String location = create(s, "ct.bin", 8);
        mvc.perform(tusPatch(s, location, 0, bytes(8, (byte) 4)).contentType("multipart/form-data"))
            .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    public void missingTusResumableIs412() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("ver"));
        mvc.perform(post("/upload").session(s)
                .header(TusHeaders.UPLOAD_LENGTH, "8")
                .header(TusHeaders.UPLOAD_METADATA, metadata("v.txt"))
                .header(TusHeaders.CSRF_TOKEN, csrf(s)))
            .andExpect(status().isPreconditionFailed())
            .andExpect(header().string(TusHeaders.TUS_VERSION_HEADER, "1.0.0"));
    }

    @Test
    public void overrideModeBehavesLikePatch() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("override"));
        byte[] file = pngBytes(16);
        String location = create(s, "o.png", file.length);
        mvc.perform(tusPatchViaOverride(s, location, 0, slice(file, 0, 8)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "8"));
        // override 도 offset 대조 (409) 를 똑같이 받는다
        mvc.perform(tusPatchViaOverride(s, location, 0, slice(file, 0, 8)))
            .andExpect(status().isConflict())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "8"));
        mvc.perform(tusPatchViaOverride(s, location, 8, slice(file, 8, 16)))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "16"));
        assertEquals(UploadStatus.APPROVED, repository.findById(idOf(location)).getStatus());
    }

    @Test
    public void invalidOverrideValueIs400() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("override-bad"));
        String location = create(s, "ob.bin", 8);
        mvc.perform(post(location).session(s)
                .header(TusHeaders.METHOD_OVERRIDE, "PUT")
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.UPLOAD_OFFSET, "0")
                .header(TusHeaders.CSRF_TOKEN, csrf(s))
                .contentType(TusHeaders.OFFSET_CONTENT_TYPE)
                .content(bytes(8, (byte) 5)))
            .andExpect(status().isBadRequest());
    }

    @Test
    public void plainPostOnUploadUrlWithoutOverrideIs405() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("post-url"));
        String location = create(s, "p.bin", 8);
        mvc.perform(post(location).session(s)
                .header(TusHeaders.TUS_RESUMABLE, "1.0.0")
                .header(TusHeaders.CSRF_TOKEN, csrf(s)))
            .andExpect(status().isMethodNotAllowed());
    }

    @Test
    public void checksumMatchAdvancesAndMismatchIs460() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("checksum"));
        byte[] file = pngBytes(16);
        String location = create(s, "c.png", file.length);
        byte[] chunk = slice(file, 0, 8);
        String good = "sha1 " + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest(chunk));
        String bad = "sha1 " + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest(bytes(8, (byte) 9)));

        mvc.perform(tusPatch(s, location, 0, chunk).header(TusHeaders.UPLOAD_CHECKSUM, bad))
            .andExpect(status().is(460));
        // 460 은 offset 을 전진시키지 않는다 (트랜잭션 롤백)
        mvc.perform(tusHead(s, location)).andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "0"));

        mvc.perform(tusPatch(s, location, 0, chunk).header(TusHeaders.UPLOAD_CHECKSUM, good))
            .andExpect(status().isNoContent())
            .andExpect(header().string(TusHeaders.UPLOAD_OFFSET, "8"));

        mvc.perform(tusPatch(s, location, 8, slice(file, 8, 16)).header(TusHeaders.UPLOAD_CHECKSUM, "md5 AAAA"))
            .andExpect(status().isBadRequest());
    }

    @Test
    public void terminationDeletesRowAndFile() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("terminate"));
        String location = create(s, "t.bin", 16);
        mvc.perform(tusPatch(s, location, 0, bytes(8, (byte) 6))).andExpect(status().isNoContent());
        UploadSession row = repository.findById(idOf(location));
        assertTrue(Files.exists(service.fileOf(row)));

        mvc.perform(tusDelete(s, location)).andExpect(status().isNoContent());
        assertFalse(Files.exists(service.fileOf(row)));
        mvc.perform(tusHead(s, location)).andExpect(status().isNotFound());
    }

    @Test
    public void expiredSessionIs410() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("expired"));
        String location = create(s, "e.bin", 16);
        repository.updateExpiresAt(idOf(location), Instant.now().minusSeconds(60));
        mvc.perform(tusHead(s, location)).andExpect(status().isGone());
        mvc.perform(tusPatch(s, location, 0, bytes(8, (byte) 7))).andExpect(status().isGone());
    }

    @Test
    public void zeroLengthUploadCompletesAtCreation() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("zero"));
        String location = create(s, "empty.txt", 0);
        assertEquals(UploadStatus.APPROVED, repository.findById(idOf(location)).getStatus());
    }

    @Test
    public void unknownIdIs404() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("unknown"));
        mvc.perform(tusHead(s, "/upload/00000000-0000-4000-8000-000000000000")).andExpect(status().isNotFound());
    }

    @Test
    public void magicBytesMismatchIsRejectedAndBytesDeleted() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("magic"));
        byte[] fake = "<% out.println(\"jsp\"); %>".getBytes("UTF-8");
        String location = create(s, "not-really.png", fake.length);
        mvc.perform(tusPatch(s, location, 0, fake)).andExpect(status().isNoContent());
        UploadSession row = repository.findById(idOf(location));
        assertEquals(UploadStatus.REJECTED, row.getStatus());
        assertFalse(Files.exists(service.fileOf(row)));
    }

    @Test
    public void quotaPerOwnerIs429() throws Exception {
        MockHttpSession s = sessionFor(uniqueOwner("quota"));
        for (int i = 0; i < TestConfig.TEST_MAX_ACTIVE; i++) {
            create(s, "q" + i + ".bin", 16);
        }
        mvc.perform(tusPost(s, 16, metadata("q-over.bin"))).andExpect(status().isTooManyRequests());
    }
}
