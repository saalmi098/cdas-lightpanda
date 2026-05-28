###############
# Script to extract GitHub Actions metrics from a JSON file and save them to a CSV file.
# Script for querying GitHub Actions run data: gh api /repos/saalmi098/cdas-lightpanda/actions/runs/<RUN_ID>/jobs > run_data/metrics_chrome_run_<RUN_ID>.json
###############

import json
import csv
import os
from datetime import datetime

def calculate_duration(start_str, end_str):
    """Calculates the difference between two GitHub timestamps in seconds."""
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    start = datetime.strptime(start_str, fmt)
    end = datetime.strptime(end_str, fmt)
    return int((end - start).total_seconds())

def extract_metrics(json_path, csv_path, test_step_name="Run Playwright tests"):
    # Load the JSON data
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)

    # Determine the engine based on the filename
    engine_name = "Lightpanda" if "lightpanda" in json_path.lower() else "Google Chrome"

    # Assuming we are looking at the first job in the run
    job = data['jobs'][0]
    
    # Get high-level timestamps
    started_at = job['started_at']
    completed_at = job['completed_at']
    run_id = job['run_id']
    
    total_duration = calculate_duration(started_at, completed_at)
    
    execution_time = 0
    setup_overhead = 0
    teardown_overhead = 0
    found_test_step = False
    
    # Process each step
    for step in job['steps']:
        # Skip steps that might have been cancelled and lack timestamps
        if 'started_at' not in step or 'completed_at' not in step:
            continue
            
        step_duration = calculate_duration(step['started_at'], step['completed_at'])
        step_name = step['name']
        
        # print(f"Step: {step_name}, Duration: {step_duration} seconds")
        
        # Categorize into Setup, Execution, or Teardown
        if step_name == test_step_name:
            execution_time = step_duration
            found_test_step = True
            # print(f"✅ Found test step: '{test_step_name}' with duration {execution_time} seconds")
        elif not found_test_step:
            # Everything before the test step is considered setup overhead
            setup_overhead += step_duration
        else:
            # Everything after the test step is considered teardown/cleanup overhead
            teardown_overhead += step_duration

    # Prepare CSV headers and row data
    headers = [
        'engine',
        'run_id',
        'started_at', 
        'completed_at', 
        'total_duration_sec', 
        'setup_overhead_sec', 
        'execution_time_sec',
        'teardown_overhead_sec'
    ]
    
    row_data = {
        'engine': engine_name,
        'run_id': run_id,
        'started_at': started_at,
        'completed_at': completed_at,
        'total_duration_sec': total_duration,
        'setup_overhead_sec': setup_overhead,
        'execution_time_sec': execution_time,
        'teardown_overhead_sec': teardown_overhead,
    }

    # Check if the file already exists before we open it
    file_exists = os.path.isfile(csv_path)

    # Write to CSV using semicolon delimiter in APPEND mode ('a')
    with open(csv_path, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter=';')
        
        # Only write the header if the file is completely new
        if not file_exists:
            writer.writeheader()
            
        writer.writerow(row_data)
        
    print(f"✅ Extracted metrics for {engine_name} successfully saved to: {csv_path}")

# --- Run the extraction for all files in run_data_folder ---
run_data_folder = '01_TodoMVC_3_tests/run_data'
csv_output_file = '01_TodoMVC_3_tests/pipeline_metrics.csv'

# Check if the folder actually exists to prevent errors
if os.path.exists(run_data_folder):
    print(f"📂 Found '{run_data_folder}' folder. Starting extraction...\n")
    
    # Loop through every file in the directory
    for filename in os.listdir(run_data_folder):
        
        # We only care about JSON files
        if filename.endswith('.json'):
            # Create the full path (e.g., 'run_data/metrics_chrome.json')
            full_json_path = os.path.join(run_data_folder, filename)
            
            print(f"⏳ Processing: {filename}")
            
            # Run your existing function on this specific file
            extract_metrics(
                json_path=full_json_path, 
                csv_path=csv_output_file,
                test_step_name='Run Playwright tests'  # Change if your Chrome job names it differently
            )
            print("-" * 40) # Just a visual separator for the console output
            
    print("🎉 All files have been processed and appended to your CSV!")
else:
    print(f"❌ Error: Could not find the folder named '{run_data_folder}'. Please ensure it exists in the same directory as this script.")