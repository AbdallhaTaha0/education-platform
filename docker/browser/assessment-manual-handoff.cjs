const puppeteer = require("puppeteer-core"),
  assert = require("node:assert/strict");
async function continueWhenStable(page) {
  let last = null,
    stable = 0;
  for (let n = 0; n < 20; n++) {
    const target = await page.$eval(
      "[data-testid=assessment-continue]",
      (e) => {
        const r = e.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        return { x: r.x, y: r.y, clickable: hit === e || e.contains(hit) };
      },
    );
    stable =
      last && Math.abs(last.y - target.y) < 1 && target.clickable
        ? stable + 1
        : 0;
    if (stable >= 2) {
      await page.click("[data-testid=assessment-continue]");
      return;
    }
    last = target;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Continue button never became stable and clickable");
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--host-resolver-rules=MAP localhost ${process.env.PREVIEW_HOST_IP || "172.18.0.6"}`,
    ],
  });
  try {
    for (const lang of ["ar", "en"])
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 1920, height: 1080 },
        { width: 390, height: 844 },
        { width: 360, height: 800 },
      ])
        for (const scenario of ["manual", "continue", "incorrect", "leave", "persisted-required", "persisted-optional"]) {
          const persisted = scenario.startsWith("persisted-");
          console.log(
            JSON.stringify({ lang, viewport, scenario, result: "START" }),
          );
          const page = await browser.newPage();
          await page.setViewport(viewport);
          let submits = 0;
          try {
            await page.setRequestInterception(true);
            page.on("request", (req) => {
              const p = new URL(req.url()).pathname,
                reply = (body, status = 200, headers = {}) =>
                  req.respond({
                    status,
                    headers,
                    contentType: "application/json",
                    body: JSON.stringify(body),
                  });
              if (p.includes("socket.io")) return req.abort();
              if (!p.startsWith("/api/")) return req.continue();
              if (p === "/api/auth/me")
                return reply({
                  data: {
                    user: {
                      id: "fixture-student",
                      role: "STUDENT",
                      displayName: "Fixture",
                      email: "fixture@example.test",
                      phone: "+201000000000",
                      createdAt: "2026-10-01",
                    },
                  },
                });
              if (p === "/api/auth/csrf")
                return reply({ data: {} }, 200, {
                  "set-cookie": "edu_csrf=fixture; Path=/",
                });
              if (p.includes("features"))
                return reply({ data: { codingIdeEnabled: false } });
              if (p.includes("notifications"))
                return reply({
                  data: {
                    items: [],
                    nextCursor: null,
                    unreadCount: 0,
                    revision: "0",
                    throughSequence: "0",
                  },
                });
              if (p === "/api/assessments/fixture-assessment")
                return reply({
                  data: {
                    id: "fixture-assessment",
                    version: 1,
                    lessonId: "fixture-lesson",
                    courseId: "fixture-course",
                    required: scenario !== "persisted-optional",
                    passed: persisted,
                    draft: persisted ? { revision: 2, content: [{ questionId: "q1", choiceId: "a" }] } : null,
                    content: {
                      titleAr: "اختبار الدرس",
                      titleEn: "Lesson quiz",
                      instructionsAr: "اختر الإجابة الصحيحة",
                      instructionsEn: "Choose the correct answer",
                      questions: [
                        {
                          id: "q1",
                          type: "CHOICE",
                          titleAr: "ما ناتج 1 + 1؟",
                          titleEn: "What is 1 + 1?",
                          choices: [
                            { id: "a", textAr: "2", textEn: "2" },
                            { id: "b", textAr: "3", textEn: "3" },
                          ],
                        },
                      ],
                    },
                  },
                });
              if (p.endsWith("/history"))
                return reply({
                  data: {
                    submissions: persisted ? [
                      { id: "previous-correct", state: "CORRECT", createdAt: "2026-10-09T10:00:00Z" },
                      { id: "previous-wrong", state: "INCORRECT", createdAt: "2026-10-09T09:00:00Z" },
                    ] : [],
                    pagination: { page: 1, pageSize: 10, total: persisted ? 2 : 0 },
                  },
                });
              if (p.endsWith("/draft")) return reply({ data: { revision: 1 } });
              if (p.endsWith("/submit")) {
                submits++;
                return reply({ data: { id: "submission-fixture" } });
              }
              if (p === "/api/assessments/submissions/submission-fixture")
                return reply({
                  data: {
                    id: "submission-fixture",
                    state: scenario === "incorrect" ? "INCORRECT" : "CORRECT",
                    result: {
                      questions: [
                        {
                          questionId: "q1",
                          correct: scenario !== "incorrect",
                          checksPassed: scenario === "incorrect" ? 0 : 1,
                          checksTotal: 1,
                        },
                      ],
                    },
                  },
                });
              return reply({ error: { code: "NOT_FOUND" } }, 404);
            });
            await page.goto(
              "http://localhost:8080/" +
                lang +
                "#/assessment/fixture-assessment",
              { waitUntil: "domcontentloaded" },
            );
            await page.waitForSelector("input[value=a]");
            assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), viewport);
            if (persisted) {
              const verifySavedPass = async (currentLang) => {
                await page.waitForSelector("[data-testid=assessment-continue]");
                assert.equal(await page.$eval("input[value=a]", e => e.checked), true);
                const text = await page.$eval("[data-testid=assessment-result]", e => e.innerText);
                assert(text.includes(currentLang === "ar" ? "اجتزت هذا التقييم سابقًا" : "previously passed"));
                assert(!text.includes("1/1"));
                assert(!text.includes(currentLang === "ar" ? "أحسنت!" : "Well done!"));
                assert.equal(await page.evaluate(() => document.activeElement.dataset.testid), "assessment-result");
                assert.equal(await page.$eval("[data-testid=assessment-submit]", e => e.disabled), false);
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                assert.equal(submits, 0);
              };
              await verifySavedPass(lang);
              await page.reload({ waitUntil: "domcontentloaded" });
              await verifySavedPass(lang);
              // Use the actual header language control; the fixtures only provide API data.
              const nextLang = lang === "ar" ? "en" : "ar";
              const switcher = await page.$('.language-tool[lang="' + nextLang + '"]');
              assert(switcher, "Header language switch must exist");
              // Result focus uses smooth scrolling; keyboard activation cannot hit a moving dock.
              await switcher.focus();
              await page.keyboard.press("Enter");
              await page.waitForFunction(expected => location.pathname === "/" + expected, {}, nextLang);
              await verifySavedPass(nextLang);
              const historyToggle = await page.$("details summary");
              await historyToggle.focus();
              await page.keyboard.press("Enter");
              await page.waitForFunction(() => document.querySelector("details").open);
              assert.equal(await page.$$eval("details li", items => items.length), 2);
              const continueButton = await page.$("[data-testid=assessment-continue]");
              await continueButton.focus();
              await page.screenshot({ path: `/evidence/assessment-${scenario}-${lang}-${viewport.width}.png` });
              await page.keyboard.press("Enter");
              await page.waitForFunction(() => location.hash.startsWith("#/learn/"));
              assert(page.url().endsWith("#/learn/fixture-course?lesson=fixture-lesson&resume=1"));
              assert.equal(submits, 0);
              console.log(JSON.stringify({ lang, viewport, scenario, result: "PASS", evidence: "mocked UI only" }));
              continue;
            }
            await page.click("input[value=a]");
            await page.click("[data-testid=assessment-submit]");
            await page.waitForSelector("[data-testid=assessment-result]");
            const start = Date.now();
            if (scenario === "incorrect") {
              await new Promise((r) => setTimeout(r, 3300));
              assert(page.url().includes("#/assessment/"));
              assert.equal(
                await page.$("[data-testid=assessment-continue]"),
                null,
              );
              assert.equal(
                await page.$eval(
                  "[data-testid=assessment-submit]",
                  (b) => b.disabled,
                ),
                false,
              );
            } else {
              assert.equal(
                await page.$eval(
                  "[data-testid=assessment-submit]",
                  (b) => b.disabled,
                ),
                true,
              );
              assert(
                (
                  await page.$eval(
                    "[data-testid=assessment-result]",
                    (e) => e.innerText,
                  )
                ).includes(lang === "ar" ? "أحسنت!" : "Well done!"),
              );
              assert.equal(
                await page.evaluate(
                  () => document.activeElement.dataset.testid,
                ),
                "assessment-result",
              );
              if (scenario === "manual") {
                await new Promise((r) => setTimeout(r, 6500));
                assert(page.url().includes("#/assessment/"));
                await page.screenshot({
                  path: `/evidence/assessment-manual-${lang}-${viewport.width}.png`,
                });
                assert(
                  await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                  ),
                );
                await continueWhenStable(page);
                await page.waitForFunction(
                  () => location.hash.startsWith("#/learn/"),
                  { polling: 100 },
                );
                assert(Date.now() - start >= 6500);
                assert(
                  page
                    .url()
                    .endsWith(
                      "#/learn/fixture-course?lesson=fixture-lesson&resume=1",
                    ),
                );
              } else if (scenario === "continue") {
                await continueWhenStable(page);
                await page.waitForFunction(
                  () => location.hash.startsWith("#/learn/"),
                  { polling: 100 },
                );
                assert(Date.now() - start < 2500);
                assert(
                  page
                    .url()
                    .endsWith(
                      "#/learn/fixture-course?lesson=fixture-lesson&resume=1",
                    ),
                );
              } else {
                await page.evaluate(() => (location.hash = "#/support"));
                await new Promise((r) => setTimeout(r, 3300));
                assert(page.url().endsWith("#/support"));
              }
            }
            assert.equal(submits, 1);
            console.log(
              JSON.stringify({
                lang,
                viewport,
                scenario,
                elapsedMs: Date.now() - start,
                result: "PASS",
              }),
            );
          } catch (e) {
            await page.screenshot({
              path: `/evidence/assessment-failure-${lang}-${viewport.width}-${scenario}.png`,
            });
            console.error(
              await page
                .$eval("[data-testid=assessment-continue]", (e) => {
                  const r = e.getBoundingClientRect(),
                    hit = document.elementFromPoint(
                      r.x + r.width / 2,
                      r.y + r.height / 2,
                    );
                  return {
                    rect: r.toJSON(),
                    hit: hit?.outerHTML,
                    url: location.href,
                  };
                })
                .catch(() => page.url()),
            );
            throw e;
          } finally {
            await page.close();
          }
        }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
