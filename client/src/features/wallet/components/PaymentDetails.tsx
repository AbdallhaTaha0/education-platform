import { useState } from 'react';
import instaPayLogo from '../../../assets/payments/instapay.png';
import vodafoneLogo from '../../../assets/payments/vodafone.svg';
import { useLang } from '../../../i18n';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import type { PaymentInstruction } from '../types/models';

export function PaymentDetails({ receiving, stacked = false }: { receiving: PaymentInstruction; stacked?: boolean }): JSX.Element {
  const { lang, t } = useLang(); const ar = lang === 'ar';
  const [copied, setCopied] = useState(''); const [copyError, setCopyError] = useState(false);
  const label = (a: string, e: string) => ar ? a : e;
  const number = receiving.accountLabel;
  const displayed = /^\+20\d{10}$/.test(number) ? `${number.slice(0, 3)} ${number.slice(3, 5)} ${number.slice(5)}` : number;
  const instructions = (ar ? receiving.instructionsAr : receiving.instructionsEn).split(/(?<=\.)\s+|\n+/).filter(s => s.trim());
  async function copy() {
    setCopyError(false);
    try { await navigator.clipboard.writeText(number); setCopied(number); }
    catch { setCopyError(true); }
  }
  return <Card className="min-w-0" data-testid="payment-details">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        {receiving.channel === 'INSTAPAY' ? <span className="flex h-10 w-28 shrink-0 items-center rounded-control bg-[#4b1673] px-3"><img src={instaPayLogo} alt="" width="1024" height="125" className="h-auto w-full" data-testid="payment-logo" /></span> : receiving.channel === 'MOBILE_WALLET' ? <img src={vodafoneLogo} alt="" width="40" height="40" className="h-10 w-10 shrink-0" data-testid="payment-logo" /> : null}
        <h3 className="text-xl font-bold">{receiving.channel === 'INSTAPAY' ? t.channelInstapay : receiving.channel === 'BANK_TRANSFER' ? t.channelBank : t.channelMobile}</h3>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">{label('تحويل يدوي', 'Manual transfer')}</span>
    </div>
    <div className={`grid min-w-0 gap-5 ${stacked ? "" : "md:grid-cols-2"}`}>
      <div className="min-w-0 rounded-control border border-border bg-elevated p-4">
        <p className="text-sm text-muted">{label('رقم أو عنوان الاستلام', 'Receiving number or address')}</p>
        <p dir="ltr" className="my-3 break-words text-start font-mono text-xl font-bold text-ink sm:text-2xl" data-testid="receiving-number">{displayed}</p>
        <Button variant="secondary" onClick={() => void copy()} data-testid="copy-receiving">{copied === number ? label('تم النسخ ✓', 'Copied ✓') : label('نسخ بيانات الاستلام', 'Copy receiving details')}</Button>
        <p role="status" className="mt-2 text-sm text-muted">{copyError ? label('تعذر النسخ تلقائيًا. يمكنك تحديد الرقم ونسخه.', 'Could not copy automatically. Select and copy the number.') : copied === number ? label('تم نسخ البيانات؛ تحقق من اسم المستلم قبل التحويل.', 'Details copied; check the recipient name before transferring.') : label('تحقق من بيانات المستلم داخل تطبيق الدفع.', 'Check the recipient details in your payment app.')}</p>
      </div>
      <div className="min-w-0">
        {receiving.channel === 'INSTAPAY' && receiving.qrUrl?.startsWith('/api/wallet/payment-settings/instapay/qr?') ? <figure className="mb-5 rounded-control border border-border bg-surface p-4"><img src={receiving.qrUrl} alt={label('رمز QR لحساب InstaPay؛ تحقق من اسم المستلم داخل التطبيق', 'InstaPay account QR; verify the recipient in the payment app')} className="mx-auto h-auto max-h-64 max-w-full bg-white object-contain" data-testid="instapay-qr" /><figcaption className="mt-3 text-sm text-muted">{label('امسح الرمز داخل InstaPay وتحقق من المستلم والمبلغ قبل التحويل. الشحن يحتاج موافقة الإدارة.', 'Scan in InstaPay and verify the recipient and amount before transferring. Recharge still requires admin approval.')}</figcaption></figure> : null}
        <p className="mb-2 text-sm text-muted">{label('المستلم وطريقة التحويل', 'Recipient and transfer instructions')}</p>
        <div className="space-y-3 text-base leading-7">{instructions.map((text, index) => <p key={index} className={index === 0 ? 'font-semibold text-ink' : 'text-muted'}>{text}</p>)}</div>
      </div>
    </div>
  </Card>;
}
