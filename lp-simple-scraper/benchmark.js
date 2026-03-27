import fs from 'fs';
import express from 'express';
import { runTest } from './test.js';

const iterations = parseInt(process.argv[2], 10) || 1;
const csvFile = 'benchmark_results.csv';
const PORT = 3000;

function formatNumber(num) {
  return num.toFixed(2).replace('.', ',');
}

fs.writeFileSync(csvFile, 'Iteration;Engine;ConnectionTimeMs;NavigationTimeMs;TotalTimeMs\n');

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
      const conn = formatNumber(lpMetrics.connectionTime);
      const nav = formatNumber(lpMetrics.navigationTime);
      const total = formatNumber(lpMetrics.totalTime);
      fs.appendFileSync(csvFile, `${i};Lightpanda;${conn};${nav};${total}\n`);
      console.log(`Lightpanda finished in ${total}ms`);
    } catch (error) {
      console.error(`Lightpanda failed:`, error.message);
    }

    try {
      const chromeMetrics = await runTest(9223);
      const conn = formatNumber(chromeMetrics.connectionTime);
      const nav = formatNumber(chromeMetrics.navigationTime);
      const total = formatNumber(chromeMetrics.totalTime);
      fs.appendFileSync(csvFile, `${i};Google Chrome;${conn};${nav};${total}\n`);
      console.log(`Google Chrome finished in ${total}ms`);
    } catch (error) {
      console.error(`Google Chrome failed:`, error.message);
    }
  }

  console.log(`\nBenchmark complete! Results saved to ${csvFile}`);
  
  // Cleanly shut down the server when finished
  server.close();
});