package com.composition.upload.config;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.jdbc.datasource.init.DataSourceInitializer;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jndi.JndiDataSourceLookup;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 운영·개발 진입 config — {@code upload.properties} (시스템 프로퍼티·환경 변수가 우선) 에서 {@link UploadProperties}
 * 와 {@link DataSource} 를 만들고 {@link UploadCoreConfig} 를 import 한다. {@code @EnableScheduling} 은 TTL GC
 * ({@code ExpiredUploadReaper#reap}) 를 주기 실행한다 — Boot 없이 servlet 컨테이너 스레드로 동작.
 */
@Configuration
@EnableScheduling
@PropertySource("classpath:upload.properties")
@Import(UploadCoreConfig.class)
// 변형 ② (tus-lib 프로파일) 소스는 이 패키지에만 있고 기본 빌드에는 없다 — 스캔 결과 0 이면 그대로 무시된다
@ComponentScan(basePackages = "com.composition.upload.tuslib")
public class UploadWebConfig {

    @Bean
    public UploadProperties uploadProperties(Environment env) {
        UploadProperties p = new UploadProperties();
        p.setStorageDir(env.getRequiredProperty("upload.storage.dir"));
        p.setMaxSize(env.getProperty("upload.maxSize", Long.class, p.getMaxSize()));
        p.setChunkMaxBytes(env.getProperty("upload.chunk.maxBytes", Long.class, p.getChunkMaxBytes()));
        p.setTtlHours(env.getProperty("upload.ttlHours", Long.class, p.getTtlHours()));
        p.setMaxActivePerOwner(env.getProperty("upload.quota.maxActivePerOwner", Integer.class, p.getMaxActivePerOwner()));
        p.setAllowedExtensions(env.getProperty("upload.allowedExtensions", ""));
        p.setCorsAllowedOrigins(env.getProperty("upload.cors.allowedOrigins", ""));
        p.setDevLoginEnabled(env.getProperty("upload.devLogin.enabled", Boolean.class, Boolean.FALSE));
        return p;
    }

    /**
     * JNDI 이름이 있으면 컨테이너 DataSource (Oracle 운영 — 비밀은 Tomcat context.xml 에), 없으면 직접 연결 (개발 H2).
     */
    @Bean
    public DataSource dataSource(Environment env) throws ClassNotFoundException {
        String jndi = env.getProperty("upload.jdbc.jndiName", "");
        if (!jndi.trim().isEmpty()) {
            return new JndiDataSourceLookup().getDataSource(jndi.trim());
        }
        SimpleDriverDataSource ds = new SimpleDriverDataSource();
        ds.setDriverClass(loadDriver(env.getRequiredProperty("upload.jdbc.driver")));
        ds.setUrl(env.getRequiredProperty("upload.jdbc.url"));
        ds.setUsername(env.getProperty("upload.jdbc.username", ""));
        ds.setPassword(env.getProperty("upload.jdbc.password", ""));
        return ds;
    }

    /** upload.jdbc.initSchema=h2 이면 기동 시 schema-h2.sql (CREATE TABLE IF NOT EXISTS) 실행. Oracle 은 none. */
    @Bean
    public DataSourceInitializer dataSourceInitializer(DataSource dataSource, Environment env) {
        DataSourceInitializer initializer = new DataSourceInitializer();
        initializer.setDataSource(dataSource);
        String mode = env.getProperty("upload.jdbc.initSchema", "none");
        if ("h2".equalsIgnoreCase(mode)) {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource("schema-h2.sql"));
            initializer.setDatabasePopulator(populator);
        } else {
            initializer.setEnabled(false);
        }
        return initializer;
    }

    @SuppressWarnings("unchecked")
    private static Class<? extends java.sql.Driver> loadDriver(String className) throws ClassNotFoundException {
        return (Class<? extends java.sql.Driver>) Class.forName(className);
    }
}
