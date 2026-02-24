const express = require("express");
console.log("SYSTEM ROUTES LOADED");
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

module.exports = router;
