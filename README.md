# Grab history export

Download your **whole Grab booking history** (rides, GrabFood, GrabMart, GrabExpress and the rest) as a CSV and JSON file, in one command.

The Grab app and help centre only let you look back a few months, one receipt at a time. This script makes the same request as Grab's own help page, [Retrieve detailed Grab transaction history](https://help.grab.com/passenger/en-th/360038782911-Retrieve-detailed-Grab-transaction-history), one month at a time, and asks for up to a year back.

**Older bookings are incomplete.** Grab's help page says the history covers the past 6 months, up to 300 transactions per download. The endpoint answers for windows up to a year back, but tested on the author's account:

- **GrabFood and GrabMart:** only about the last 6 to 7 months come back. Nothing older is returned, whatever the window.
- **Rides:** about a year comes back, with gaps. Some bookings on the bank statement are not returned at all.
- **Smaller windows don't help:** asking day by day returns exactly what one month at a time does.
- **No single-booking lookup:** there is no known endpoint to fetch one booking by its id.
- **Not anonymised:** what does come back carries full fields.

So run it at least every 6 months to keep your food orders, and cross-check older months against your bank if completeness matters.

Useful for:

- expense reports and taxes
- splitting rides and food orders in a budget
- seeing how much you spend on GrabFood vs rides, per year and currency
- moving your data into a spreadsheet or finance app

Unofficial and not affiliated with Grab.

## What you get

`grab-history.csv` and `grab-history.json`, one row per booking:

| Column | Example |
|---|---|
| `id` | `A-8OERXVXWWKEDAV` (the booking id, also on your bank or card statement) |
| `dateTime` | `2025-12-18T10:16:00Z` |
| `type` | `transport`, `food`, `mart`, ... |
| `taxiType` | `GrabBike`, `GrabCar`, `Standard`, `GrabFood`, `GrabMart`, ... |
| `receiptType` | `Personal` or `Business` |
| `currency`, `amount` | `IDR`, `15500.00` |
| `pickUpLocation`, `dropOffLocation` | restaurant or shop for food/mart; places for rides (leave out with `--no-locations`) |

It also prints a summary per year, type and currency.

## Use it

You need [Node.js](https://nodejs.org) 18 or newer. No other dependencies.

1. **Get your token.** Log in at [help.grab.com](https://help.grab.com) in Chrome or another desktop browser and open your booking history (the "past bookings" list). Open the developer tools (`Cmd+Option+I` on Mac, `F12` on Windows), go to the **Network** tab, and click the request named `bookinghistory`. Under **Request Headers**, copy the value of `authorization` after `Bearer `. It is a long string starting with `eyJ`. It lasts about two hours.
2. **Run the script:**

   ```bash
   git clone https://github.com/Manoj-nathwani/grab-history-export.git
   cd grab-history-export
   GRAB_TOKEN='eyJ...' node grab-history.mjs
   ```

   On Windows PowerShell: `$env:GRAB_TOKEN='eyJ...'; node grab-history.mjs`

3. Open `grab-history.csv`.

### Options

| Option | Default | Meaning |
|---|---|---|
| `--months N` | `13` | How many calendar months back to ask for. The script stops at Grab's 365-day limit anyway. |
| `--out NAME` | `grab-history` | Output file name, without extension. |
| `--no-locations` | off | Leave pick-up and drop-off places out of the files. |

## Keep your token private

The token is your logged-in Grab session. Anyone who has it can act as you on Grab until it expires.

- Pass it only as the `GRAB_TOKEN` environment variable. Never paste it into an issue, a commit or a chat.
- The script sends it only to `api.grab.com`, the same place the help centre sends it.
- Your downloaded files hold your personal travel history. `.gitignore` keeps them out of git.

## How it works

`help.grab.com` loads your past bookings from `POST https://api.grab.com/helpcenter/v1/passengers/bookinghistory` with a date range in the body. The site only asks for recent months; the endpoint answers any range that starts within the last 365 days, and returns an error for anything older. Answering is not the same as complete: see the caveat at the top. The script asks for one calendar month per request, newest first, cuts the oldest window to start exactly 365 days ago, stops there, and merges the results by booking id.

If Grab changes the endpoint, the script will stop working. Issues and pull requests are welcome.

## Licence

MIT
