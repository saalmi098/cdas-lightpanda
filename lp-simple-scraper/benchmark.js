import fs from 'fs';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';

const iterations = parseInt(process.argv[2], 10) || 1;
const testMode = (process.argv[3] || 'cdp').toLowerCase(); // 'cdp' or 'launch'
const csvFile = testMode === 'launch' ? 'benchmark_results_launch.csv' : 'benchmark_results.csv';
const PORT = 3000;
const execFileAsync = promisify(execFile);

// Dynamic import — avoids loading both test modules at once.
let runConnectTest, runLightpandaTest, runChromeTest;
if (testMode === 'launch') {
  ({ runLightpandaTest, runChromeTest } = await import('./test-launch.js'));
} else {
  ({ runConnectTest } = await import('./test-connect.js'));
}

function formatNumber(num) {
  return num.toFixed(2).replace('.', ',');
}

function convertToMB(value, unit) {
  const normalized = unit.toLowerCase();
  if (normalized === 'b')   return value / (1024 * 1024);
  if (normalized === 'kib') return value / 1024;
  if (normalized === 'mib') return value;
  if (normalized === 'gib') return value * 1024;
  if (normalized === 'tib') return value * 1024 * 1024;
  return NaN;
}

function parseDockerMemUsageToMB(memUsageRaw) {
  // Docker returns values like "123.4MiB / 7.6GiB".
  const currentUsage = memUsageRaw.split('/')[0].trim();
  const match = currentUsage.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)$/);
  if (!match) return NaN;

  const value = Number(match[1]);
  const unit = match[2];
  return convertToMB(value, unit);
}

async function getContainerMemoryMB(containerName) {
  try {
    const { stdout } = await execFileAsync('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{.MemUsage}}',
      containerName
    ]);

    const usage = parseDockerMemUsageToMB(stdout.trim());
    return Number.isFinite(usage) ? usage : null;
  } catch {
    // Return null when Docker is unavailable, the container is missing, or parsing fails.
    return null;
  }
}

const csvHeader = testMode === 'launch'
  ? 'Iteration;Engine;ColdStartTimeMs;NavigationTimeMs;TotalTimeMs;MemoryUsageMB'
  : 'Iteration;Engine;ConnectionTimeMs;NavigationTimeMs;TotalTimeMs;MemoryUsageMB';
const csvRows = [csvHeader];

// --- Set up the local web server ---
const app = express();
app.use(express.static('public')); // Serves your static app from the 'public' folder

const server = app.listen(PORT, async () => {
  console.log(`\nLocal web server running on port ${PORT}`);
  console.log(`Starting ${testMode.toUpperCase()} benchmark for ${iterations} iteration(s)...\n`);

  for (let i = 1; i <= iterations; i++) {
    console.log(`--- Running Iteration ${i} of ${iterations} ---`);

    if (testMode === 'launch') {
      // Launch mode: each call starts a fresh browser process; memoryMB comes from the test fn.
      try {
        const metrics = await runLightpandaTest();
        const conn  = formatNumber(metrics.connectionTime);
        const nav   = formatNumber(metrics.navigationTime);
        const total = formatNumber(metrics.totalTime);
        const mem   = metrics.memoryMB === null ? 'N/A' : formatNumber(metrics.memoryMB);
        csvRows.push(`${i};Lightpanda;${conn};${nav};${total};${mem}`);
        console.log(`Lightpanda (launch) finished in ${total}ms (memory: ${mem} MB)`);
      } catch (error) {
        console.error(`Lightpanda (launch) failed:`, error.message);
      }

      try {
        const metrics = await runChromeTest();
        const conn  = formatNumber(metrics.connectionTime);
        const nav   = formatNumber(metrics.navigationTime);
        const total = formatNumber(metrics.totalTime);
        const mem   = metrics.memoryMB === null ? 'N/A' : formatNumber(metrics.memoryMB);
        csvRows.push(`${i};Google Chrome;${conn};${nav};${total};${mem}`);
        console.log(`Google Chrome (launch) finished in ${total}ms (memory: ${mem} MB)`);
      } catch (error) {
        console.error(`Google Chrome (launch) failed:`, error.message);
      }

    } else {
      // CDP mode: browsers already running in Docker; memory queried from running containers.
      try {
        const lpMetrics = await runConnectTest(9222);
        const lpMemory = await getContainerMemoryMB('lightpanda');
        const conn  = formatNumber(lpMetrics.connectionTime);
        const nav   = formatNumber(lpMetrics.navigationTime);
        const total = formatNumber(lpMetrics.totalTime);
        const mem   = lpMemory === null ? 'N/A' : formatNumber(lpMemory);
        csvRows.push(`${i};Lightpanda;${conn};${nav};${total};${mem}`);
        console.log(`Lightpanda finished in ${total}ms (memory: ${mem} MB)`);
      } catch (error) {
        console.error(`Lightpanda failed:`, error.message);
      }

      try {
        const chromeMetrics = await runConnectTest(9223);
        const chromeMemory = await getContainerMemoryMB('chrome');
        const conn  = formatNumber(chromeMetrics.connectionTime);
        const nav   = formatNumber(chromeMetrics.navigationTime);
        const total = formatNumber(chromeMetrics.totalTime);
        const mem   = chromeMemory === null ? 'N/A' : formatNumber(chromeMemory);
        csvRows.push(`${i};Google Chrome;${conn};${nav};${total};${mem}`);
        console.log(`Google Chrome finished in ${total}ms (memory: ${mem} MB)`);
      } catch (error) {
        console.error(`Google Chrome failed:`, error.message);
      }
    }
  }

  fs.writeFileSync(csvFile, `${csvRows.join('\n')}\n`);
  console.log(`\nBenchmark complete! Results saved to ${csvFile}`);

  // Cleanly shut down the server when finished
  server.close();
});
