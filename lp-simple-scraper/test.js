import { chromium } from 'playwright';

export async function runTest(port) {
  const startTotal = performance.now();

  // Measure Connection Time
  const startConnection = performance.now();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const endConnection = performance.now();

  let context;
  let page;

  try {
    // Use a new isolated context/page each iteration.
    context = await browser.newContext();
    page = await context.newPage();

    // Measure Page Navigation Time
    const startNav = performance.now();
    await page.goto('http://host.docker.internal:3000');
    await page.title(); // Ensure the page has loaded enough to grab the title
    const endNav = performance.now();

    const endTotal = performance.now();

    // Return the metrics in milliseconds
    return {
      connectionTime: endConnection - startConnection,
      navigationTime: endNav - startNav,
      totalTime: endTotal - startTotal
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore cleanup errors.
      }
    }

    if (context) {
      try {
        await context.close();
      } catch {
        // Ignore cleanup errors.
      }
    }

    try {
      await browser.close();
    } catch {
      // Ignore cleanup errors.
    }
  }
}