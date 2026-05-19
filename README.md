# E2E Testing Platform Benchmark: Lightpanda vs. Google Chrome

## Prerequisites
* **Node.js** (v16+)
* **Docker Desktop** (running and configured for WSL2/Linux containers)

> **Why Docker for both engines?**
> Lightpanda has no native Windows support — on Windows the only option is WSL2 or Docker (see [installation docs](https://lightpanda.io/docs/open-source/installation)). To keep the comparison fair (same runtime environment, same isolation overhead), Chrome also runs in Docker rather than natively.

## 1. Setup
Clone the repository and install the Node.js dependencies (Playwright and Express):
```bash
cd lp-simple-scraper
npm install
```

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

### CDP mode (default) — browsers pre-started via Docker Compose
Requires `docker compose up -d` first. Connects to already-running browser processes.
```bash
node benchmark.js 10
# or explicitly:
node benchmark.js 10 cdp
```
Output: `benchmark_results.csv`

### Launch mode — fresh browser process per iteration
Measures cold-start overhead. Both Lightpanda (port 9224) and Chrome (port 9225) spin up a fresh Docker container each iteration and are torn down afterwards. Docker must be running; `docker compose up` is not required.
```bash
node benchmark.js 10 launch
```
Output: `benchmark_results_launch.csv`

## 4. View Results
Both CSV files use semicolons (`;`) for columns and commas (`,`) for decimals, making them ready to import directly into Excel or Google Sheets. The column schema is identical across both modes, so the same notebook template works for both.

## Cleanup
When you are done testing, you can stop and remove the Docker containers:
```bash
docker compose down
```