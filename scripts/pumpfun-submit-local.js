#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.join(__dirname, "..");
const PREPARED_CACHE = path.join(ROOT, "cache", "pumpfun-prepared.json");
const DEFAULT_PROFILE = path.join(ROOT, "cache", "pumpfun-automation-chrome");

function argValue(args, name, fallback = "") {
  const exact = args.indexOf(name);
  if (exact >= 0 && args[exact + 1]) return args[exact + 1];
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function argValues(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
    else if (args[i].startsWith(`${name}=`)) values.push(args[i].slice(name.length + 1));
  }
  return values;
}

function hasArg(args, name) {
  return args.includes(name);
}

function usage() {
  console.log(`
Pump.fun local submit helper

Required:
  --prepared <id|latest>       Prepared submission id from Get Me a Job

Optional:
  --app <url>                  Get Me a Job app URL (default: http://localhost:4173)
  --url <pumpfun-url>          Override Pump.fun bounty URL
  --file <path>                Evidence file to upload. Repeat for multiple files.
  --profile <dir>              Chrome profile folder for Pump.fun login
  --submit                     Click Pump.fun Submit after filling
  --yes-i-understand-this-posts-to-pumpfun
                               Required with --submit

Examples:
  npm run pumpfun:submit -- --prepared latest
  npm run pumpfun:submit -- --prepared latest --file "C:\\proof\\demo.mp4"
  npm run pumpfun:submit -- --prepared gmj-abc123 --submit --yes-i-understand-this-posts-to-pumpfun
`.trim());
}

function latestPreparedId() {
  const raw = fs.readFileSync(PREPARED_CACHE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const latest = items
    .filter((item) => item && item.id)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
  if (!latest?.id) throw new Error("No prepared submissions found. Run an agent first.");
  return latest.id;
}

async function loadPrepared(appUrl, id) {
  const preparedId = id === "latest" ? latestPreparedId() : id;
  const endpoint = `${appUrl.replace(/\/+$/, "")}/api/pumpfun/prepared/${encodeURIComponent(preparedId)}`;
  const res = await fetch(endpoint, { headers: { Accept: "application/json" } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Could not load prepared submission (${res.status})`);
  return payload.submission;
}

function submissionText(submission) {
  const body = String(submission.body || "").trim();
  const links = Array.isArray(submission.links) ? submission.links.map((link) => String(link || "").trim()).filter(Boolean) : [];
  return [body, links.length ? `Links:\n${links.map((link) => `- ${link}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
}

async function clickFirst(page, selectors, options = {}) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count().catch(() => 0)) {
      try {
        await locator.click({ timeout: options.timeout || 2500 });
        return true;
      } catch {
        // try next selector
      }
    }
  }
  return false;
}

async function fillPumpFun(page, submission, evidenceFiles) {
  const text = submissionText(submission);
  if (!text) throw new Error("Prepared submission is empty");

  await clickFirst(page, [
    'button:has-text("Submit work")',
    'button:has-text("Submit Work")',
    'text=Submit work',
    'text=Submit Work'
  ]);

  await page.waitForTimeout(1200);

  const checkboxes = page.locator('input[type="checkbox"]:visible');
  const checkboxCount = await checkboxes.count().catch(() => 0);
  for (let i = 0; i < checkboxCount; i += 1) {
    const box = checkboxes.nth(i);
    if (!(await box.isChecked().catch(() => false))) {
      await box.check({ force: true }).catch(async () => box.click({ force: true }).catch(() => {}));
    }
  }

  const textarea = page.locator("textarea:visible").last();
  if (!(await textarea.count().catch(() => 0))) {
    throw new Error("Could not find Pump.fun description field. Open the Submit work modal and try again.");
  }
  await textarea.fill(text);

  const firstLink = Array.isArray(submission.links) ? submission.links.find(Boolean) : "";
  if (firstLink) {
    const linkInput = page
      .locator('input:visible[placeholder*="github" i], input:visible[placeholder*="drive" i], input:visible[placeholder*="https" i], input:visible[type="url"]')
      .first();
    if (await linkInput.count().catch(() => 0)) {
      await linkInput.fill(String(firstLink));
    }
  }

  const validFiles = evidenceFiles.map((file) => path.resolve(file)).filter((file) => fs.existsSync(file));
  if (validFiles.length) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count().catch(() => 0)) {
      await fileInput.setInputFiles(validFiles);
    } else {
      console.warn("Evidence files were provided, but Pump.fun file input was not found.");
    }
  }

  const submitButton = page.locator('button:has-text("Submit")').last();
  if (await submitButton.count().catch(() => 0)) {
    await submitButton.scrollIntoViewIfNeeded().catch(() => {});
    await submitButton.evaluate((button) => {
      button.style.outline = "4px solid #66f2a8";
      button.style.boxShadow = "0 0 0 10px rgba(102,242,168,.22)";
    }).catch(() => {});
  }

  return { checkboxCount, fileCount: validFiles.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, "--help") || hasArg(args, "-h")) {
    usage();
    return;
  }

  const preparedArg = argValue(args, "--prepared");
  if (!preparedArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  const appUrl = argValue(args, "--app", "http://localhost:4173");
  const evidenceFiles = argValues(args, "--file");
  const shouldSubmit = hasArg(args, "--submit");
  const confirmedSubmit = hasArg(args, "--yes-i-understand-this-posts-to-pumpfun");
  if (shouldSubmit && !confirmedSubmit) {
    throw new Error("Refusing final submit without --yes-i-understand-this-posts-to-pumpfun");
  }

  const submission = await loadPrepared(appUrl, preparedArg);
  const pumpUrl = argValue(args, "--url", submission.sourceUrl || "");
  if (!pumpUrl) throw new Error("Pump.fun bounty URL is missing. Pass --url.");

  const profileDir = path.resolve(argValue(args, "--profile", DEFAULT_PROFILE));
  fs.mkdirSync(profileDir, { recursive: true });

  const launchOptions = {
    headless: false,
    viewport: { width: 1440, height: 980 },
    args: ["--disable-blink-features=AutomationControlled"]
  };
  const chromePath = String(process.env.CHROME_PATH || "").trim();
  if (chromePath) launchOptions.executablePath = chromePath;
  else launchOptions.channel = "chrome";

  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  await page.goto(pumpUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);

  const result = await fillPumpFun(page, submission, evidenceFiles);
  console.log(`Filled Pump.fun submission for: ${submission.title}`);
  console.log(`Checked ${result.checkboxCount} boxes. Attached ${result.fileCount} evidence file(s).`);

  if (shouldSubmit) {
    await page.locator('button:has-text("Submit")').last().click();
    console.log("Clicked Pump.fun Submit. Complete any wallet/signature prompts in the browser.");
  } else {
    console.log("Stopped before final Submit. Review the form, then click Pump.fun Submit manually.");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
