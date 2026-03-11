# HiBob Attendance Filler

A Chrome extension that auto-fills missing attendance entries on [HiBob](https://app.hibob.com/attendance/my-attendance) with randomized work durations.

## Features

- **One-click fill** — fills all missing workdays in the current attendance cycle
- **Randomized durations** — each day gets a random duration between 9h00m and 10h00m (in 5-minute increments) to look natural
- **Configurable workdays** — choose which days of the week count as working days (defaults to Sunday–Thursday)
- **Auto-detects employee ID** — no manual configuration needed
- **Skips non-working days** — respects holidays and days already marked in HiBob

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `extension/` folder from this repository

The extension will persist across browser restarts. You only need to reload it if you update the code.

## Usage

### Filling Attendance

1. Log in to HiBob and go to [My Attendance](https://app.hibob.com/attendance/my-attendance)
2. A floating **"Attendance Filler"** panel appears in the top-right corner
3. Click **"Fill Missing Days"**
4. The extension fills each missing workday one at a time, showing progress
5. The page reloads automatically when done

### Configuring Workdays

1. Click the extension icon in Chrome's toolbar
2. Check/uncheck the days you normally work
3. Settings are saved automatically

## Project Structure

```
extension/
├── manifest.json   # Chrome extension manifest (Manifest V3)
├── constants.js    # Shared constants (storage keys, default workdays)
├── content.js      # Main logic: UI panel, day detection, API calls
├── styles.css      # Floating panel styles
├── popup.html      # Workday configuration popup
├── popup.js        # Popup logic and storage
├── icon.svg        # Source icon (clock + checkmark)
├── icon-16.png     # Toolbar icon
├── icon-48.png     # Extensions page icon
└── icon-128.png    # Chrome Web Store icon
```

## How It Works

1. **Day detection** — The content script parses the HiBob attendance table, looking for rows with a "missing attendance" indicator (gridcells with value "1") on configured workdays
2. **Duration generation** — For each missing day, a random duration between 540 and 600 minutes (9h–10h) is generated in 5-minute steps
3. **API call** — Each day is filled via a POST request to HiBob's internal attendance API:
   ```
   POST /api/attendance/employees/{employeeId}/attendance/entries?forDate=YYYY-MM-DD
   ```
   The request uses the browser's existing session cookies for authentication.

## Notes

- The extension only works when you are logged in to HiBob — it uses your existing browser session
- It only fills the currently visible attendance cycle (typically one month)
- Days marked as holidays, non-working days, or time off are automatically skipped
- If a fill fails for a specific day, the extension continues with the remaining days and reports the failure count
