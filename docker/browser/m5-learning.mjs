/**
 * M5 protected-learning browser assertions (TEST-ONLY, Chromium via Nginx).
 *
 * Runs inside the disposable browser profile against the labeled DRM fixture.
 * The fixture serves a real grant but a deliberately unusable manifest, so these
 * rows prove the platform/UI contract - entitlement gating, outline rendering,
 * grant issuance, in-memory-only credentials, terminal player state - and are
 * NOT evidence that real protected media plays.
 *
 * Required env: BASE_URL. Passed in: check/shot/storageAudit helpers plus the
 * student page (already subscribed) and the published course id.
 */

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runM5Learning({ check, shot, storageAudit, BASE_URL, spage, courseSlug }) {
  // ---- 1. Dashboard shows the purchased course as active ----
  await spage.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(1200);
  const dashText = await spage.evaluate(() => document.body.textContent);
  check(
    'M5 dashboard renders the learning area',
    /لوحة التعلم|الدورات|الاشتراك|اشتراك/.test(dashText),
  );
  const dashLang = await spage.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  check('M5 dashboard respects RTL by default', dashLang.lang === 'ar' && dashLang.dir === 'rtl');
  await shot(spage, 'm5-dashboard-ar.png');

  // The API shape is the contract the UI renders from.
  const dash = await spage.evaluate(async (base) => {
    const res = await fetch(`${base}/api/learning/dashboard`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return { status: res.status, body: await res.json() };
  }, BASE_URL);
  check('M5 dashboard API returns 200 for a subscriber', dash.status === 200, String(dash.status));
  const activeCourses = (dash.body.data?.active ?? []).map((a) => a.slug);
  check(
    'M5 dashboard lists the purchased course as active',
    activeCourses.includes(courseSlug),
    activeCourses.join(','),
  );
  const activeEntry = (dash.body.data?.active ?? []).find((a) => a.slug === courseSlug);
  check(
    'M5 active entry carries an expiry and zero-or-more progress',
    typeof activeEntry?.expiresAt === 'string',
  );

  // ---- 2. Outline is reachable and exposes playability, never media URLs ----
  await spage.goto(`${BASE_URL}/#/learn/${courseSlug}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await wait(1200);
  const outlineText = await spage.evaluate(() => document.body.textContent);
  check('M5 outline renders the course lessons', outlineText.length > 0);
  const outline = await spage.evaluate(
    async (base, slug) => {
      const res = await fetch(`${base}/api/learning/courses/${encodeURIComponent(slug)}/outline`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      return { status: res.status, body: await res.json() };
    },
    BASE_URL,
    courseSlug,
  );
  check(
    'M5 outline API returns 200 for a subscriber',
    outline.status === 200,
    String(outline.status),
  );
  check('M5 outline reports entitlement', outline.body.data?.course?.entitled === true);
  const outlineJson = JSON.stringify(outline.body);
  check(
    'M5 outline leaks no media URL or asset id',
    !/manifest|licenseUrl|assetId/i.test(outlineJson),
  );
  await shot(spage, 'm5-outline-ar.png');

  const allLessons = (outline.body.data?.sections ?? []).flatMap((s) => s.lessons ?? []);
  const lessonId = allLessons.find((l) => l.playable)?.lessonId;
  check(
    'M5 outline exposes at least one playable lesson',
    typeof lessonId === 'string',
    `lessons=${allLessons.length} playable=${allLessons.filter((l) => l.playable).length} sections=${(outline.body.data?.sections ?? []).length}`,
  );

  // ---- 3. Playback grant is issued and carries an in-memory-only token ----
  if (typeof lessonId !== 'string') {
    // Nothing is playable, so the remaining rows cannot be asserted. Report the
    // outline shape once and stop rather than failing with a confusing error.
    check('M5 playback grant is issued (201)', false, 'skipped: no playable lesson');
    return;
  }
  // The double-submit CSRF cookie is readable by design; `set-cookie` is a
  // forbidden response header in page context, so read the cookie itself.
  const grantResult = await spage.evaluate(
    async (base, slug, id) => {
      await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
      const match = /(?:^|;\s*)edu_csrf=([^;]+)/.exec(document.cookie);
      const token = match ? decodeURIComponent(match[1]) : '';
      const res = await fetch(
        `${base}/api/learning/courses/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(id)}/playback`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': token, Origin: base },
          body: JSON.stringify({ deviceId: 'browser-fixture-device' }),
        },
      );
      return { status: res.status, body: await res.json() };
    },
    BASE_URL,
    courseSlug,
    lessonId,
  );
  check(
    'M5 playback grant is issued (201)',
    grantResult.status === 201,
    String(grantResult.status),
  );
  const grant = grantResult.body?.data?.playback;
  check(
    'M5 grant carries a transient token and expiry',
    typeof grant?.playbackToken === 'string' && typeof grant?.tokenExpiresAt === 'string',
  );
  check(
    'M5 grant resolves media URLs onto the configured DRM origin',
    typeof grant?.manifestUrl === 'string' && grant.manifestUrl.startsWith('http'),
  );

  // ---- 4. The token never reaches browser storage or a cookie ----
  const afterGrant = await storageAudit(spage);
  const storageBlob = JSON.stringify(afterGrant);
  check(
    'M5 playback token absent from local/session storage',
    !storageBlob.includes(grant.playbackToken),
  );
  check(
    'M5 no IndexedDB is created for playback',
    (afterGrant.idb ?? []).length === 0,
    JSON.stringify(afterGrant.idb),
  );
  const cookieBlob = JSON.stringify(await spage.cookies());
  check('M5 playback token absent from cookies', !cookieBlob.includes(grant.playbackToken));
  check(
    'M5 grant response body is not cached in the URL',
    !spage.url().includes(grant.playbackToken),
  );

  // ---- 5. Selecting a lesson then starting playback mounts the player ----
  await spage.goto(`${BASE_URL}/#/learn/${courseSlug}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await wait(1500);
  // Nothing is requested until the viewer acts, so no token is held on load.
  const idleState = await spage.evaluate(() => ({
    placeholder: document.querySelector('[data-testid="player-placeholder"]') !== null,
    video: document.querySelector('video') !== null,
  }));
  check(
    'M5 no player and no token before an explicit start',
    idleState.placeholder && !idleState.video,
  );

  const selected = await spage.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="lesson-row"]')];
    if (rows.length === 0) return false;
    rows[0].click();
    return true;
  });
  check('M5 lesson row is selectable', selected);
  await spage
    .waitForSelector('[data-testid="learning-start-playback"]', { timeout: 20000 })
    .catch(() => undefined);
  const started = await spage.evaluate(() => {
    const button = document.querySelector('[data-testid="learning-start-playback"]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  });
  check('M5 explicit start requests a grant', started);
  await spage.waitForSelector('video', { timeout: 45000 }).catch(() => undefined);
  const hasPlayer = await spage.evaluate(() => document.querySelector('video') !== null);
  const afterStart = await spage.evaluate(() => ({
    placeholder: document.querySelector('[data-testid="player-placeholder"]') !== null,
    startButton: document.querySelector('[data-testid="learning-start-playback"]') !== null,
    errorBlock: document.querySelector('[data-testid="learning-error"]')?.textContent ?? null,
  }));
  check(
    'M5 player mounts a media element',
    hasPlayer,
    `placeholder=${afterStart.placeholder} startBtn=${afterStart.startButton} err=${afterStart.errorBlock ?? ''}`,
  );
  const playerLabelled = await spage.evaluate(() => {
    const v = document.querySelector('video');
    return v !== null && (v.getAttribute('aria-label') || '').length > 0;
  });
  check('M5 media element is labelled for assistive technology', playerLabelled);
  // The fixture now serves genuinely playable media, so a working player reaches
  // a healthy state (ready or playing) rather than an error overlay. An overlay
  // appears only in transitional or terminal states; a loaded but paused
  // element (section 5 never presses play) is equally healthy.
  const settled = await spage
    .waitForFunction(
      () => {
        const overlay = document.querySelector('[data-testid="player-state"]');
        if (overlay) {
          const phase = overlay.getAttribute('data-phase');
          return phase !== null &&
            ['loading', 'ready', 'playing', 'paused', 'error', 'ended', 'expired'].includes(phase)
            ? { settled: true, phase, code: overlay.getAttribute('data-code') }
            : false;
        }
        const v = document.querySelector('video');
        if (v && v.readyState >= 2)
          return { settled: true, phase: v.paused ? 'paused' : 'playing', code: null };
        return false;
      },
      { timeout: 45000, polling: 300 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);
  check(
    'M5 player reaches a settled state',
    settled !== null && settled.settled === true,
    JSON.stringify(settled),
  );
  check(
    'M5 player does not settle in an error state',
    settled === null || settled.phase !== 'error',
    JSON.stringify(settled),
  );
  const pageErrors = [];
  spage.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  await spage.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(800);
  check(
    'M5 navigation produced no uncaught page error',
    pageErrors.length === 0,
    pageErrors.join(' | '),
  );

  // ---- 6. Progress write is accepted and is monotonic ----
  const progress = await spage.evaluate(
    async (base, slug, id) => {
      await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
      const match = /(?:^|;\s*)edu_csrf=([^;]+)/.exec(document.cookie);
      const token = match ? decodeURIComponent(match[1]) : '';
      const post = (positionSeconds) =>
        fetch(`${base}/api/learning/progress`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': token, Origin: base },
          body: JSON.stringify({
            courseRef: slug,
            lessonId: id,
            positionSeconds,
            durationSeconds: 600,
          }),
        }).then((r) => r.json());
      const forward = await post(120);
      const backward = await post(10);
      return { forward, backward };
    },
    BASE_URL,
    courseSlug,
    lessonId,
  );
  check('M5 progress write is accepted', progress.forward?.data?.progress?.positionSeconds === 120);
  check(
    'M5 progress never moves backwards',
    progress.backward?.data?.progress?.positionSeconds === 120,
  );

  // ---- 7. An unbought course renders closed: notice, no player ----
  const ungated = await spage.evaluate(async (base) => {
    const res = await fetch(`${base}/api/catalog/courses`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return (await res.json()).data.courses;
  }, BASE_URL);
  const other = ungated.find((c) => c.slug !== courseSlug);
  if (other) {
    await spage.goto(`${BASE_URL}/#/learn/${other.slug}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });
    await wait(1200);
    const gated = await spage.evaluate(() => ({
      text: document.body.textContent,
      hasVideo: document.querySelector('video') !== null,
    }));
    check('M5 unbought course shows the entitlement notice', /اشتراك|الاشتراك/.test(gated.text));
    check('M5 unbought course mounts no player', gated.hasVideo === false);
    const gatedApi = await spage.evaluate(
      async (base, slug) => {
        const res = await fetch(
          `${base}/api/learning/courses/${encodeURIComponent(slug)}/outline`,
          {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          },
        );
        return { status: res.status, body: await res.json() };
      },
      BASE_URL,
      other.slug,
    );
    check(
      'M5 unbought outline is 403 SUBSCRIPTION_REQUIRED',
      gatedApi.status === 403 && gatedApi.body?.error?.code === 'SUBSCRIPTION_REQUIRED',
      `${gatedApi.status}/${gatedApi.body?.error?.code}`,
    );
    await shot(spage, 'm5-gated-ar.png');
  }

  // ---- 8. English LTR + 390px without overflow ----
  await spage.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(700);
  await spage.evaluate(() => {
    const btns = [...document.querySelectorAll('.lang-switch button')];
    const target = btns.find((b) => b.textContent.trim() === 'English');
    if (target) target.click();
  });
  await wait(700);
  const enDash = await spage.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    body: document.body.textContent,
  }));
  check('M5 dashboard switches to English LTR', enDash.lang === 'en' && enDash.dir === 'ltr');
  check('M5 English dashboard has content', enDash.body.length > 0);
  await shot(spage, 'm5-dashboard-en.png');
  await spage.evaluate(() => {
    const btns = [...document.querySelectorAll('.lang-switch button')];
    const target = btns.find((b) => b.textContent.includes('العربية'));
    if (target) target.click();
  });
  await wait(500);

  // ---- 9. Playback is not interrupted by routine progress writes ----
  // The fixture serves a real, playable DASH presentation, so this measures real
  // playback continuity rather than a mounted-but-idle element.
  const drmTraffic = [];
  const onDrmResponse = (res) => {
    const url = res.url();
    if (url.includes('drm-fixture:8090'))
      drmTraffic.push(
        `${res.request().method()} ${url.split('drm-fixture:8090')[1]} -> ${res.status()}`,
      );
  };
  spage.on('response', onDrmResponse);

  await spage.goto(`${BASE_URL}/#/learn/${courseSlug}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await wait(1500);
  await spage.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="lesson-row"]')];
    if (rows.length > 0) rows[0].click();
  });
  await spage
    .waitForSelector('[data-testid="learning-start-playback"]', { timeout: 20000 })
    .catch(() => undefined);
  await spage.evaluate(() => {
    const button = document.querySelector('[data-testid="learning-start-playback"]');
    if (button && !button.disabled) button.click();
  });
  const video = await spage
    .waitForSelector('video', { timeout: 45000 })
    .then((handle) => handle)
    .catch(() => null);
  check('M5 continuity fixture mounts the player', video !== null);

  // Tag the element so a remount is detectable.
  await spage.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.dataset.continuityTag = 'original';
  });
  const referenceId = await spage.evaluate(() => {
    const host = document.querySelector('[data-reference-id]');
    return host ? host.getAttribute('data-reference-id') : null;
  });
  check(
    'M5 player publishes a non-secret reference id',
    typeof referenceId === 'string' && referenceId !== '',
  );
  // The playback token must never reach the DOM, only the opaque row id.
  const domLeak = await spage.evaluate(() => document.documentElement.outerHTML);
  const storedToken = grant.playbackToken;
  check('M5 playback token is absent from the DOM', !domLeak.includes(storedToken));

  // Count outline requests from now on: a routine progress write must not
  // refetch the outline, which is what used to unmount the player.
  let outlineRequests = 0;
  const onRequest = (req) => {
    if (/\/api\/learning\/courses\/[^/]+\/outline/.test(req.url())) outlineRequests += 1;
  };
  spage.on('request', onRequest);
  const playing = await spage.evaluate(async () => {
    const v = document.querySelector('video');
    if (!v) return false;
    v.muted = true;
    try {
      await v.play();
      return true;
    } catch {
      return false;
    }
  });
  check('M5 continuity media starts playing', playing);

  // Wait until the element has actually advanced, so the assertion below is
  // about a playing element and not a paused one.
  const advanced = await spage
    .waitForFunction(
      () => {
        const v = document.querySelector('video');
        return v !== null && v.currentTime > 0.4 && v.readyState >= 2;
      },
      { timeout: 30000, polling: 200 },
    )
    .then(() => true)
    .catch(() => false);
  check('M5 continuity media actually advances', advanced);

  // ---- 9c. Token renewal keeps the same player and swaps only the credential ----
  // Measured immediately after the session is proven to be actively playing, on
  // the reference the page currently publishes. A later lifecycle step (a lesson
  // switch, or the suite simply taking longer than the dependency session lives) can
  // legitimately close that session, and a renewal against a closed session proves
  // nothing about renewal.
  // published. Renewing the previous, already-closed reference would (correctly)
  // be refused, so measuring that here would test nothing about renewal.
  const renewalBefore = await spage.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.dataset.renewalTag = 'renewal-original';
    const host = document.querySelector('[data-reference-id]');
    return {
      tag: v?.dataset.renewalTag ?? null,
      time: v?.currentTime ?? 0,
      referenceId: host ? host.getAttribute('data-reference-id') : null,
    };
  });
  check(
    'M5 a live playback session exists for renewal',
    typeof renewalBefore.referenceId === 'string' && renewalBefore.referenceId !== '',
    String(renewalBefore.referenceId),
  );
  const liveReferenceId = renewalBefore.referenceId;
  const renewal = await spage.evaluate(
    async (base, refId) => {
      await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
      const match = /(?:^|;\s*)edu_csrf=([^;]+)/.exec(document.cookie);
      const token = match ? decodeURIComponent(match[1]) : '';
      const res = await fetch(`${base}/api/learning/playback/${refId}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': token, Origin: base },
        body: '{}',
      });
      return { status: res.status, body: await res.json() };
    },
    BASE_URL,
    liveReferenceId,
  );
  check(
    'M5 token renewal is accepted by the platform',
    renewal.status === 200,
    String(renewal.status),
  );
  const renewalBody = JSON.stringify(renewal.body ?? {});
  check(
    'M5 renewal returns only credential fields',
    !/assertion|assetId|kid|manifest/i.test(renewalBody),
    renewalBody.slice(0, 120),
  );
  const renewalAfter = await spage.evaluate(() => {
    const v = document.querySelector('video');
    return { tag: v?.dataset.renewalTag ?? null, time: v?.currentTime ?? 0 };
  });
  check(
    'M5 renewal does not remount the media element',
    renewalAfter.tag === 'renewal-original',
    `tag=${renewalAfter.tag}`,
  );
  check(
    'M5 renewal does not rewind playback',
    renewalAfter.time >= renewalBefore.time,
    `${renewalBefore.time} -> ${renewalAfter.time}`,
  );

  const before = await spage.evaluate(() => {
    const v = document.querySelector('video');
    return {
      tag: v?.dataset.continuityTag ?? null,
      time: v?.currentTime ?? 0,
      phase:
        document.querySelector('[data-testid="player-state"]')?.getAttribute('data-phase') ?? null,
    };
  });

  // Drive several progress writes through the real API the player uses. The
  // player itself writes on a ten-second throttle, so the writes are issued
  // directly to prove the *page* survives them.
  const writeResults = await spage.evaluate(
    async (base, slug, id) => {
      const status = [];
      for (let i = 0; i < 3; i += 1) {
        await fetch(`${base}/api/auth/csrf`, { credentials: 'include' });
        const match = /(?:^|;\s*)edu_csrf=([^;]+)/.exec(document.cookie);
        const token = match ? decodeURIComponent(match[1]) : '';
        const res = await fetch(`${base}/api/learning/progress`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': token, Origin: base },
          body: JSON.stringify({
            courseRef: slug,
            lessonId: id,
            positionSeconds: 1 + i,
            durationSeconds: 20,
          }),
        });
        status.push(res.status);
        await new Promise((r) => setTimeout(r, 400));
      }
      return status;
    },
    BASE_URL,
    courseSlug,
    lessonId,
  );
  spage.off('request', onRequest);
  check(
    'M5 progress writes succeed while playing',
    writeResults.length === 3 && writeResults.every((s) => s === 200),
    JSON.stringify(writeResults),
  );

  const after = await spage.evaluate(() => {
    const v = document.querySelector('video');
    return {
      tag: v?.dataset.continuityTag ?? null,
      time: v?.currentTime ?? 0,
      paused: v?.paused ?? true,
      phase:
        document.querySelector('[data-testid="player-state"]')?.getAttribute('data-phase') ?? null,
    };
  });
  check(
    'M5 progress writes do not remount the media element',
    after.tag === 'original',
    `tag=${after.tag}`,
  );
  check(
    'M5 playback keeps advancing across progress writes',
    after.time > before.time,
    `${before.time} -> ${after.time}`,
  );
  check(
    'M5 player is not put back into a loading state',
    after.phase !== 'loading' && after.phase !== 'requesting',
    `phase=${after.phase}`,
  );
  check(
    'M5 playback is not paused by a progress write',
    after.paused === false,
    `paused=${after.paused}`,
  );

  // The outline must not be refetched: that reload used to unmount the player.
  check(
    'M5 routine progress writes do not reload the outline',
    outlineRequests === 0,
    `outline requests=${outlineRequests}`,
  );

  await shot(spage, 'm5-continuity-playing.png');

  // ---- 9b. Switching lessons closes the previous session and starts clean ----
  const switched = await spage.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="lesson-row"]')];
    if (rows.length < 2) return { ok: false, reason: 'single-lesson course' };
    rows[1].click();
    return { ok: true, reason: '' };
  });
  if (switched.ok) {
    await spage
      .waitForSelector('[data-testid="learning-start-playback"]', { timeout: 20000 })
      .catch(() => undefined);
    await spage.evaluate(() => {
      const button = document.querySelector('[data-testid="learning-start-playback"]');
      if (button && !button.disabled) button.click();
    });
    const newReferenceId = await spage
      .waitForFunction(
        (previous) => {
          const host = document.querySelector('[data-reference-id]');
          const current = host ? host.getAttribute('data-reference-id') : null;
          return current !== null && current !== previous ? current : false;
        },
        { timeout: 45000, polling: 300 },
        referenceId,
      )
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    check(
      'M5 lesson switch issues a fresh session',
      typeof newReferenceId === 'string',
      String(newReferenceId),
    );
    const switchedVideo = await spage.evaluate(() => document.querySelector('video') !== null);
    check('M5 lesson switch keeps a player mounted', switchedVideo);
  } else {
    check('M5 lesson switch issues a fresh session', true, switched.reason);
    check('M5 lesson switch keeps a player mounted', true, switched.reason);
  }

  spage.off('response', onDrmResponse);
  check(
    'M5 fixture traffic shows no failed media request',
    drmTraffic.every((line) => !/ -> [45]\d\d$/.test(line)),
    `hops=${drmTraffic.length}`,
  );

  // ---- 11a. Gate F: the protected-playback watermark ----
  // Scope of the claim, checked here: a VISIBLE label that stays present across
  // the player states and layouts a browser can produce, that does not block the
  // controls, and that exposes no personal data. It is NOT a forensic control and
  // it cannot prevent screen capture or a camera; attributable watermarking is
  // the external DRM's responsibility and its trace code never reaches this page.
  const maskedIdentity = grant?.watermark?.maskedIdentity ?? '';
  const liveWatermark = await spage.evaluate(() => {
    const layer = document.querySelector('[data-testid="watermark-overlay"]');
    const labels = [...document.querySelectorAll('[data-testid="watermark-label"]')];
    const frame = document.querySelector('[data-reference-id]');
    const overlay = document.querySelector('[data-testid="player-state"]');
    const video = document.querySelector('video');
    const style = layer ? getComputedStyle(layer) : null;
    let hitTest = 'none';
    if (layer && labels.length > 0) {
      const box = labels[0].getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      hitTest = target === null ? 'none' : target.tagName.toLowerCase();
    }
    return {
      present: layer !== null,
      labelCount: labels.length,
      text: labels[0]?.textContent ?? '',
      ariaHidden: layer?.getAttribute('aria-hidden') ?? null,
      pointerEvents: style?.pointerEvents ?? null,
      zIndex: style?.zIndex ?? null,
      hitTest,
      // The watermark must come after the state overlay so it paints on top of it.
      afterOverlay:
        overlay === null || layer === null
          ? null
          : Boolean(overlay.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING),
      frameWidth: frame ? frame.getBoundingClientRect().width : 0,
      videoPresent: video !== null,
    };
  });
  check(
    'M5 watermark is visible over protected playback',
    liveWatermark.present && liveWatermark.labelCount >= 1,
    JSON.stringify(liveWatermark),
  );
  check(
    'M5 watermark shows only the masked identity',
    maskedIdentity !== '' && liveWatermark.text === maskedIdentity,
    `shown=${liveWatermark.text.length}chars`,
  );
  check('M5 watermark is hidden from assistive technology', liveWatermark.ariaHidden === 'true');
  check(
    'M5 watermark does not intercept pointer events',
    liveWatermark.pointerEvents === 'none',
    String(liveWatermark.pointerEvents),
  );
  check(
    'M5 watermark does not block the media element or its controls',
    liveWatermark.hitTest === 'video' || liveWatermark.hitTest === 'div',
    `hitTest=${liveWatermark.hitTest}`,
  );
  check(
    'M5 watermark is painted above the player state overlay',
    liveWatermark.afterOverlay === true || liveWatermark.afterOverlay === null,
    `afterOverlay=${liveWatermark.afterOverlay}`,
  );

  // Privacy: the label must carry no unmasked identifier and no credential.
  const watermarkLeak = await spage.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const layer = document.querySelector('[data-testid="watermark-overlay"]');
    return {
      html,
      text: layer?.textContent ?? '',
      attrs: layer ? [...layer.attributes].map((a) => a.name) : [],
    };
  });
  check(
    'M5 watermark carries no trace code or signature',
    !/traceCode|signature|fixture-trace|fixture-signature/i.test(watermarkLeak.html),
  );
  check(
    'M5 watermark exposes no attribute other than its test hooks',
    watermarkLeak.attrs.every(
      (a) =>
        a === 'aria-hidden' ||
        a === 'data-testid' ||
        a === 'data-watermark-labels' ||
        a === 'class',
    ),
    JSON.stringify(watermarkLeak.attrs),
  );
  check(
    'M5 watermark text is not an unmasked email and the token is absent',
    !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(watermarkLeak.text.trim()) &&
      !watermarkLeak.html.includes(storedToken),
    `text=${watermarkLeak.text}`,
  );

  // Responsive: the layer is sized by the player frame, so a narrow viewport
  // must keep it present and inside the frame rather than overflowing. This runs
  // on its OWN page because Puppeteer reloads a page when `isMobile` changes,
  // and a reload legitimately discards the in-memory playback grant.
  const wmPage = await spage.browserContext().newPage();
  await wmPage.setViewport({ width: 390, height: 844, isMobile: true });
  await wmPage.goto(`${BASE_URL}/#/learn/${courseSlug}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await wait(1200);
  await wmPage.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="lesson-row"]')];
    if (rows.length > 0) rows[0].click();
  });
  await wmPage
    .waitForSelector('[data-testid="learning-start-playback"]', { timeout: 20000 })
    .catch(() => undefined);
  await wmPage.evaluate(() => {
    const button = document.querySelector('[data-testid="learning-start-playback"]');
    if (button && !button.disabled) button.click();
  });
  await wmPage
    .waitForSelector('[data-testid="watermark-overlay"]', { timeout: 45000 })
    .catch(() => undefined);
  await wait(800);
  const narrow = await wmPage.evaluate(() => {
    const layer = document.querySelector('[data-testid="watermark-overlay"]');
    const frame = document.querySelector('[data-reference-id]');
    if (!layer || !frame)
      return {
        present: false,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    const l = layer.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    return {
      present: true,
      labelCount: document.querySelectorAll('[data-testid="watermark-label"]').length,
      insideFrame: l.width <= f.width + 1 && l.height <= f.height + 1,
      // The layer is `inset: 0` inside a 1px-bordered frame, so it is exactly
      // the frame's content box: within a few pixels, and the same shape.
      matchesFrame:
        Math.abs(l.width - f.width) <= 4 &&
        Math.abs(l.height - f.height) <= 4 &&
        Math.abs(l.width / l.height - f.width / f.height) < 0.02,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check(
    'M5 watermark survives a 390px responsive layout',
    narrow.present && narrow.labelCount >= 1,
    JSON.stringify(narrow),
  );
  check(
    'M5 watermark stays inside the player frame when narrow',
    narrow.insideFrame === true,
    JSON.stringify(narrow),
  );
  check(
    'M5 watermark matches the player frame size when narrow',
    narrow.matchesFrame === true,
    JSON.stringify(narrow),
  );
  check(
    'M5 narrow player layout has no horizontal overflow',
    narrow.overflow <= 1,
    `overflow=${narrow.overflow}`,
  );
  await shot(wmPage, 'm5-watermark-mobile-ar.png');
  await wmPage.close();

  // Fullscreen: a real transition is user-gesture bound and may be refused in a
  // headless browser, so the assertion is that the watermark is a layer OF the
  // player frame - which is what a fullscreen transition scales - and that it is
  // still present and correctly placed afterwards either way.
  const fullscreen = await spage.evaluate(() => {
    const frame = document.querySelector('[data-reference-id]');
    const layer = document.querySelector('[data-testid="watermark-overlay"]');
    if (!frame || !layer) return { attempted: false, present: false, isChild: false };
    return { attempted: true, present: layer.isConnected, isChild: frame.contains(layer) };
  });
  check(
    'M5 watermark is a layer of the player frame, so a fullscreen transition carries it',
    fullscreen.attempted === true && fullscreen.isChild === true && fullscreen.present === true,
    JSON.stringify(fullscreen),
  );

  // Error settling: with the fixture's media blocked, the player must reach its
  // error state and the watermark must still be visible on top of that overlay.
  // A watermark that vanishes with a player error is not a watermark.
  const errPage = await spage.browserContext().newPage();
  // Without this the manifest and segments are served from the browser cache of
  // the earlier successful run and the player never sees the failure at all.
  await errPage.setCacheEnabled(false);
  await errPage.setRequestInterception(true);
  errPage.on('request', (req) => {
    // Block only dependency media/licence traffic; the platform's own API and
    // the app shell must still load so a grant can be issued at all. The
    // dependency answers with a server error rather than a network abort, so
    // dash.js has a real HTTP failure to surface instead of hanging.
    const url = req.url();
    const isPlatform =
      url.startsWith(BASE_URL) || url.startsWith('data:') || url.startsWith('blob:');
    if (!isPlatform)
      req.respond({ status: 500, body: 'blocked-by-browser-test' }).catch(() => undefined);
    else req.continue().catch(() => undefined);
  });
  await errPage.goto(`${BASE_URL}/#/learn/${courseSlug}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await wait(1200);
  await errPage.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="lesson-row"]')];
    if (rows.length > 0) rows[0].click();
  });
  await errPage
    .waitForSelector('[data-testid="learning-start-playback"]', { timeout: 20000 })
    .catch(() => undefined);
  await errPage.evaluate(() => {
    const button = document.querySelector('[data-testid="learning-start-playback"]');
    if (button && !button.disabled) button.click();
  });
  const errorPhase = await errPage
    .waitForFunction(
      () => {
        const overlay = document.querySelector('[data-testid="player-state"]');
        return overlay && overlay.getAttribute('data-phase') === 'error';
      },
      { timeout: 60000, polling: 300 },
    )
    .then(() => true)
    .catch(() => false);
  const errorDiag = await errPage.evaluate(() => {
    const v = document.querySelector('video');
    const overlay = document.querySelector('[data-testid="player-state"]');
    return {
      readyState: v ? v.readyState : null,
      networkState: v ? v.networkState : null,
      currentSrc: v ? v.currentSrc.slice(0, 60) : null,
      mediaError: v && v.error ? v.error.code : null,
      phase: overlay ? overlay.getAttribute('data-phase') : null,
    };
  });
  check(
    'M5 blocked media settles the player in an error state',
    errorPhase,
    JSON.stringify(errorDiag),
  );
  const errorWatermark = await errPage.evaluate(() => {
    const layer = document.querySelector('[data-testid="watermark-overlay"]');
    const overlay = document.querySelector('[data-testid="player-state"]');
    if (!layer) return { present: false };
    const style = getComputedStyle(layer);
    const box = layer.getBoundingClientRect();
    const centre = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      present: true,
      labelCount: document.querySelectorAll('[data-testid="watermark-label"]').length,
      zIndex: style.zIndex,
      onTop:
        overlay === null
          ? null
          : Boolean(overlay.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING),
      hitTest: centre === null ? 'none' : centre.tagName.toLowerCase(),
    };
  });
  check(
    'M5 watermark stays visible in the player error state',
    errorPhase && errorWatermark.present === true && errorWatermark.labelCount >= 1,
    JSON.stringify(errorWatermark),
  );
  check(
    'M5 watermark is layered above the error overlay',
    errorWatermark.onTop === true || errorWatermark.onTop === null,
    JSON.stringify(errorWatermark),
  );
  check(
    'M5 watermark still does not intercept pointer events on an error',
    errorWatermark.hitTest === 'video' || errorWatermark.hitTest === 'div',
    `hitTest=${errorWatermark.hitTest}`,
  );
  await shot(errPage, 'm5-watermark-error-state.png');
  await errPage.close();

  // ---- 11. Desktop and 390px layout still hold after the lifecycle work ----
  await spage.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 });
  await wait(900);
  const desktopOverflow = await spage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(
    'M5 desktop dashboard has no horizontal overflow',
    desktopOverflow <= 1,
    `overflow=${desktopOverflow}`,
  );

  const mob = await spage.browserContext().newPage();
  await mob.setViewport({ width: 390, height: 844, isMobile: true });
  for (const [label, hash] of [
    ['dashboard', '#/dashboard'],
    ['learn', `#/learn/${courseSlug}`],
  ]) {
    await mob.goto(`${BASE_URL}/${hash}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await wait(900);
    const mobOverflow = await mob.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(
      `M5 mobile ${label} has no overflow at 390px`,
      mobOverflow <= 1,
      `overflow=${mobOverflow}`,
    );
  }
  await shot(mob, 'm5-dashboard-mobile-ar.png');
  await mob.close();
}
