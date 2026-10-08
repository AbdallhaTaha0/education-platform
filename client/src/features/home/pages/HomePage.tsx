import { useState } from 'react';
import { publicHref } from '../../../seo/paths';
import { Container } from '../../../components/ui/Card';
import { PublicCatalogSections } from '../../catalog/pages/PublicCatalogPage';
import { useLang } from '../../../i18n';
import { useAuth } from '../../../auth';
import { gradeLabel } from '../../academic/model';

export function HomePage({ onSelectCourse }: { onSelectCourse: (slug: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [grade, setGrade] = useState('');
  const c = (ar: string, en: string): string => lang === 'ar' ? ar : en;
  function jumpTo(id: string): void {
    const title = document.getElementById(id);
    title?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    title?.focus({ preventScroll: true });
  }
  const benefits = [
    [c('دروس مسجّلة', 'Recorded lessons'), c('شاهد في وقتك، وارجع للشرح خلال فترة وصولك.', 'Watch on your schedule and revisit explanations during your access period.')],
    [c('تقدّم محفوظ', 'Saved progress'), c('تابع الدروس التي أنهيتها من مساحة تعلّمك.', 'Keep track of completed lessons in your learning space.')],
    [c('شروط واضحة', 'Clear access terms'), c('راجع السعر ومدة الوصول قبل الاشتراك.', 'Review the price and access terms before enrolling.')],
  ];
  const steps = [
    [c('اختار الدورة', 'Choose a course'), c('راجع الصف والترم ووصف الدورة والسعر وشروط الوصول.', 'Check the grade, term, description, price and access terms.')],
    [c('جهّز رصيدك عند الحاجة', 'Add funds if needed'), c('للدورات المدفوعة، ابعت طلب شحن وإثبات التحويل. الإدارة تراجع الطلب قبل إضافة الرصيد.', 'For paid courses, submit a recharge request and transfer proof. An admin reviews it before crediting your wallet.')],
    [c('أكّد اشتراكك وابدأ', 'Enroll and start learning'), c('اشترك في الدورة من صفحة العرض، ثم افتح دروسك من «تعلّمي». الموافقة على الشحن وحدها لا تعني الاشتراك.', 'Enroll from the course offer, then open your lessons in My learning. Recharge approval alone does not enroll you.')],
  ];
  const faqs = [
    [c('هل الدروس مناسبة للمبتدئين؟', 'Are the lessons suitable for beginners?'), c('راجع وصف الدورة قبل الاشتراك؛ المستوى والمحتوى يختلفان من دورة لأخرى.', 'Read the course description before enrolling; the level and content vary between courses.')],
    [c('هل الدروس مباشرة أم مسجّلة؟', 'Are lessons live or recorded?'), c('الدروس مسجّلة، ويمكن الرجوع إليها طالما وصولك للدورة سارٍ.', 'Lessons are recorded and can be revisited while your course access is valid.')],
    [c('ما مدة الوصول للدورة؟', 'How long can I access a course?'), c('كل عرض يوضح شروطه: مدة تبدأ من الشراء، موعد محدد لنهاية الترم أو السنة، أو وصول بدون انتهاء حتى الحذف النهائي للدورة. الباقات لها موعد انتهاء مشترك موضح.', 'Each offer states its terms: a duration from purchase, a fixed term or year deadline, or no expiry until permanent course removal. Packages state one shared deadline.')],
    [c('كيف أشترك في دورة مجانية أو مدفوعة؟', 'How do I enroll in a free or paid course?'), c('الدورة المجانية لا تحتاج رصيدًا؛ أكّد الاشتراك من عرضها. للدورة المدفوعة، اشحن محفظتك عند الحاجة وانتظر مراجعة الإدارة، ثم أكّد شراء الدورة بنفسك.', 'A free course needs no wallet funds; confirm enrollment from its offer. For a paid course, add funds if needed, wait for admin review, then confirm the course purchase yourself.')],
  ];
  return (
    <main id="main" className="[&_h1]:text-[clamp(34px,3.6vw,52px)] [&_h1]:font-extrabold [&_h1]:leading-[1.4] [&_h1_span]:text-primary-strong max-sm:[&_h1]:text-[34px] max-sm:[&_h1]:leading-[1.45]">
      <section className="pb-12 pt-16 max-lg:py-9" aria-labelledby="hero-title">
        <Container>
          <div className="grid grid-cols-[1.15fr_0.85fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-7">
            <div>
              <p className="mb-3 text-sm font-bold text-primary-strong">{c('FAYQ · البرمجة للمرحلة الثانوية', 'FAYQ · Programming for secondary school')}</p>
              <h1 id="hero-title">{c('افهم البرمجة.', 'Understand programming.')}<br /><span>{c('وكمّل دراستك بثقة.', 'Study with confidence.')}</span></h1>
              <p className="mt-5 max-w-[46ch] text-[17px] text-muted max-lg:max-w-[60ch] max-sm:mt-4 max-sm:text-base">{c('دورات مسجّلة لأولى وثانية ثانوي. اختار المحتوى المناسب لصفّك، راجع تفاصيله، وتعلّم في الوقت اللي يناسبك.', 'Recorded courses for first and second secondary students. Find content for your grade, review the details and learn on your schedule.')}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a className="inline-flex min-h-[52px] items-center justify-center gap-4 rounded-xl border border-transparent bg-primary px-6 py-2.5 font-extrabold text-primary-ink no-underline hover:bg-primary-hover max-sm:px-[18px] max-sm:text-sm" href={publicHref('#/courses', lang)}>{c('تصفّح الدورات', 'Browse courses')}<span className="inline-block ltr:rotate-180" aria-hidden="true">←</span></a>
                {user ? <a className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-[5px] hover:text-primary-strong" href={user.role === 'ADMIN' ? '#/admin/summary' : '#/dashboard'}>{c('مساحتي', 'My workspace')}</a> : <a className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-[5px] hover:text-primary-strong" href="#/register">{c('إنشاء حساب', 'Create an account')}</a>}
              </div>
              <p className="mt-6 text-sm text-muted" data-testid="brand-slogan">{t.slogan}</p>
            </div>
            <aside className="rounded-[20px] border border-border-strong bg-surface p-7 max-lg:max-w-[640px] max-sm:p-5 [&_h2]:text-2xl [&_h2]:font-extrabold [&>p:not(:first-child)]:mt-2 [&>p:not(:first-child)]:text-sm [&>p:not(:first-child)]:text-muted" aria-labelledby="grade-choice-title">
              <p className="mb-3 text-sm font-bold text-primary-strong">{c('ابدأ من هنا', 'Start here')}</p>
              <h2 id="grade-choice-title">{c('أنت في أي صف؟', 'Which grade are you in?')}</h2>
              <p>{c('اعرض الدورات المتاحة لصفّك، وقارن بينها قبل الاشتراك.', 'See available courses for your grade and compare them before enrolling.')}</p>
              <div className="mb-3 mt-6 grid gap-3 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-3.5 [&_button]:rounded-xl [&_button]:border [&_button]:border-border-strong [&_button]:bg-field [&_button]:p-4 [&_button]:text-start [&_button:hover]:bg-interactive [&_button[aria-pressed=true]]:border-primary-strong [&_button[aria-pressed=true]]:bg-selected max-sm:[&_button]:gap-3 max-sm:[&_button]:p-3 [&_strong]:block [&_strong]:text-[17px] [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-muted [&>button>span:last-child]:ms-auto">
                {['FIRST_SECONDARY', 'SECOND_SECONDARY'].map((value, index) => (
                  <button key={value} type="button" aria-pressed={grade === value} onClick={() => { setGrade(value); jumpTo('catalog-title'); }}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary text-xl font-extrabold text-primary-ink" aria-hidden="true">{lang === 'ar' ? ['١', '٢'][index] : index + 1}</span>
                    <span><strong>{gradeLabel(value, lang)}</strong><small>{c('عرض الدورات المتاحة', 'View available courses')}</small></span>
                    <span className="inline-block ltr:rotate-180" aria-hidden="true">←</span>
                  </button>
                ))}
              </div>
              <button className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-[5px] hover:text-primary-strong" type="button" onClick={() => jumpTo('how-title')}>{c('كيف يتم الاشتراك؟', 'How does enrollment work?')}</button>
            </aside>
          </div>
        </Container>
      </section>
      <section className="border-y border-border bg-surface py-6" aria-label={c('التعلّم على FAYQ', 'Learning on FAYQ')}>
        <Container><div className="grid grid-cols-3 gap-8 max-sm:grid-cols-1 max-sm:gap-4 [&_h2]:text-base [&_h2]:font-bold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted">{benefits.map(([title, body]) => <div key={title}><h2>{title}</h2><p>{body}</p></div>)}</div></Container>
      </section>
      <PublicCatalogSections onSelect={onSelectCourse} compact compactGrade={grade} onCompactGradeChange={setGrade} />
      <section id="how" className="border-y border-border bg-surface py-12 max-sm:py-8 [&_ol]:mt-7 [&_ol]:grid [&_ol]:grid-cols-3 [&_ol]:gap-8 max-sm:[&_ol]:grid-cols-1 max-sm:[&_ol]:gap-6 [&_li>span]:inline-flex [&_li>span]:size-9 [&_li>span]:items-center [&_li>span]:justify-center [&_li>span]:rounded-full [&_li>span]:border [&_li>span]:border-border-strong [&_li>span]:font-extrabold [&_li>span]:text-primary-strong [&_h3]:mt-3.5 [&_h3]:text-lg [&_h3]:font-bold [&_li_p]:mt-2 [&_li_p]:text-sm [&_li_p]:text-muted max-sm:[&_li]:grid max-sm:[&_li]:grid-cols-[36px_1fr] max-sm:[&_li]:items-center max-sm:[&_li]:gap-x-3 max-sm:[&_li]:gap-y-1 max-sm:[&_h3]:mt-0 max-sm:[&_li_p]:col-start-2 max-sm:[&_li_p]:mt-0" aria-labelledby="how-title">
        <Container>
          <div className="[&_h2]:text-[clamp(26px,2.6vw,32px)] [&_h2]:font-extrabold [&_h2]:scroll-mt-[100px]"><p className="mb-3 text-sm font-bold text-primary-strong">{c('من اختيار الدورة إلى أول درس', 'From choosing a course to your first lesson')}</p><h2 id="how-title" tabIndex={-1}>{c('اشتراكك في ثلاث خطوات', 'Enroll in three steps')}</h2></div>
          <ol>{steps.map(([title, body], index) => <li key={title}><span aria-hidden="true">{lang === 'ar' ? ['١', '٢', '٣'][index] : `0${index + 1}`}</span><h3>{title}</h3><p>{body}</p></li>)}</ol>
        </Container>
      </section>
      <section className="py-12 max-sm:py-8 [&_h2]:text-[clamp(26px,2.6vw,32px)] [&_h2]:font-extrabold [&_details]:border-b [&_details]:border-border [&_summary]:min-h-[52px] [&_summary]:cursor-pointer [&_summary]:px-2 [&_summary]:py-4 [&_summary]:font-bold [&_details_p]:px-2 [&_details_p]:pb-5 [&_details_p]:text-sm [&_details_p]:text-muted" aria-labelledby="faq-title">
        <Container><div className="grid grid-cols-[0.75fr_1.25fr] gap-16 max-sm:grid-cols-1 max-sm:gap-6 [&>div>p:not(:first-child)]:my-3 [&>div>p:not(:first-child)]:text-sm [&>div>p:not(:first-child)]:text-muted"><div><p className="mb-3 text-sm font-bold text-primary-strong">{c('قبل الاشتراك', 'Before you enroll')}</p><h2 id="faq-title">{c('أسئلة تهمّك', 'Useful answers')}</h2><p>{c('محتاج مساعدة في اختيار الدورة أو الشحن؟', 'Need help choosing a course or adding funds?')}</p><a className="inline-flex min-h-[44px] items-center text-sm font-bold text-ink underline underline-offset-[5px] hover:text-primary-strong" href={publicHref('#/support', lang)}>{c('تواصل مع الدعم', 'Contact support')}</a></div><div>{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></Container>
      </section>
      <section className="border-t border-border bg-elevated py-7 [&>div>div]:flex [&>div>div]:flex-wrap [&>div>div]:items-center [&>div>div]:justify-between [&>div>div]:gap-5 [&_h2]:text-2xl [&_h2]:font-bold" aria-label={c('اختار دورتك', 'Choose your course')}>
        <Container><div><h2>{c('اختار اللي يناسب دراستك.', 'Find the right course for your studies.')}</h2><a className="inline-flex min-h-[52px] items-center justify-center gap-4 rounded-xl border border-transparent bg-primary px-6 py-2.5 font-extrabold text-primary-ink no-underline hover:bg-primary-hover max-sm:px-[18px] max-sm:text-sm" href={publicHref('#/courses', lang)}>{c('عرض كل الدورات', 'View all courses')}<span className="inline-block ltr:rotate-180" aria-hidden="true">←</span></a></div></Container>
      </section>
    </main>
  );
}
