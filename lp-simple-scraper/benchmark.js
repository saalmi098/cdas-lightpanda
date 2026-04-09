import fs from 'fs';
import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { runTest } from './test.js';

const iterations = parseInt(process.argv[2], 10) || 1;
const csvFile = 'benchmark_results.csv';
const PORT = 3000;
const execFileAsync = promisify(execFile);

function formatNumber(num) {
  return num.toFixed(2).replace('.', ',');
}

function convertToMB(value, unit) {
  const normalized = unit.toLowerCase();
  if (normalized === 'b') return value / (1024 * 1024);
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

const csvRows = ['Iteration;Engine;ConnectionTimeMs;NavigationTimeMs;TotalTimeMs;MemoryUsageMB'];

// --- Set up the local web server ---
const app = express();
app.use(express.static('public')); // Serves your static app from the 'public' folder

const server = app.listen(PORT, async () => {
  console.log(`\nLocal web server running on port ${PORT}`);
  console.log(`Starting benchmark for ${iterations} iteration(s)...\n`);

  for (let i = 1; i <= iterations; i++) {
    console.log(`--- Running Iteration ${i} of ${iterations} ---`);

    try {
      const lpMetrics = await runTest(9222);
      const lpMemory = await getContainerMemoryMB('lightpanda');
      const conn = formatNumber(lpMetrics.connectionTime);
      const nav = formatNumber(lpMetrics.navigationTime);
      const total = formatNumber(lpMetrics.totalTime);
      const mem = lpMemory === null ? 'N/A' : formatNumber(lpMemory);
      csvRows.push(`${i};Lightpanda;${conn};${nav};${total};${mem}`);
      console.log(`Lightpanda finished in ${total}ms (memory: ${mem} MB)`);
    } catch (error) {
      console.error(`Lightpanda failed:`, error.message);
    }

    try {
      const chromeMetrics = await runTest(9223);
      const chromeMemory = await getContainerMemoryMB('chrome');
      const conn = formatNumber(chromeMetrics.connectionTime);
      const nav = formatNumber(chromeMetrics.navigationTime);
      const total = formatNumber(chromeMetrics.totalTime);
      const mem = chromeMemory === null ? 'N/A' : formatNumber(chromeMemory);
      csvRows.push(`${i};Google Chrome;${conn};${nav};${total};${mem}`);
      console.log(`Google Chrome finished in ${total}ms (memory: ${mem} MB)`);
    } catch (error) {
      console.error(`Google Chrome failed:`, error.message);
    }
  }

  fs.writeFileSync(csvFile, `${csvRows.join('\n')}\n`);
  console.log(`\nBenchmark complete! Results saved to ${csvFile}`);
  
  // Cleanly shut down the server when finished
  server.close();
});