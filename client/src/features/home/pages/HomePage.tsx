import { Container } from '../../../components/ui/Card';
import { PublicCatalogSections } from '../../catalog/pages/PublicCatalogPage';
import { useLang } from '../../../i18n';
import { useAuth } from '../../../auth';
import heroSmall from '../../../assets/fayq-learning-640.webp';
import heroLarge from '../../../assets/fayq-learning-1280.webp';

export function HomePage({
  onSelectCourse,
}: {
  onSelectCourse: (slug: string) => void;
}): JSX.Element {
  const { t, lang } = useLang();
  const {user}=useAuth();
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  const how = (): void => {
    const title = document.getElementById('how-title');
    title?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    title?.focus({ preventScroll: true });
  };
  const benefits = [
    [
      c('افهم الفكرة', 'Make it click'),
      c(
        'شرح واضح يخلّي المفاهيم أقرب ليك.',
        'Clear explanations that make concepts feel familiar.',
      ),
    ],
    [
      c('جرّب بنفسك', 'Try it yourself'),
      c(
        'اكتب الكود وجرّب الأفكار على جهازك.',
        'Write code and explore ideas on your own computer.',
      ),
    ],
    [
      c('كمّل على مهلك', 'Find your pace'),
      c(
        'دروس مسجّلة وتقدّم محفوظ خلال اشتراكك.',
        'Recorded lessons and saved progress during your subscription.',
      ),
    ],
  ];
  const steps = [
    [
      c('اختار دورتك', 'Find your course'),
      c(
        'اختار صفك والترم، وراجع الشرح الشهري والمراجعات والباقات وشروط الوصول.',
        'Choose your grade and term. Review monthly courses, revisions, packages and access terms.',
      ),
    ],
    [
      c('جهّز رصيدك', 'Fund your wallet'),
      c(
        'لو محتاج رصيد، ابعت طلب شحن يدوي. الإدارة تراجع التحويل وتضيف الرصيد بعد الموافقة.',
        'If you need funds, submit a manual recharge. An admin verifies the transfer and credits your wallet after approval.',
      ),
    ],
    [
      c('اشترك وابدأ', 'Purchase, then begin'),
      c(
        'اشترِ الدورة من رصيدك. مدة الوصول تبدأ فور الشراء، وتقدر تجدّد عند انتهائها.',
        'Purchase the course with your balance. Access starts immediately at purchase; you can renew when it ends.',
      ),
    ],
  ];
  const faqs = [
    [
      c('هل لازم أعرف برمجة قبل ما أبدأ؟', 'Do I need to know programming already?'),
      c(
        'راجع وصف كل دورة واختار اللي يناسب مستواك. الدورات مختلفة؛ مش كل دورة للمبتدئين.',
        'Read each course description and choose one that fits your level. Not every course is for beginners.',
      ),
    ],
    [
      c('الدروس مباشرة ولا مسجّلة؟', 'Are the lessons live or recorded?'),
      c(
        'كل الدروس مسجّلة، تتعلّم منها في الوقت المناسب ليك خلال مدة اشتراكك.',
        'All lessons are recorded. Learn at a time that suits you during your subscription.',
      ),
    ],
    [
      c('الاشتراك مدته قد إيه؟', 'How long does access last?'),
      c(
        'شروط الوصول واضحة في كل عرض: مدة من الشراء، موعد محدد لنهاية الترم أو السنة، أو بدون انتهاء حتى الحذف النهائي للكورس. الباقات لها موعد انتهاء واحد موضح.',
        'Each offer states its access terms: a duration from purchase, a fixed term or year deadline, or no expiry until permanent course removal. Packages show one shared deadline.',
      ),
    ],
    [
      c('إزاي أدفع وأبدأ؟', 'How do I pay and get started?'),
      c(
        'ابعت طلب شحن بالمبلغ والإثبات من المحفظة. بعد مراجعة الإدارة وإضافة الرصيد، اشترِ الدورة بنفسك. الموافقة على الشحن لوحدها مش اشتراك.',
        'Submit a recharge amount and proof from your wallet. After admin review and credit, purchase the course yourself. Recharge approval alone is not a subscription.',
      ),
    ],
  ];
  return (
    <main id="main" className="fayq-home">
      <section className="youth-hero" aria-labelledby="hero-title">
        <Container>
          <div className="youth-hero__grid">
            <div className="youth-hero__copy">
              <p className="eyebrow">
                {c('مساحتك لفهم البرمجة', 'Your space to understand programming')}
              </p>
              <h1 id="hero-title">
                {c('افهم الفكرة.', 'Understand it.')}
                <br />
                {c('اكتب الكود.', 'Code it.')}
                <br />
                <span>{c('ابنِ حاجة ليك.', 'Build something yours.')}</span>
              </h1>
              <p className="hero-description">
                {c(
                  'من أول سؤال لأول تجربة. دروس برمجة مسجّلة لأولى وثانية ثانوي، تساعدك تفهم وتطبّق خطوة بخطوة.',
                  'From your first question to your first experiment. Recorded programming lessons for first and second secondary students, with room to understand and practise.',
                )}
              </p>
              <div className="hero-actions">
                {!user ? <a className="fayq-action fayq-action--quiet" href="#/register">{c('أنشئ حساب طالب','Create a student account')}</a>:null}
                <a className="fayq-action" href="#/courses">
                  {c('اكتشف الدورات', 'Explore courses')}
                  <span aria-hidden="true">↗</span>
                </a>
                <button className="fayq-action fayq-action--quiet" type="button" onClick={how}>
                  {c('إزاي أبدأ؟', 'How do I start?')}
                </button>
              </div>
              <p className="hero-slogan" data-testid="brand-slogan">
                {t.slogan}
              </p>
            </div>
            <div className="youth-hero__art">
              <img
                src={heroLarge}
                srcSet={`${heroSmall} 640w, ${heroLarge} 1280w`}
                sizes="(min-width: 1024px) 52vw, 100vw"
                width="1280"
                height="720"
                alt=""
                fetchPriority="high"
              />
              <div className="hero-art-note">
                <span aria-hidden="true">&lt;/&gt;</span>
                <p>
                  {c('الفهم هو البداية.', 'Understanding comes first.')}
                  <strong>{c('والتجربة خطوتك الجاية.', 'Your next step is trying.')}</strong>
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
      <section className="benefit-strip" aria-label={c('ليه FAYQ؟', 'Why FAYQ?')}>
        <Container>
          <div className="benefit-strip__grid">
            {benefits.map(([title, body], n) => (
              <article key={title}>
                <span aria-hidden="true" className="benefit-number">
                  0{n + 1}
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <PublicCatalogSections onSelect={onSelectCourse} compact />
      <section className="build-story" aria-labelledby="build-title">
        <Container>
          <div className="build-story__grid">
            <div>
              <p className="eyebrow">
                {c('فكرة صغيرة. بداية كبيرة.', 'A small idea. A great start.')}
              </p>
              <h2 id="build-title">
                {c('خلّي أول تجربة', 'Make your first experiment')}
                <br />
                <span>{c('تشبهك.', 'feel like you.')}</span>
              </h2>
              <p>
                {c(
                  'جرّب تطبّق اللي اتعلّمته خارج الدرس: صفحة عن هوايتك، أو برنامج صغير يساعدك ترتّب يومك. اختار فكرة بسيطة وابنِ عليها.',
                  'Take what you learn beyond the lesson: a page about your hobby, or a small program to organise your day. Pick a simple idea and build on it.',
                )}
              </p>
              <p className="story-caption">
                {c(
                  'أفكار للتجربة على جهازك؛ المحتوى المتاح موضّح في وصف كل دورة.',
                  'Ideas to try on your computer; available content is described in each course offer.',
                )}
              </p>
            </div>
            <div
              className="project-window"
              dir="ltr"
              aria-label={c('مثال توضيحي لفكرة صفحة شخصية', 'Illustrative personal-page idea')}
            >
              <div className="project-window__bar">
                <span aria-hidden="true">● ● ●</span>
                <span>my-first-page.html</span>
              </div>
              <div className="project-window__body">
                <span className="project-tag">&lt;hello, world /&gt;</span>
                <h3>{c('دي فكرتي.', 'This is my idea.')}</h3>
                <div className="project-lines" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span className="project-sticker" aria-hidden="true">
                  ✳
                </span>
                <p>{c('مثال للتوضيح', 'Illustrative example')}</p>
              </div>
            </div>
          </div>
        </Container>
      </section>
      <section id="how" className="landing-section" aria-labelledby="how-title">
        <Container>
          <p className="eyebrow">{c('خطوات واضحة', 'A clear path')}</p>
          <h2 id="how-title" className="landing-title" tabIndex={-1}>
            {c('جاهز تبدأ؟ خطوة بخطوة.', 'Ready to begin? One step at a time.')}
          </h2>
          <ol className="learning-steps">
            {steps.map(([title, body], n) => (
              <li key={title}>
                <span aria-hidden="true">0{n + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>
      <section className="landing-section landing-faq" aria-labelledby="faq-title">
        <Container>
          <div className="faq-grid">
            <div>
              <p className="eyebrow">{c('قبل ما تبدأ', 'Before you start')}</p>
              <h2 id="faq-title" className="landing-title">
                {c('أسئلة في بالك؟', 'Questions on your mind?')}
              </h2>
            </div>
            <div>
              {faqs.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>
      <section className="landing-section">
        <Container>
          <div className="landing-final">
            <p className="eyebrow">{t.slogan}</p>
            <h2>{c('أول خطوة مستنياك.', 'Your first step is waiting.')}</h2>
            <a href="#/courses" className="fayq-action">
              {c('اختار دورتك', 'Find your course')}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </Container>
      </section>
    </main>
  );
}
