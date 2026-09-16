package com.composition.upload.config;

import java.util.EnumSet;

import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.ServletRegistration;

import org.springframework.web.servlet.support.AbstractAnnotationConfigDispatcherServletInitializer;

import com.composition.upload.web.CsrfHeaderFilter;
import com.composition.upload.web.MethodOverrideFilter;

/**
 * servlet 3.1 {@code WebApplicationInitializer} — web.xml 없이 DispatcherServlet 과 필터 2개를 등록한다.
 *
 * <ul>
 *   <li>{@code dispatchOptionsRequest=true} — TUS {@code OPTIONS} 능력 감지가 컨트롤러까지 도달하게 한다</li>
 *   <li>필터는 {@code /*} 에 건다 — JSP 페이지 요청도 {@link CsrfHeaderFilter} 를 지나 세션 토큰이 만들어진다</li>
 * </ul>
 */
public class UploadWebAppInitializer extends AbstractAnnotationConfigDispatcherServletInitializer {

    @Override
    protected Class<?>[] getRootConfigClasses() {
        return null;
    }

    @Override
    protected Class<?>[] getServletConfigClasses() {
        return new Class<?>[] { UploadWebConfig.class };
    }

    @Override
    protected String[] getServletMappings() {
        return new String[] { "/" };
    }

    @Override
    protected void customizeRegistration(ServletRegistration.Dynamic registration) {
        registration.setInitParameter("dispatchOptionsRequest", "true");
    }

    @Override
    public void onStartup(ServletContext servletContext) throws ServletException {
        super.onStartup(servletContext);
        EnumSet<DispatcherType> types = EnumSet.of(DispatcherType.REQUEST);
        // 순서: override → CSRF. CSRF 필터가 override 된 메서드를 본다.
        FilterRegistration.Dynamic override = servletContext.addFilter("methodOverrideFilter", new MethodOverrideFilter());
        override.addMappingForUrlPatterns(types, true, "/*");
        FilterRegistration.Dynamic csrf = servletContext.addFilter("csrfHeaderFilter", new CsrfHeaderFilter());
        csrf.addMappingForUrlPatterns(types, true, "/*");
    }
}
