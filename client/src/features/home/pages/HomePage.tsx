import { useState } from 'react';
import { publicHref } from '../../../seo/paths';
import { Container } from '../../../components/ui/Card';
import { PublicCatalogSections } from '../../catalog/pages/PublicCatalogPage';
import { useLang, type Lang } from '../../../i18n';
import { useAuth } from '../../../auth';
import { gradeLabel } from '../../academic/model';
import { homeHeroImage, homeHeroImageSrcSet, homeHeroImageSizes } from '../../../seo/metadata';
import aliTahaBanner640 from '../../../assets/fayq-ali-taha-640.webp';
import aliTahaBanner1280 from '../../../assets/fayq-ali-taha-1280.webp';
import saifBanner640 from '../../../assets/fayq-saif-640.webp';
import saifBanner1280 from '../../../assets/fayq-saif-1280.webp';

type TextPair = readonly [string, string];

interface FounderStory {
  key: string;
  image: string;
  srcSet: string;
  alt: string;
  founders: {
    name: string;
    title: string;
    description: string;
  }[];
}

function HeroSection({
  lang,
  slogan,
  userRole,
  grade,
  onSelectGrade,
  onJumpToHow,
}: {
  lang: Lang;
  slogan: string;
  userRole: 'STUDENT' | 'ADMIN' | null;
  grade: string;
  onSelectGrade: (value: string) => void;
  onJumpToHow: () => void;
}): JSX.Element {
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  const workspaceHref = userRole === 'ADMIN' ? '#/admin/summary' : '#/dashboard';

  return (
    <section className="py-7 md:py-10 lg:py-12" aria-labelledby="hero-title">
      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.95fr] lg:gap-12">
          <div className="min-w-0 text-start">
            <p className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1 text-xs font-extrabold text-primary-strong">
              {c('FAYQ · البرمجة للمرحلة الثانوية', 'FAYQ · Programming for secondary school')}
            </p>
            <h1
              id="hero-title"
              className="text-[clamp(30px,3.2vw,48px)] font-extrabold leading-[1.28] text-ink"
            >
              {c('افهم البرمجة.', 'Understand programming.')}
              <br />
              <span className="text-primary-strong">
                {c('وكمّل دراستك بثقة.', 'Study with confidence.')}
              </span>
            </h1>
            <p className="mt-4 max-w-[50ch] text-base leading-relaxed text-muted md:text-[17px]">
              {c(
                'دورات مسجّلة لأولى وثانية ثانوي. اختار المحتوى المناسب لصفّك، راجع تفاصيله، وتعلّم في الوقت اللي يناسبك.',
                'Recorded courses for first and second secondary students. Find content for your grade, review the details and learn on your schedule.',
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-xl border border-transparent bg-primary px-6 py-2.5 text-base font-extrabold text-primary-ink no-underline shadow-rest transition-colors hover:bg-primary-hover active:bg-primary-pressed"
                href={publicHref('#/courses', lang)}
              >
                <span>{c('تصفّح الدورات', 'Browse courses')}</span>
                <span className="inline-block ltr:rotate-180" aria-hidden="true">←</span>
              </a>
              {userRole ? (
                <a
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-border-strong bg-elevated px-5 py-2 text-sm font-bold text-ink no-underline transition-colors hover:border-primary hover:bg-interactive"
                  href={workspaceHref}
                >
                  {c('مساحتي', 'My workspace')}
                </a>
              ) : (
                <a
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-border-strong bg-elevated px-5 py-2 text-sm font-bold text-ink no-underline transition-colors hover:border-primary hover:bg-interactive"
                  href="#/register"
                >
                  {c('إنشاء حساب', 'Create an account')}
                </a>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-muted" data-testid="brand-slogan">
              {slogan}
            </p>

            <aside
              className="mt-6 rounded-2xl border border-border-strong bg-surface p-4 shadow-rest sm:p-5"
              aria-labelledby="grade-choice-title"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id="grade-choice-title" className="text-base font-extrabold text-ink sm:text-lg">
                    {c('أنت في أي صف؟', 'Which grade are you in?')}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted sm:text-sm">
                    {c(
                      'اعرض الدورات المتاحة لصفّك، وقارن بينها قبل الاشتراك.',
                      'See available courses for your grade and compare them before enrolling.',
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(['FIRST_SECONDARY', 'SECOND_SECONDARY'] as const).map((value, index) => {
                  const active = grade === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectGrade(value)}
                      className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border p-3.5 text-start transition-colors ${
                        active
                          ? 'border-primary-strong bg-selected shadow-rest'
                          : 'border-border-strong bg-field hover:border-primary hover:bg-interactive'
                      }`}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-lg font-extrabold text-primary-ink"
                        aria-hidden="true"
                      >
                        {lang === 'ar' ? ['١', '٢'][index] : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-sm font-extrabold text-ink sm:text-base">
                          {gradeLabel(value, lang)}
                        </strong>
                        <small className="mt-0.5 block text-xs text-muted">
                          {c('عرض الدورات المتاحة', 'View available courses')}
                        </small>
                      </span>
                      <span className="ms-auto inline-block text-muted ltr:rotate-180" aria-hidden="true">
                        ←
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>

          <div className="min-w-0">
            <figure className="overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-lift">
              <img
                src={homeHeroImage}
                srcSet={homeHeroImageSrcSet}
                sizes={homeHeroImageSizes}
                alt={c(
                  'علي وطه وسيف يتعاونون حول حاسوب في مشهد FAYQ تعليمي وتقني.',
                  'Ali, Taha and Saif collaborating around a laptop in a FAYQ learning and technology scene.',
                )}
                className="block h-auto w-full object-cover"
                width={1280}
                height={512}
                decoding="async"
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-elevated/80 px-4 py-3 text-start">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold text-primary-strong sm:text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  {c('ابدأ من هنا · دروس مسجّلة واضحة', 'Start here · Clear recorded lessons')}
                </span>
                <button
                  type="button"
                  onClick={onJumpToHow}
                  className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-4 transition-colors hover:text-primary-strong"
                >
                  {c('كيف يتم الاشتراك؟', 'How does enrollment work?')}
                </button>
              </figcaption>
            </figure>
          </div>
        </div>
      </Container>
    </section>
  );
}

function BenefitsSection({ lang, benefits }: { lang: Lang; benefits: readonly TextPair[] }): JSX.Element {
  return (
    <section
      className="border-y border-border/70 bg-surface/60 py-8"
      aria-label={lang === 'ar' ? 'التعلّم على FAYQ' : 'Learning on FAYQ'}
    >
      <Container>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {benefits.map(([title, body]) => (
            <div
              key={title}
              className="rounded-2xl border border-border/70 bg-surface p-5 text-start shadow-rest"
            >
              <h2 className="text-base font-extrabold text-ink">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function StepsSection({ lang, steps }: { lang: Lang; steps: readonly TextPair[] }): JSX.Element {
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  return (
    <section
      id="how"
      className="border-y border-border/70 bg-surface/60 py-10 md:py-14"
      aria-labelledby="how-title"
    >
      <Container>
        <div className="text-start">
          <p className="mb-2 text-sm font-bold text-primary-strong">
            {c('من اختيار الدورة إلى أول درس', 'From choosing a course to your first lesson')}
          </p>
          <h2
            id="how-title"
            tabIndex={-1}
            className="scroll-mt-[100px] text-[clamp(26px,2.6vw,32px)] font-extrabold text-ink"
          >
            {c('اشتراكك في ثلاث خطوات', 'Enroll in three steps')}
          </h2>
        </div>
        <ol className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {steps.map(([title, body], index) => (
            <li
              key={title}
              className="rounded-2xl border border-border/70 bg-surface p-5 text-start shadow-rest"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 font-extrabold tabular-nums text-primary-strong"
              >
                {lang === 'ar' ? ['١', '٢', '٣'][index] : `0${index + 1}`}
              </span>
              <h3 className="mt-4 text-lg font-extrabold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function FaqSection({ lang, faqs }: { lang: Lang; faqs: readonly TextPair[] }): JSX.Element {
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  return (
    <section className="py-10 md:py-14" aria-labelledby="faq-title">
      <Container>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
          <div className="text-start">
            <p className="mb-2 text-sm font-bold text-primary-strong">
              {c('قبل الاشتراك', 'Before you enroll')}
            </p>
            <h2 id="faq-title" className="text-[clamp(26px,2.6vw,32px)] font-extrabold text-ink">
              {c('أسئلة تهمّك', 'Useful answers')}
            </h2>
            <p className="my-3 text-sm leading-relaxed text-muted">
              {c(
                'محتاج مساعدة في اختيار الدورة أو الشحن؟',
                'Need help choosing a course or adding funds?',
              )}
            </p>
            <a
              className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-4 transition-colors hover:text-primary-strong"
              href={publicHref('#/support', lang)}
            >
              {c('تواصل مع الدعم', 'Contact support')}
            </a>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface px-4 sm:px-6">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-1 text-start">
                <summary className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 py-3.5 text-sm font-bold text-ink sm:text-base">
                  <span>{q}</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ClosingCtaSection({ lang }: { lang: Lang }): JSX.Element {
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  return (
    <section
      className="border-t border-border bg-elevated py-8"
      aria-label={c('اختار دورتك', 'Choose your course')}
    >
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <h2 className="text-xl font-extrabold text-ink sm:text-2xl">
            {c('اختار اللي يناسب دراستك.', 'Find the right course for your studies.')}
          </h2>
          <a
            className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-xl border border-transparent bg-primary px-6 py-2.5 text-sm font-extrabold text-primary-ink no-underline shadow-rest transition-colors hover:bg-primary-hover sm:text-base"
            href={publicHref('#/courses', lang)}
          >
            <span>{c('عرض كل الدورات', 'View all courses')}</span>
            <span className="inline-block ltr:rotate-180" aria-hidden="true">←</span>
          </a>
        </div>
      </Container>
    </section>
  );
}

function FoundersSection({
  lang,
  founderStories,
}: {
  lang: Lang;
  founderStories: FounderStory[];
}): JSX.Element {
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);
  return (
    <section
      className="border-t border-border bg-surface py-10 md:py-14"
      aria-labelledby="founders-title"
    >
      <Container>
        <div className="mb-7 max-w-2xl text-start">
          <p className="mb-2 text-sm font-bold text-primary-strong">
            {c('الفريق اللي بيبني FAYQ سوا', 'The team building FAYQ together')}
          </p>
          <h2
            id="founders-title"
            className="text-start text-[clamp(26px,2.6vw,32px)] font-extrabold text-ink"
          >
            <bdi dir="ltr">ALI · TAHA · SAIF</bdi>
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted sm:text-base">
            {c(
              'إحنا الثلاثة مؤسسين وبنبني FAYQ سوا بهدف واحد.',
              'All three of us are founders, building FAYQ together around one shared goal.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {founderStories.map((story) => (
            <article
              key={story.key}
              className="overflow-hidden rounded-2xl border border-border bg-elevated shadow-lift"
            >
              <img
                src={story.image}
                srcSet={story.srcSet}
                sizes="(max-width: 768px) calc(100vw - 32px), 600px"
                alt={story.alt}
                className="block h-auto w-full bg-[#0b1422]"
                width={1280}
                height={512}
                loading="lazy"
                decoding="async"
              />
              <div className="grid gap-5 p-5 text-start sm:p-6">
                {story.founders.map((founder) => (
                  <div key={founder.name}>
                    <p className="mb-1.5 text-xs font-extrabold tracking-[0.12em] text-primary-strong">
                      <bdi dir="ltr">{founder.name}</bdi>
                    </p>
                    <h3 className="text-lg font-extrabold text-ink sm:text-xl">{founder.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{founder.description}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function HomePage({ onSelectCourse }: { onSelectCourse: (slug: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [grade, setGrade] = useState('');
  const c = (ar: string, en: string): string => (lang === 'ar' ? ar : en);

  function jumpTo(id: string): void {
    const title = document.getElementById(id);
    title?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    title?.focus({ preventScroll: true });
  }

  const benefits: TextPair[] = [
    [
      c('دروس مسجّلة', 'Recorded lessons'),
      c(
        'شاهد في وقتك، وارجع للشرح خلال فترة وصولك.',
        'Watch on your schedule and revisit explanations during your access period.',
      ),
    ],
    [
      c('تقدّم محفوظ', 'Saved progress'),
      c(
        'تابع الدروس التي أنهيتها من مساحة تعلّمك.',
        'Keep track of completed lessons in your learning space.',
      ),
    ],
    [
      c('شروط واضحة', 'Clear access terms'),
      c('راجع السعر ومدة الوصول قبل الاشتراك.', 'Review the price and access terms before enrolling.'),
    ],
  ];

  const steps: TextPair[] = [
    [
      c('اختار الدورة', 'Choose a course'),
      c(
        'راجع الصف والترم ووصف الدورة والسعر وشروط الوصول.',
        'Check the grade, term, description, price and access terms.',
      ),
    ],
    [
      c('جهّز رصيدك عند الحاجة', 'Add funds if needed'),
      c(
        'للدورات المدفوعة، ابعت طلب شحن وإثبات التحويل. الإدارة تراجع الطلب قبل إضافة الرصيد.',
        'For paid courses, submit a recharge request and transfer proof. An admin reviews it before crediting your wallet.',
      ),
    ],
    [
      c('أكّد اشتراكك وابدأ', 'Enroll and start learning'),
      c(
        'اشترك في الدورة من صفحة العرض، ثم افتح دروسك من «تعلّمي». الموافقة على الشحن وحدها لا تعني الاشتراك.',
        'Enroll from the course offer, then open your lessons in My learning. Recharge approval alone does not enroll you.',
      ),
    ],
  ];

  const faqs: TextPair[] = [
    [
      c('هل الدروس مناسبة للمبتدئين؟', 'Are the lessons suitable for beginners?'),
      c(
        'راجع وصف الدورة قبل الاشتراك؛ المستوى والمحتوى يختلفان من دورة لأخرى.',
        'Read the course description before enrolling; the level and content vary between courses.',
      ),
    ],
    [
      c('هل الدروس مباشرة أم مسجّلة؟', 'Are lessons live or recorded?'),
      c(
        'الدروس مسجّلة، ويمكن الرجوع إليها طالما وصولك للدورة سارٍ.',
        'Lessons are recorded and can be revisited while your course access is valid.',
      ),
    ],
    [
      c('ما مدة الوصول للدورة؟', 'How long can I access a course?'),
      c(
        'كل عرض يوضح شروطه: مدة تبدأ من الشراء، موعد محدد لنهاية الترم أو السنة، أو وصول بدون انتهاء حتى الحذف النهائي للدورة. الباقات لها موعد انتهاء مشترك موضح.',
        'Each offer states its terms: a duration from purchase, a fixed term or year deadline, or no expiry until permanent course removal. Packages state one shared deadline.',
      ),
    ],
    [
      c('كيف أشترك في دورة مجانية أو مدفوعة؟', 'How do I enroll in a free or paid course?'),
      c(
        'الدورة المجانية لا تحتاج رصيدًا؛ أكّد الاشتراك من عرضها. للدورة المدفوعة، اشحن محفظتك عند الحاجة وانتظر مراجعة الإدارة، ثم أكّد شراء الدورة بنفسك.',
        'A free course needs no wallet funds; confirm enrollment from its offer. For a paid course, add funds if needed, wait for admin review, then confirm the course purchase yourself.',
      ),
    ],
  ];

  const founderStories: FounderStory[] = [
    {
      key: 'saif',
      image: saifBanner1280,
      srcSet: `${saifBanner640} 640w, ${saifBanner1280} 1280w`,
      alt: c(
        'سيف في مشهد إبداعي لإنتاج محتوى FAYQ.',
        'Saif in a creative FAYQ content production scene.',
      ),
      founders: [
        {
          name: 'SAIF',
          title: c('المؤسس وقائد التسويق والهوية الإبداعية', 'Founder & Marketing Lead'),
          description: c(
            'صاحب الفكرة التي انطلقت منها FAYQ، ويقود التوجه التسويقي والهوية الإبداعية للمنصة، إلى جانب الإشراف على صناعة المحتوى والإنتاج المرئي والحملات الإعلانية.',
            'Originator of the FAYQ vision, leading marketing strategy, creative identity, content production, visual direction, and advertising campaigns.',
          ),
        },
      ],
    },
    {
      key: 'ali-taha',
      image: aliTahaBanner1280,
      srcSet: `${aliTahaBanner640} 640w, ${aliTahaBanner1280} 1280w`,
      alt: c(
        'علي وطه يتعاونان في البرمجة والتعلّم ضمن مشهد FAYQ.',
        'Ali and Taha collaborating on programming and learning in a FAYQ scene.',
      ),
      founders: [
        {
          name: 'ALI · TAHA',
          title: c(
            'المؤسسان وقائدا التطوير التقني والمحتوى التعليمي',
            'Founders & Technology and Education Leads',
          ),
          description: c(
            'يعمل علي وطه معًا على تطوير منصة FAYQ وتجربتها التعليمية، ويجمعان بين بناء الجانب التقني وإعداد محتوى تعليمي يبسّط البرمجة لطلاب المرحلة الثانوية خطوة بخطوة.',
            'Ali and Taha build the FAYQ platform and its learning experience together, combining software engineering with step-by-step programming courses tailored for high school students.',
          ),
        },
      ],
    },
  ];

  return (
    <main id="main">
      <HeroSection
        lang={lang}
        slogan={t.slogan}
        userRole={user?.role ?? null}
        grade={grade}
        onSelectGrade={(value) => {
          setGrade(value);
          jumpTo('catalog-title');
        }}
        onJumpToHow={() => jumpTo('how-title')}
      />
      <BenefitsSection lang={lang} benefits={benefits} />
      <PublicCatalogSections
        onSelect={onSelectCourse}
        compact
        compactGrade={grade}
        onCompactGradeChange={setGrade}
      />
      <StepsSection lang={lang} steps={steps} />
      <FaqSection lang={lang} faqs={faqs} />
      <ClosingCtaSection lang={lang} />
      <FoundersSection lang={lang} founderStories={founderStories} />
    </main>
  );
}
