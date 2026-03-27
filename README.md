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
Run these two commands to spin up the isolated Docker containers for both browsers. 

[cite_start]**Start Lightpanda (Testing Platform 2) on Port 9222[cite: 22]:**
```bash
docker run -d --name lightpanda -p 9222:9222 lightpanda/browser:latest
```

[cite_start]**Start Google Chrome (Testing Platform 1) on Port 9223[cite: 21]:**
*(Note: This includes increased shared memory flags to prevent crashes during repetitive testing).*
```bash
docker run -d --name chrome --shm-size=1gb -p 9223:9222 zenika/alpine-chrome --no-sandbox --disable-dev-shm-usage --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222
```

## 3. Run the Benchmark
The benchmark script automatically starts a local web server on port 3000 to serve the static application and runs the Playwright test suite against both browsers.

Run the benchmark by specifying the number of iterations you want to perform:
```bash
node benchmark.mjs 10
```

## 4. View Results
Once finished, the script will output a `benchmark_results.csv` file in the root directory. This file uses semicolons (`;`) for columns and commas (`,`) for decimals, making it ready to import directly into Excel or Google Sheets for analysis.

## Cleanup
When you are done testing, you can stop and remove the Docker containers:
```bash
docker rm -f lightpanda chrome
```