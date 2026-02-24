const state = require("../state");

async function getAllPages() {
  if (!state.browser) {
    throw new Error("Browser not connected.");
  }

  const pages = await state.browser.pages();
  return pages;
}

async function getLinkedInPage() {
  const pages = await getAllPages();

  for (const page of pages) {
    const url = page.url();

    if (url.includes("linkedin.com")) {
      return page;
    }
  }

  return null;
}

async function detectLoginState(page) {
  const url = page.url();

  if (url.includes("/login")) {
    return {
      loggedIn: false,
      reason: "On login page",
    };
  }

  if (url.includes("/feed")) {
    return {
      loggedIn: true,
      reason: "Feed URL detected",
    };
  }

  // Fallback DOM check
  const searchBar = await page.$('input[placeholder*="Search"]');

  if (searchBar) {
    return {
      loggedIn: true,
      reason: "Search bar detected",
    };
  }

  return {
    loggedIn: false,
    reason: "Unknown state",
  };
}

async function getBrowserStatus() {
  if (!state.browser) {
    return {
      browserConnected: false,
    };
  }

  const linkedInPage = await getLinkedInPage();

  if (!linkedInPage) {
    return {
      browserConnected: true,
      linkedInDetected: false,
    };
  }

  const loginState = await detectLoginState(linkedInPage);

  return {
    browserConnected: true,
    linkedInDetected: true,
    loggedIn: loginState.loggedIn,
    reason: loginState.reason,
    currentUrl: linkedInPage.url(),
  };
}

async function focusLinkedInTab() {
  const page = await getLinkedInPage();

  if (!page) {
    throw new Error("LinkedIn tab not found.");
  }

  await page.bringToFront();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return page;
}

async function ensureLinkedInReady() {
  if (!state.browser) {
    throw new Error("Browser not connected.");
  }

  const page = await focusLinkedInTab();

  const loginState = await detectLoginState(page);

  if (!loginState.loggedIn) {
    throw new Error("User not logged into LinkedIn.");
  }

  // Light stability delay only
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return page;
}

async function navigateToLinkedInSearch() {
  const page = await ensureLinkedInReady();

  await page.goto("https://www.linkedin.com/search/results/people/", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector('input[placeholder*="Search"]', {
    timeout: 10000,
  });

  return page.title();
}

module.exports = {
  getAllPages,
  getLinkedInPage,
  getBrowserStatus,
  focusLinkedInTab,
  ensureLinkedInReady,
  navigateToLinkedInSearch,
};
