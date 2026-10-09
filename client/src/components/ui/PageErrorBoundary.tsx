import { Component, createRef, type ReactNode } from 'react';
import type { Lang } from '../../i18n';
import { Container } from './Card';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  lang: Lang;
  onReload: () => void;
}

/** Keep navigation usable if a lazy page fails, without automatic reloads. */
export class PageErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  private heading = createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.heading.current?.focus();
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const ar = this.props.lang === 'ar';
    return <main id="main" className="py-8">
      <Container>
        <h1 ref={this.heading} tabIndex={-1} className="mb-3 text-2xl font-semibold">
          {ar ? 'تعذّر فتح الصفحة' : 'Could not open this page'}
        </h1>
        <p role="alert" className="mb-4 text-muted">
          {ar
            ? 'قد تكون نسخة الموقع تغيّرت أو انقطع الاتصال. أعد تحميل الصفحة للمحاولة مجددًا. قد تفقد التعديلات غير المحفوظة.'
            : 'The site may have updated or the connection was interrupted. Reload to try again. Unsaved changes may be lost.'}
        </p>
        <Button onClick={this.props.onReload}>
          {ar ? 'إعادة تحميل الصفحة' : 'Reload page'}
        </Button>
      </Container>
    </main>;
  }
}
