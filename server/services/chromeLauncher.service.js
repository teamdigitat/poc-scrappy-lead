const { spawn, execSync } = require("child_process");
const path = require("path");
const state = require("../state");
const os = require("os");

const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function launchChrome() {
  try {
    execSync("taskkill /IM chrome.exe /F", { stdio: "ignore" });
  } catch (err) {}

  const debugPort = process.env.CHROME_DEBUG_PORT || 9222;

  const userDataDir = path.join(os.tmpdir(), "scrapyleads-chrome-profile");
  const chromeArgs = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    "http://localhost:3000",
    "https://linkedin.com/login",
  ];

  // spawn code
  const chromeProcess = spawn(CHROME_PATH, chromeArgs, {
    windowsHide: false,
  });

  // exec code

  chromeProcess.on("error", (err) => {
    console.error("Failed to start Chrome:", err);
  });

  chromeProcess.on("exit", (code) => {
    console.log("Chrome exited with code:", code);
  });

  state.chromeProcess = chromeProcess;

  console.log("Chrome launched successfully.");
}

module.exports = { launchChrome };
