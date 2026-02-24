const express = require("express");
const router = express.Router();
const { dumpLinkedInPage } = require("../services/debug.service");

router.post("/dump", async (req, res) => {
  try {
    const result = await dumpLinkedInPage();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
