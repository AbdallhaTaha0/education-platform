import fs from 'node:fs';
import { PlatformClient } from './lib/platform.mjs';
const accounts = JSON.parse(fs.readFileSync('/accounts/fixtures.json'));
const statePath = '/video/course.json';
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath))
  : { slug: 'fayq-owner-real-video-test' };
function save() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
function check(label, r, expected) {
  if (r.status !== expected)
    throw new Error(`${label}: status=${r.status}, category=${r.json?.error?.code ?? 'unknown'}`);
  console.log(`PASS ${label} (${r.status})`);
  return r.json.data;
}
const admin = new PlatformClient({
  baseUrl: 'http://host.docker.internal:8080',
  origin: 'http://localhost:8080',
});
const a = accounts.users.find((u) => u.role === 'ADMIN');
check('admin login', await admin.login(a.email, a.password), 200);
try {
  if (process.argv[2] === 'setup') {
    if (!state.courseId) {
      const d = check(
        'create real-video test course',
        await admin.createCourse({
          slug: state.slug,
          titleAr: 'تجربة فيديو حقيقي — من الفكرة إلى الموقع',
          titleEn: 'Real video test — From an idea to a website',
          descriptionAr:
            'فيديو قدمه المالك لاختبار الرفع والتشغيل. محتوى تجريبي وليس كورسًا دراسيًا.',
          descriptionEn:
            'Owner-provided video for upload and playback testing. Demonstration content, not an academic course.',
          academic: {
            grade: 'FIRST_SECONDARY',
            academicYear: '2026/2027',
            term: 1,
            courseKind: 'REVISION',
            teachingMonth: null,
          },
        }),
        201,
      );
      state.courseId = d.course.id;
      save();
    }
    if (!state.sectionId) {
      state.sectionId = check(
        'create section',
        await admin.createSection(state.courseId, {
          titleAr: 'تجربة الرفع والمشاهدة',
          titleEn: 'Upload and playback demonstration',
          position: 1,
        }),
        201,
      ).section.id;
      save();
    }
    if (!state.lessonId) {
      state.lessonId = check(
        'create lesson',
        await admin.createLesson(state.sectionId, {
          titleAr: 'من فكرة على ورق إلى موقع شغال',
          titleEn: 'From an idea on paper to a working website',
          position: 1,
        }),
        201,
      ).lesson.id;
      save();
    }
    if (!state.planId) {
      state.planId = check(
        'create test plan',
        await admin.createPlan(state.courseId, {
          currentPricePiastres: 100,
          accessMode: 'UNTIL_REMOVAL',
          durationDays: null,
          accessEndsAt: null,
        }),
        201,
      ).plan.id;
      save();
    }
  } else if (process.argv[2] === 'finish') {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const result = await admin.syncLessonMedia(state.lessonId);
      check('media status sync', result, 200);
      const status = result.json.data.mapping.status;
      console.log(`MEDIA_STATE ${status}`);
      if (status === 'READY') {
        ready = true;
        break;
      }
      if (status === 'FAILED') throw new Error('External processing failed');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!ready) throw new Error('Video processing did not finish in the bounded wait');
    let course = check('course state', await admin.readCourse(state.courseId), 200).course;
    for (const next of ['PROCESSING', 'READY', 'PUBLISHED']) {
      const order = ['DRAFT', 'PROCESSING', 'READY', 'PUBLISHED'];
      if (order.indexOf(course.status) < order.indexOf(next)) {
        check(`publish gate ${next}`, await admin.transitionCourse(state.courseId, next), 200);
        course = check('course state', await admin.readCourse(state.courseId), 200).course;
      }
    }
    const s = accounts.users.find((u) => u.role === 'STUDENT');
    const student = new PlatformClient(admin.config);
    check('student login', await student.login(s.email, s.password), 200);
    const bought = await student.purchase({
      planId: state.planId,
      idempotencyKey: 'owner-real-video-test-purchase',
    });
    if (![200, 201].includes(bought.status)) check('test purchase', bought, 201);
    else console.log('PASS test purchase');
    check('protected lesson outline', await student.outline(state.slug), 200);
    await student.logout();
    state.ready = true;
    save();
    console.log('REAL_VIDEO_READY: retained owner course published; student has access.');
  } else throw new Error('Expected setup or finish');
} finally {
  await admin.logout();
}
