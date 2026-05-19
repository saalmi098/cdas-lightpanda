import { chromium } from 'playwright';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const LP_IMAGE = 'lightpanda/browser:latest';
const LP_CONTAINER = 'lp-launch-test';
const LP_HOST_PORT = 9224;

const CHROME_IMAGE = 'zenika/alpine-chrome';
const CHROME_CONTAINER = 'chrome-launch-test';
const CHROME_HOST_PORT = 9225;

function convertToMB(value, unit) {
  const u = unit.toLowerCase();
  if (u === 'b')   return value / (1024 * 1024);
  if (u === 'kib') return value / 1024;
  if (u === 'mib') return value;
  if (u === 'gib') return value * 1024;
  if (u === 'tib') return value * 1024 * 1024;
  return NaN;
}

function parseDockerMemUsageToMB(raw) {
  const current = raw.split('/')[0].trim();
  const m = current.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)$/);
  if (!m) return NaN;
  return convertToMB(Number(m[1]), m[2]);
}

async function getContainerMemoryMB(containerName) {
  try {
    const { stdout } = await execFileAsync('docker', [
      'stats', '--no-stream', '--format', '{{.MemUsage}}', containerName,
    ]);
    const mb = parseDockerMemUsageToMB(stdout.trim());
    return Number.isFinite(mb) ? mb : null;
  } catch {
    return null;
  }
}

async function waitForCDP(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  throw new Error(`CDP not ready on port ${port} after ${timeoutMs}ms`);
}

// Lightpanda: spins up a fresh Docker container per iteration (--rm auto-removes on stop).
// connectionTime = docker run + wait for CDP ready + connectOverCDP.
export async function runLightpandaTest() {
  const startTotal = performance.now();

  const startLaunch = performance.now();
  await execFileAsync('docker', [
    'run', '--rm', '-d',
    '--name', LP_CONTAINER,
    '-p', `${LP_HOST_PORT}:9222`,
    LP_IMAGE,
  ]);
  await waitForCDP(LP_HOST_PORT);
  const versionRes = await fetch(`http://127.0.0.1:${LP_HOST_PORT}/json/version`);
  const versionJson = await versionRes.json();
  const wsUrl = versionJson.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://127.0.0.1:${LP_HOST_PORT}`);
  const browser = await chromium.connectOverCDP(wsUrl);
  const endLaunch = performance.now();

  let context, page;
  try {
    context = await browser.newContext();
    page = await context.newPage();

    const startNav = performance.now();
    await page.goto('http://host.docker.internal:3000');
    await page.title();
    const endNav = performance.now();

    const endTotal = performance.now();
    const memoryMB = await getContainerMemoryMB(LP_CONTAINER);

    return {
      connectionTime: endLaunch - startLaunch,
      navigationTime: endNav - startNav,
      totalTime: endTotal - startTotal,
      memoryMB,
    };
  } finally {
    if (page)    try { await page.close();    } catch {}
    if (context) try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
    try { await execFileAsync('docker', ['stop', LP_CONTAINER]); } catch {}
  }
}

// Chrome: spins up a fresh zenika/alpine-chrome Docker container per iteration.
// connectionTime = docker run + wait for CDP ready + connectOverCDP (mirrors Lightpanda).
export async function runChromeTest() {
  const startTotal = performance.now();

  const startLaunch = performance.now();
  await execFileAsync('docker', [
    'run', '--rm', '-d',
    '--name', CHROME_CONTAINER,
    '--shm-size=1gb',
    '-p', `${CHROME_HOST_PORT}:9222`,
    CHROME_IMAGE,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=0.0.0.0',
    '--remote-debugging-port=9222',
  ]);
  await waitForCDP(CHROME_HOST_PORT);
  const versionRes = await fetch(`http://127.0.0.1:${CHROME_HOST_PORT}/json/version`);
  const versionJson = await versionRes.json();
  const wsUrl = versionJson.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://127.0.0.1:${CHROME_HOST_PORT}`);
  const browser = await chromium.connectOverCDP(wsUrl);
  const endLaunch = performance.now();

  let context, page;
  try {
    context = await browser.newContext();
    page = await context.newPage();

    const startNav = performance.now();
    await page.goto('http://host.docker.internal:3000');
    await page.title();
    const endNav = performance.now();

    const endTotal = performance.now();
    const memoryMB = await getContainerMemoryMB(CHROME_CONTAINER);

    return {
      connectionTime: endLaunch - startLaunch,
      navigationTime: endNav - startNav,
      totalTime: endTotal - startTotal,
      memoryMB,
    };
  } finally {
    if (page)    try { await page.close();    } catch {}
    if (context) try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
    try { await execFileAsync('docker', ['stop', CHROME_CONTAINER]); } catch {}
  }
}
