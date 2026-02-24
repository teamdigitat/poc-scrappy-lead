const puppeteer = require("puppeteer-core");
const state = require("../state");

const DEBUG_PORT = process.env.CHROME_DEBUG_PORT || 9222;

async function connectToBrowser() {
  if (state.browser) {
    console.log("Browser already connected.");
    return state.browser;
  }

  try {
    console.log("Connecting to Chrome debug port...");

    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${DEBUG_PORT}`,
      defaultViewport: null,
    });

    browser.on("disconnected", () => {
      console.log("Browser disconnected.");
      state.browser = null;
    });

    state.browser = browser;

    console.log("Successfully connected to browser.");

    return browser;
  } catch (error) {
    console.error("Failed to connect to browser:", error.message);
    throw new Error("Unable to connect to Chrome. Is it running?");
  }
}

function getBrowser() {
  if (!state.browser) {
    throw new Error("Browser not connected.");
  }
  return state.browser;
}

module.exports = {
  connectToBrowser,
  getBrowser,
};
