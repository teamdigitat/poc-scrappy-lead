const express = require("express");
const { connectToBrowser } = require("../services/browserManager.service");
const { getBrowserStatus } = require("../services/tabManager.service");
const { ensureLinkedInReady } = require("../services/tabManager.service");
const { navigateToLinkedInSearch } = require("../services/tabManager.service");
const {
  searchLinkedIn,
} = require("../services/linkedin/linkedinSearch.service");

const router = express.Router();
const { launchChrome } = require("../services/chromeLauncher.service");

router.post("/launch-browser", (req, res) => {
  try {
    launchChrome();
    res.json({ message: "Chrome launched successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/connect-browser", async (req, res) => {
  try {
    const browser = await connectToBrowser();
    const pages = await browser.pages();

    res.json({
      connected: true,
      pages: pages.length,
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message,
    });
  }
});

router.get("/browser-status", async (req, res) => {
  try {
    const status = await getBrowserStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

router.post("/ensure-linkedin-ready", async (req, res) => {
  try {
    await ensureLinkedInReady();

    res.json({
      ready: true,
      message: "LinkedIn is ready for automation.",
    });
  } catch (error) {
    res.status(400).json({
      ready: false,
      error: error.message,
    });
  }
});

router.post("/test-navigation", async (req, res) => {
  try {
    const title = await navigateToLinkedInSearch();

    res.json({
      success: true,
      pageTitle: title,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { intent, keyword, maxPages } = req.body;

    if (!intent || !keyword) {
      return res.status(400).json({
        error: "Intent and keyword are required.",
      });
    }

    const result = await searchLinkedIn({ intent, keyword, maxPages });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
