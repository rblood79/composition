package com.composition.upload.config;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.Test;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;

import com.composition.upload.TestConfig;

/** S1 — 웹루트 안 저장 디렉터리는 기동 거부. 단위 (검증기 직접) + 컨텍스트 (ApplicationContext refresh 실패) 둘 다. */
public class StorageDirectoryValidatorTest {

    /** MockServletContext 의 실경로 = 임시 디렉터리 (webroot 역할). */
    private static MockServletContext webrootAt(Path dir) {
        return new MockServletContext("file:" + dir.toAbsolutePath());
    }

    @Test
    public void directoryUnderWebRootIsRejected() throws Exception {
        Path webroot = Files.createTempDirectory("webroot");
        UploadProperties p = new UploadProperties();
        p.setStorageDir(webroot.resolve("uploads").toString());
        try {
            new StorageDirectoryValidator(p, webrootAt(webroot)).validate();
            fail("storage under the web root must be rejected");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage(), e.getMessage().contains("web root"));
            assertTrue(e.getMessage(), e.getMessage().contains("ADR-201 S1"));
        }
    }

    @Test
    public void webRootItselfIsRejected() throws Exception {
        Path webroot = Files.createTempDirectory("webroot-self");
        UploadProperties p = new UploadProperties();
        p.setStorageDir(webroot.toString());
        try {
            new StorageDirectoryValidator(p, webrootAt(webroot)).validate();
            fail("storage equal to the web root must be rejected");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("web root"));
        }
    }

    @Test
    public void directoryOutsideWebRootIsAccepted() throws Exception {
        Path webroot = Files.createTempDirectory("webroot-ok");
        Path outside = Files.createTempDirectory("uploads-ok");
        UploadProperties p = new UploadProperties();
        p.setStorageDir(outside.toString());
        new StorageDirectoryValidator(p, webrootAt(webroot)).validate();
        assertTrue(Files.isDirectory(outside));
    }

    @Test
    public void missingStorageDirFailsFast() {
        UploadProperties p = new UploadProperties();
        try {
            new StorageDirectoryValidator(p, new MockServletContext()).validate();
            fail("empty upload.storage.dir must be rejected");
        } catch (IllegalStateException expected) {
            assertTrue(expected.getMessage().contains("upload.storage.dir"));
        }
    }

    /** 기동 거부 실물 — 같은 배선 (TestConfig → UploadCoreConfig) 으로 컨텍스트를 올리면 refresh 가 실패한다. */
    @Test
    public void applicationContextFailsToStartWhenStorageIsUnderWebRoot() throws Exception {
        Path webroot = Files.createTempDirectory("webroot-ctx");
        String previous = System.getProperty(TestConfig.STORAGE_DIR_PROPERTY);
        System.setProperty(TestConfig.STORAGE_DIR_PROPERTY, webroot.resolve("WEB-INF/uploads").toString());
        AnnotationConfigWebApplicationContext ctx = new AnnotationConfigWebApplicationContext();
        try {
            ctx.setServletContext(webrootAt(webroot));
            ctx.register(TestConfig.class);
            ctx.refresh();
            fail("context must not start with storage under the web root");
        } catch (BeanCreationException e) {
            Throwable root = e;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            assertNotNull(root);
            assertTrue(root.getMessage(), root.getMessage().contains("web root"));
        } finally {
            if (previous == null) {
                System.clearProperty(TestConfig.STORAGE_DIR_PROPERTY);
            } else {
                System.setProperty(TestConfig.STORAGE_DIR_PROPERTY, previous);
            }
            if (ctx.isActive()) {
                ctx.close();
            }
        }
    }
}
