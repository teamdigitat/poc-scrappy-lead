const { ensureLinkedInReady } = require("../tabManager.service");
const { scrapePeopleResults } = require("./linkedinPeopleScraper.service");

const { setTimeout: sleep } = require("node:timers/promises");

const INTENT_CONFIG = {
  people: (keyword) =>
    `https://www.linkedin.com/search/results/people/?keywords=${keyword}`,
  posts: (keyword) =>
    `https://www.linkedin.com/search/results/content/?keywords=${keyword}`,
  companies: (keyword) =>
    `https://www.linkedin.com/search/results/companies/?keywords=${keyword}`,
  jobs: (keyword) =>
    `https://www.linkedin.com/jobs/search/?keywords=${keyword}`,
};

function getPageNumberFromUrl(url) {
  const match = url.match(/[?&]page=(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}

async function humanDelay(min = 1200, max = 2500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(delay);
}

async function clickNextHumanLike(page, nextButton, previousPageNumber) {
  const box = await nextButton.boundingBox();
  if (!box) throw new Error("Could not get Next button position.");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 25,
  });

  await humanDelay(300, 800);

  await page.mouse.down();
  await humanDelay(80, 150);
  await page.mouse.up();

  console.log("Clicked Next. Waiting for URL page change...");

  // 🔥 Wait for URL page param to change
  await page.waitForFunction(
    (prevPage) => {
      const match = window.location.href.match(/[?&]page=(\d+)/);
      const current = match ? parseInt(match[1]) : 1;
      return current !== prevPage;
    },
    { timeout: 20000 },
    previousPageNumber,
  );

  // Wait for DOM refresh
  await page.waitForSelector(
    'div[data-view-name="search-entity-result-universal-template"]',
    { timeout: 20000 },
  );

  await humanDelay(1500, 2500);
}

async function searchLinkedIn({ intent, keyword, maxPages = 1 }) {
  if (!INTENT_CONFIG[intent]) {
    throw new Error("Invalid search intent.");
  }

  const page = await ensureLinkedInReady();
  const encodedKeyword = encodeURIComponent(keyword);
  const url = INTENT_CONFIG[intent](encodedKeyword);
  const maxPagesNumber = Number(maxPages);

  console.log("Navigating to:", url);

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  console.log("Current URL:", page.url());
  console.log("Page Title:", await page.title());

  if (intent !== "people") {
    return {
      success: true,
      intent,
      currentUrl: page.url(),
      title: await page.title(),
    };
  }

  const allLeads = [];
  const seenProfiles = new Set();
  let pagesScraped = 0;

  for (let pageNum = 1; pageNum <= maxPagesNumber; pageNum++) {
    console.log(`Processing Page ${pageNum}`);
    console.log(`MaxPageNumber ${maxPagesNumber}`);
    console.log(`MaxPages ${maxPages}`);

    // Wait for results
    await page.waitForSelector(
      'div[data-view-name="search-entity-result-universal-template"]',
      { timeout: 20000 },
    );

    await autoScroll(page);
    await humanDelay();

    const leads = await scrapePeopleResults(page);

    console.log(`Scrapped ${leads.length} leads from page ${pageNum}`);

    for (const lead of leads) {
      if (lead.profileUrl && !seenProfiles.has(lead.profileUrl)) {
        seenProfiles.add(lead.profileUrl);
        allLeads.push(lead);
      }
    }

    pagesScraped++;

    // If last page requested, stop
    if (pageNum === maxPagesNumber) break;

    const previousPageNumber = getPageNumberFromUrl(page.url());

    const nextButton = await page.$('button[aria-label*="Next"]');

    if (!nextButton) {
      console.log("Next button not found.");
      break;
    }

    const isDisabled = await page.evaluate((btn) => btn.disabled, nextButton);

    if (isDisabled) {
      console.log("Next button disabled. Last page.");
      break;
    }

    // Get first profile link before clicking
    const firstProfileBefore = await page.evaluate(() => {
      const el = document.querySelector(
        'a[data-test-app-aware-link][href*="/in/"]',
      );
      return el ? el.href : null;
    });

    await clickNextHumanLike(page, nextButton, previousPageNumber);

    // 🔥 Wait until first profile changes (REAL DOM refresh detection)
    await page.waitForFunction(
      (previousHref) => {
        const el = document.querySelector(
          'a[data-test-app-aware-link][href*="/in/"]',
        );
        if (!el) return false;
        return el.href !== previousHref;
      },
      { timeout: 20000 },
      firstProfileBefore,
    );

    await humanDelay(1200, 2000);

    console.log("Page DOM updated. Moving to next iteration...");
  }

  return {
    success: true,
    intent,
    totalExtracted: allLeads.length,
    pagesScraped,
    leads: allLeads,
  };
}

module.exports = {
  searchLinkedIn,
};
