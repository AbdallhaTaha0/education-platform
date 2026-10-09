import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from './PageErrorBoundary';
import { LanguageProvider } from '../../i18n';

describe('page failure recovery rendering', () => {
  it('leaves healthy page content unchanged', () => {
    const boundary = new PageErrorBoundary({ lang: 'en', onReload: vi.fn(), children: 'Existing page' });
    expect(boundary.render()).toBe('Existing page');
  });
  it.each(['en', 'ar'] as const)('renders an accessible manual recovery in %s', (lang) => {
    const reload = vi.fn();
    const boundary = new PageErrorBoundary({ lang, onReload: reload, children: 'Broken page' });
    boundary.state = PageErrorBoundary.getDerivedStateFromError();
    const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLang: lang, children: boundary.render() }));
    expect(html).toContain('id="main"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain(lang === 'en' ? 'Reload page' : 'إعادة تحميل الصفحة');
    expect(html).toContain(lang === 'en' ? 'Unsaved changes may be lost' : 'قد تفقد التعديلات غير المحفوظة');
    expect(html).not.toContain('Broken page');
    expect(reload).not.toHaveBeenCalled();
  });
});
