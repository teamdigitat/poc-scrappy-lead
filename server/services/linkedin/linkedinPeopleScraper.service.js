const fs = require("fs");
const path = require("path");

async function dumpPeopleDOM(page) {
  await page.waitForSelector("main", { timeout: 10000 });

  const html = await page.content();

  // Create debug-dumps/people folder
  const dumpDir = path.join(__dirname, "..", "debug-dumps", "people");

  if (!fs.existsSync(dumpDir)) {
    const fs = require("fs");
    const path = require("path");

    async function dumpPeopleDOM(page) {
      await page.waitForSelector("main", { timeout: 10000 });

      const html = await page.content();

      const dumpDir = path.join(__dirname, "..", "debug-dumps", "people");

      if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filePath = path.join(dumpDir, `people-search-${timestamp}.html`);

      fs.writeFileSync(filePath, html, "utf-8");

      return filePath;
    }

    async function scrapePeopleResults(page) {
      await page.waitForSelector(
        'div[data-view-name="search-entity-result-universal-template"]',
        { timeout: 20000 },
      );

      const results = await page.evaluate(() => {
        const data = [];

        const cards = document.querySelectorAll(
          'div[data-view-name="search-entity-result-universal-template"]',
        );

        cards.forEach((card, index) => {
          if (index >= 10) return;

          const name =
            card
              .querySelector("a span[aria-hidden='true']")
              ?.innerText?.trim() || null;

          const profileUrl =
            card
              .querySelector("a[data-test-app-aware-link]")
              ?.href?.split("?")[0] || null; // remove tracking params

          const role =
            card.querySelector(".t-14.t-black.t-normal")?.innerText?.trim() ||
            null;

          const subtitles = card.querySelectorAll(".t-14.t-normal");

          let location = null;

          subtitles.forEach((el) => {
            const text = el.innerText.trim();
            if (!text.includes("degree")) {
              location = text;
            }
          });

          if (profileUrl && profileUrl.includes("/in/")) {
            data.push({
              name,
              profileUrl,
              role,
              location,
            });
          }
        });

        return data;
      });

      return results;
    }

    module.exports = {
      scrapePeopleResults,
      dumpPeopleDOM,
    };
    fs.mkdirSync(dumpDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filePath = path.join(dumpDir, `people-search-${timestamp}.html`);

  fs.writeFileSync(filePath, html, "utf-8");

  return filePath;
}

async function scrapePeopleResults(page) {
  await page.waitForSelector(
    'div[data-view-name="search-entity-result-universal-template"]',
    { timeout: 20000 },
  );

  const results = await page.evaluate(() => {
    const data = [];

    const cards = document.querySelectorAll(
      'div[data-view-name="search-entity-result-universal-template"]',
    );

    cards.forEach((card, index) => {
      if (index >= 10) return;

      const name =
        card.querySelector("a span[aria-hidden='true']")?.innerText?.trim() ||
        null;

      const profileUrl =
        card.querySelector("a[data-test-app-aware-link]")?.href || null;

      const role =
        card.querySelector(".t-14.t-black.t-normal")?.innerText?.trim() || null;

      const subtitles = card.querySelectorAll(".t-14.t-normal");

      let location = null;

      subtitles.forEach((el) => {
        const text = el.innerText.trim();
        if (!text.includes("degree")) {
          location = text;
        }
      });

      if (profileUrl && profileUrl.includes("/in/")) {
        data.push({
          name,
          profileUrl,
          role,
          location,
        });
      }
    });

    return data;
  });

  return results;
}

module.exports = {
  scrapePeopleResults,
  dumpPeopleDOM,
};
