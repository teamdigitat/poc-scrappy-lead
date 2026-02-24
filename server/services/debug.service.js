const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dumpLinkedInPage() {
  const debugPort = process.env.CHROME_DEBUG_PORT || 9222;

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${debugPort}`,
    defaultViewport: null,
  });

  const pages = await browser.pages();

  // Find LinkedIn active tab
  const linkedInPage = pages.find((p) => p.url().includes("linkedin.com"));

  if (!linkedInPage) {
    throw new Error("LinkedIn tab not found.");
  }

  console.log("LinkedIn page found:", linkedInPage.url());

  // Wait for full render
  await linkedInPage.waitForSelector("body");
  await delay(5000); // allow dynamic content to hydrate

  const timestamp = Date.now();
  const dumpDir = path.join(__dirname, "..", "debug-dumps");

  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir);
  }

  // Save HTML
  const html = await linkedInPage.content();
  const htmlPath = path.join(dumpDir, `linkedin-dump-${timestamp}.html`);
  fs.writeFileSync(htmlPath, html);

  // Capture network responses
  const apiLogs = [];

  linkedInPage.on("response", async (response) => {
    const url = response.url();
    if (url.includes("voyager") || url.includes("graphql")) {
      try {
        const body = await response.text();
        apiLogs.push({
          url,
          body,
        });
      } catch (e) {}
    }
  });

  await delay(3000);

  const apiPath = path.join(dumpDir, `linkedin-api-${timestamp}.json`);
  fs.writeFileSync(apiPath, JSON.stringify(apiLogs, null, 2));

  return {
    success: true,
    htmlFile: htmlPath,
    apiFile: apiPath,
  };
}

module.exports = { dumpLinkedInPage };
