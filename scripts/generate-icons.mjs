// Renders the PWA icons in public/ from scripts/icon*.svg using headless Chromium.
// Usage: node scripts/generate-icons.mjs   (needs `playwright` available)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const svg = fs.readFileSync(path.join(root, "scripts/icon.svg"), "utf8");
const maskable = fs.readFileSync(path.join(root, "scripts/icon-maskable.svg"), "utf8");

const outputs = [
  { file: "public/icon-192.png", size: 192, src: svg },
  { file: "public/icon-512.png", size: 512, src: svg },
  { file: "public/icon-maskable-512.png", size: 512, src: maskable },
  { file: "src/app/apple-icon.png", size: 180, src: maskable }, // iOS applies its own rounding
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const { file, size, src } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${src.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.locator("svg").screenshot({ path: path.join(root, file), omitBackground: true });
  console.log("wrote", file);
}
await browser.close();
fs.copyFileSync(path.join(root, "scripts/icon.svg"), path.join(root, "src/app/icon.svg"));
console.log("wrote src/app/icon.svg");
