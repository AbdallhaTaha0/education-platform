const puppeteer = require("puppeteer-core");
const assert = require("node:assert/strict");
const fs = require("node:fs");

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
    for (const lang of ["ar", "en"]) {
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage();
        await page.setViewport(viewport);
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const origin = "http://localhost:8080";
        await page.goto(`${origin}/${lang}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#hero-title");
        await page.waitForSelector("button[aria-pressed]");
        assert.equal(
          await page.$eval("html", (e) => e.dir),
          lang === "ar" ? "rtl" : "ltr",
        );
        const catalog = await page.evaluate(async () => {
          const response = await fetch("/api/catalog/courses");
          if (!response.ok)
            throw new Error(`Catalog returned ${response.status}`);
          return (await response.json()).data.courses;
        });
        assert(
          catalog.length > 0,
          "Real catalog must contain published courses",
        );
        const toggle = "button.header-tool[aria-pressed]";
        await page.waitForSelector(toggle);
        const originalTheme = await page.$eval("html", (e) => e.dataset.theme);
        await page.click(toggle);
        await page.waitForFunction(
          (before) => document.documentElement.dataset.theme !== before,
          {},
          originalTheme,
        );
        const changedTheme = await page.$eval("html", (e) => e.dataset.theme);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("#hero-title");
        assert.equal(
          await page.$eval("html", (e) => e.dataset.theme),
          changedTheme,
        );
        const summaries = await page.$$("main details summary");
        assert.equal(summaries.length, 4);
        for (const summary of summaries) {
          await summary.click();
          assert.equal(
            await summary.evaluate((e) => e.parentElement.open),
            true,
          );
          await summary.click();
          assert.equal(
            await summary.evaluate((e) => e.parentElement.open),
            false,
          );
        }
        await page.goto(`${origin}/${lang}/courses`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector("#catalog-grade");
        const clear = async () => {
          await page.evaluate(
            (ar) =>
              [...document.querySelectorAll("button")]
                .find(
                  (e) =>
                    e.textContent.trim() ===
                    (ar ? "مسح البحث والتصفية" : "Clear search and filters"),
                )
                .click(),
            lang === "ar",
          );
        };
        const visibleTitles = () =>
          page.$$eval("article h3", (es) =>
            es.map((e) => e.textContent.trim()),
          );
        for (const grade of ["FIRST_SECONDARY", "SECOND_SECONDARY"]) {
          await page.select("#catalog-grade", grade);
          await page.waitForFunction(
            () => !document.querySelector("[aria-busy=true]"),
          );
          const expected = catalog
            .filter((c) => c.academic?.grade === grade)
            .map((c) => (lang === "ar" ? c.titleAr : c.titleEn));
          const titles = await visibleTitles();
          assert(
            titles.length === Math.min(10, expected.length),
            "Grade filter count",
          );
          assert(
            titles.every((t) => expected.includes(t)),
            "Grade filter content",
          );
        }
        await clear();
        await page.type("#catalog-search", "journey-nonexistent-20261009");
        assert.equal((await visibleTitles()).length, 0);
        await clear();
        assert.equal(await page.$eval("#catalog-search", (e) => e.value), "");
        const titles = await visibleTitles();
        assert(titles.length > 0, "Clear filters restores courses");
        await page.screenshot({
          path: `/evidence/journey-catalog-${lang}-${viewport.width}.png`,
        });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.click("article a[aria-label]");
        await page.waitForSelector("h1");
        assert(
          !page.url().endsWith("/courses"),
          "Offer button navigates to real offer",
        );
        assert(
          (await page.$eval("h1", (e) => e.textContent)).trim().length > 0,
        );
        const inventory = await page.$$eval(
          "a,button,input,select,summary,[role=tab]",
          (es) =>
            es
              .filter((e) => e.getClientRects().length)
              .map((e) => ({
                tag: e.tagName,
                role: e.getAttribute("role"),
                label: e.getAttribute("aria-label") || e.textContent.trim(),
                href: e.getAttribute("href"),
                disabled: !!e.disabled,
              })),
        );
        fs.writeFileSync(
          `/evidence/journey-offer-controls-${lang}-${viewport.width}.json`,
          JSON.stringify(inventory, null, 2),
        );
        assert.equal(errors.length, 0, errors.join("\n"));
        console.log(
          JSON.stringify({
            journey: "public-read-only",
            lang,
            viewport,
            catalogCourses: catalog.length,
            result: "PASS",
          }),
        );
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
