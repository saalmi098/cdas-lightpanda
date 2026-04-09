# E2E Testing Platform Benchmark: Lightpanda vs. Google Chrome

## Prerequisites
* **Node.js** (v16+)
* **Docker Desktop** (running and configured for WSL2/Linux containers)

## 1. Setup
Clone the repository and install the Node.js dependencies (Playwright and Express):
```bash
npm install
```
[cite_start]*Note: Ensure your simple, static target application (`index.html`) is placed inside the `public` folder[cite: 20].*

## 2. Start the Browser Engines
Start both browser engines with Docker Compose:
```bash
docker compose up -d
```

This starts:
* Lightpanda on port 9222
* Google Chrome on port 9223 (with increased shared memory flags to prevent crashes during repetitive testing)

## 3. Run the Benchmark
The benchmark script automatically starts a local web server on port 3000 to serve the static application and runs the Playwright test suite against both browsers.

Run the benchmark by specifying the number of iterations you want to perform:
```bash
node benchmark.js 10
```

## 4. View Results
Once finished, the script will output a `benchmark_results.csv` file in the root directory. This file uses semicolons (`;`) for columns and commas (`,`) for decimals, making it ready to import directly into Excel or Google Sheets for analysis.

## Cleanup
When you are done testing, you can stop and remove the Docker containers:
```bash
docker compose down
```