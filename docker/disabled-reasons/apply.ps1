$ErrorActionPreference = 'Stop'
$roots = @('client/src', 'docker/disabled-reasons/preview-src')
function Pair([string]$ar, [string]$en) {
  return '{ ar: ' + (ConvertTo-Json $ar -Compress) + ', en: ' + (ConvertTo-Json $en -Compress) + ' }'
}
function AddReason([string]$path, [string]$condition, [string]$reason) {
  foreach ($root in $roots) {
    $file = Join-Path $root $path
    if (!(Test-Path -LiteralPath $file)) { continue }
    $source = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $file))
    $before = 'disabled={' + $condition + '}'
    if ($source.Contains($before + ' disabledReason={')) { continue }
    if (!$source.Contains($before)) { throw "Missing condition in $file : $condition" }
    $after = $before + ' disabledReason={' + $reason + '}'
    $source = $source.Replace($before, $after)
    [IO.File]::WriteAllText((Resolve-Path -LiteralPath $file), $source)
  }
}
# Busy state takes precedence. Undefined uses Button's bilingual pending-request message.
AddReason 'features/wallet/pages/WalletPage.tsx' '!instructions?.length' ('instructionsError ? ' + (Pair 'تعذر تحميل طرق الشحن. أعد المحاولة من رسالة الخطأ.' 'Transfer methods could not load. Retry using the error message.') + ' : instructions === null ? ' + (Pair 'جارٍ تحميل طرق الشحن.' 'Loading transfer methods.') + ' : ' + (Pair 'لم تضف الإدارة طرق تحويل بعد. تواصل مع الدعم.' 'Transfer methods have not been configured. Contact support.'))
AddReason 'features/academic/PackagePage.tsx' 'busy || !review' ('busy ? undefined : ' + (Pair 'انتظر تحميل مراجعة الباقة قبل تأكيد الشراء.' 'Wait for the package review to load before confirming purchase.'))
AddReason 'features/academic/AdminPackagesPage.tsx' 'busy || eligible.length<3' ('busy ? undefined : ' + (Pair 'تحتاج الباقة إلى ٣ كورسات مؤهلة على الأقل. أضفها أولًا.' 'A package needs at least 3 eligible courses. Add them first.'))
AddReason 'features/catalog/components/OrderingControls.tsx' 'busy || upDisabled' ('busy ? undefined : ' + (Pair 'هذا أول عنصر؛ لا يمكن نقله لأعلى.' 'This is the first item; it cannot move up.'))
AddReason 'features/catalog/components/OrderingControls.tsx' 'busy || downDisabled' ('busy ? undefined : ' + (Pair 'هذا آخر عنصر؛ لا يمكن نقله لأسفل.' 'This is the last item; it cannot move down.'))
AddReason 'features/assessments/AdminSubmissionReview.tsx' 'cursors.length === 1' (Pair 'أنت في أول صفحة من الحلول.' 'You are on the first page of submissions.')
AddReason 'features/assessments/AdminSubmissionReview.tsx' '!page.nextCursor' (Pair 'لا توجد صفحة أخرى من الحلول.' 'There are no more pages of submissions.')
AddReason 'features/identity/pages/StudentDirectoryPage.tsx' 'cursors.length===1' (Pair 'أنت في أول صفحة من الطلاب.' 'You are on the first page of students.')
AddReason 'features/identity/pages/StudentDirectoryPage.tsx' '!data.nextCursor' (Pair 'لا توجد صفحة أخرى من الطلاب.' 'There are no more pages of students.')
AddReason 'features/wallet/pages/AdminRechargePage.tsx' "busy || dialogDone !== null || (decision==='APPROVE' && !verified)" ('busy ? undefined : dialogDone !== null ? ' + (Pair 'تمت معالجة هذا الطلب. أغلق النافذة للاطلاع على النتيجة.' 'This request has been processed. Close this dialog to view the result.') + ' : ' + (Pair 'تحقق من استلام التحويل وحدد مربع التأكيد قبل الموافقة.' 'Verify the transfer was received and check the confirmation box before approving.'))
AddReason 'features/assessments/ProgramSettings.tsx' 'value.samples.length === 1' (Pair 'يجب الاحتفاظ بمثال واحد على الأقل.' 'Keep at least one example.')
AddReason 'features/assessments/ProgramSettings.tsx' 'value.samples.length >= 3' (Pair 'الحد الأقصى ٣ أمثلة. عدّل مثالًا أو احذفه لإضافة آخر.' 'Maximum: 3 examples. Edit or remove one to add another.')
AddReason 'features/assessments/ProgramSettings.tsx' "status?.state === 'PENDING' || status?.state === 'RUNNING'" (Pair 'جارٍ تحضير الاختبارات. انتظر ظهور النتيجة.' 'Tests are being prepared. Wait for the result.')
AddReason 'features/assessments/ProgramSettings.tsx' "status?.state!=='READY' || !reviewed" ("status?.state !== 'READY' ? " + (Pair 'حضّر اختبارات المسودة الحالية أولًا.' 'Prepare tests for the current draft first.') + ' : ' + (Pair 'افتح مراجعة الاختبارات الخاصة قبل النشر.' 'Open the private-test review before publishing.'))
AddReason 'features/assessments/AdminAssessmentPanel.tsx' '(q.choices?.length ?? 0) >= 8' (Pair 'الحد الأقصى ٨ اختيارات للسؤال.' 'Maximum: 8 choices per question.')
AddReason 'features/assessments/AdminAssessmentPanel.tsx' 'busy || content.questions.length >= 10' ('busy ? undefined : ' + (Pair 'الحد الأقصى ١٠ أسئلة للتقييم.' 'Maximum: 10 questions per assessment.'))
AddReason 'features/assessments/AdminAssessmentPanel.tsx' '(c.args?.length ?? 0) >= 10' (Pair 'الحد الأقصى ١٠ مدخلات للدالة.' 'Maximum: 10 function inputs.')
AddReason 'features/assessments/AdminAssessmentPanel.tsx' 'checks.length>=20' (Pair 'الحد الأقصى ٢٠ اختبارًا للتقييم.' 'Maximum: 20 checks per assessment.')
AddReason 'features/assessments/AdminQuotaPage.tsx' 'busy || !limit.trim() || !Number.isSafeInteger(Number(limit)) || Number(limit)<0 || Number(limit)>2147483647' ('busy ? undefined : ' + (Pair 'أدخل عددًا صحيحًا من ٠ إلى ٢١٤٧٤٨٣٦٤٧ لحفظ الرصيد.' 'Enter a whole number from 0 to 2147483647 to save the allowance.'))
AddReason 'features/assessments/AssessmentPage.tsx' 'busy || !!checking' ('busy ? undefined : ' + (Pair 'يجري تصحيح الحل الحالي. انتظر النتيجة قبل إرسال حل آخر.' 'Your current submission is being graded. Wait for its result before submitting again.'))
AddReason 'features/catalog/pages/DeletionPanel.tsx' 'busy || confirmation !== expectedConfirmation' ('busy ? undefined : { ar: `اكتب نص التأكيد بالضبط: ${expectedConfirmation}`, en: `Type the confirmation exactly: ${expectedConfirmation}` }')
AddReason 'features/catalog/pages/LifecycleControls.tsx' 'busy || !next.enabled' ('busy ? undefined : ' + (Pair 'هذه الخطوة غير متاحة في حالة الكورس الحالية. حدّث حالة الكورس لمتابعة الخطوات بالترتيب.' 'This step is unavailable in the current course state. Refresh the course status to follow the steps in order.'))
foreach ($direction in @('previous', 'next')) {
  $lesson = $direction + 'Lesson'
  $edge = if ($direction -eq 'previous') { Pair 'أنت في أول درس؛ لا يوجد درس سابق.' 'You are at the first lesson; there is no previous lesson.' } else { Pair 'أنت في آخر درس؛ لا يوجد درس تالٍ.' 'You are at the last lesson; there is no next lesson.' }
  $reason = 'playback.requesting ? undefined : !' + $lesson + ' ? ' + $edge + ' : ' + $lesson + '.locked ? ' + (Pair 'اجتز التقييمات المطلوبة لفتح هذا الدرس.' 'Pass the required assessments to unlock this lesson.') + ' : ' + (Pair 'فيديو هذا الدرس غير متاح حاليًا.' 'This lessons video is currently unavailable.')
  AddReason 'features/learning/pages/CourseLearningPage.tsx' ('!' + $lesson + '?.playable || playback.requesting') $reason
}
AddReason 'features/learning/sessions/OwnSessionRecovery.tsx' '!selected || ending' ('ending ? undefined : ' + (Pair 'اختر جلسة من القائمة لإنهائها.' 'Choose a session from the list to end it.'))
AddReason 'features/learning/player/Player.tsx' "state.phase === 'expired' || state.phase === 'error'" ("state.phase === 'expired' ? " + (Pair 'انتهت صلاحية جلسة المشاهدة. أعد بدء الدرس إن كان اشتراكك ساريًا.' 'This playback session expired. Start the lesson again if your subscription is active.') + ' : ' + (Pair 'توقف التشغيل بسبب خطأ. راجع رسالة الخطأ وأعد المحاولة.' 'Playback stopped after an error. Review the error message and retry.'))

foreach ($root in $roots) {
  $notificationFile = Join-Path $root 'features/notifications/pages/NotificationsPage.tsx'
  $source = [IO.File]::ReadAllText((Resolve-Path $notificationFile))
  $anchor = 'onClick={() => void store.readAll()}'
  if (!$source.Contains('There are no unread notifications.')) {
    $source = $source.Replace($anchor, 'disabledReason={busy || state.loading || !state.loaded ? undefined : ' + (Pair 'لا توجد إشعارات غير مقروءة.' 'There are no unread notifications.') + "}`n                      " + $anchor)
  }
  [IO.File]::WriteAllText((Resolve-Path $notificationFile), $source)

  # Native custom buttons receive the same visible, accessible explanations.
  foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -Filter '*.tsx') {
    if ($file.Name -eq 'Button.tsx') { continue }
    $source = [IO.File]::ReadAllText($file.FullName)
    $updated = [regex]::Replace($source, '(?s)<button\b(?:(?!</button>).)*</button>', {
      param($match)
      if ($match.Value -notmatch '\bdisabled=') { return $match.Value }
      # Curriculum rows already contain specific locked/unavailable reasons.
      if ($match.Value.Contains('data-testid="lesson-row"')) { return $match.Value }
      return $match.Value.Replace('<button', '<Button unstyled').Replace('</button>', '</Button>')
    })
    if ($updated -ne $source) {
      if ($updated -notmatch 'import \{ Button \}') {
        $buttonFile = Join-Path (Resolve-Path $root) 'components/ui/Button'
        $relative = [IO.Path]::GetRelativePath($file.DirectoryName, $buttonFile).Replace('\', '/')
        if (!$relative.StartsWith('.')) { $relative = './' + $relative }
        $updated = "import { Button } from '$relative';`n" + $updated
      }
      [IO.File]::WriteAllText($file.FullName, $updated)
    }
  }
  $learning = Join-Path $root 'features/learning/components/Learning.tsx'
  $source = [IO.File]::ReadAllText((Resolve-Path $learning))
  $source = $source.Replace("{lesson.locked ? lang === 'ar'", "{disabled ? lang === 'ar' ? 'انتظر اكتمال طلب المشاهدة.' : 'Wait for the playback request to finish.' : lesson.locked ? lang === 'ar'")
  # aria-describedby points to the existing visible status; no duplicate message.
  if (!$source.Contains('aria-describedby={`lesson-status-')) {
    $source = $source.Replace('disabled={disabled === true || !lesson.playable}', 'disabled={disabled === true || !lesson.playable} aria-describedby={`lesson-status-${lesson.lessonId}`}')
  }
  $source = $source.Replace('<span className="mt-1 block text-xs text-muted">', '<span id={`lesson-status-${lesson.lessonId}`} className="mt-1 block text-xs text-muted">')
  [IO.File]::WriteAllText((Resolve-Path $learning), $source)
  $typed = Join-Path $root 'features/assessments/TypedValueEditor.tsx'
  $source = [IO.File]::ReadAllText((Resolve-Path $typed))
  if (!$source.Contains('Objects and arrays are unavailable for console text comparison.')) {
    $source = $source.Replace("{type === 'string' ?", "{consoleOutput ? <p className=`"text-xs text-muted`">{label('الكائنات والقوائم غير متاحة لمقارنة المخرجات النصية. اختر اختبار ناتج دالة للمقارنة المنظمة.', 'Objects and arrays are unavailable for console text comparison. Choose a function-return check for structured values.')}</p> : null}`n    {type === 'string' ?")
  }
  [IO.File]::WriteAllText((Resolve-Path $typed), $source)
}
# Explicit fieldset explanation, since a fieldset disables its submit implicitly.
foreach ($root in $roots) {
  $file = Join-Path $root 'features/wallet/pages/RechargePage.tsx'
  $source = [IO.File]::ReadAllText((Resolve-Path $file))
  $source = $source.Replace('<Button type="submit" disabled={busy}>', '<Button type="submit" disabled={busy || !channelOptions.length} disabledReason={busy ? undefined : ' + (Pair 'لا توجد طريقة تحويل متاحة. تواصل مع الدعم قبل إرسال طلب شحن.' 'No transfer method is available. Contact support before sending a recharge request.') + '}>')
  [IO.File]::WriteAllText((Resolve-Path $file), $source)
}
# Only the shared component and completed IDE files overlay the retained base.
foreach ($path in @('components/ui/Button.tsx', 'features/ide/WebIDE.tsx', 'features/ide/PracticePage.tsx', 'features/ide/ide.css')) {
  Copy-Item -LiteralPath (Join-Path 'client/src' $path) -Destination (Join-Path 'docker/disabled-reasons/preview-src' $path) -Force
}
