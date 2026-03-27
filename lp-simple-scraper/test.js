import { chromium } from 'playwright';

export async function runTest(port) {
  const startTotal = performance.now();

  // Measure Connection Time
  const startConnection = performance.now();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const endConnection = performance.now();

  const contexts = browser.contexts();
  const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
  const page = await context.newPage();

  // Measure Page Navigation Time
  const startNav = performance.now();
  await page.goto('http://host.docker.internal:3000');
  const title = await page.title(); // Ensure the page has loaded enough to grab the title
  const endNav = performance.now();

  await browser.close();
  const endTotal = performance.now();

  // Return the metrics in milliseconds
  return {
    connectionTime: endConnection - startConnection,
    navigationTime: endNav - startNav,
    totalTime: endTotal - startTotal
  };
}