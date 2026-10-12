# G7 Marine Transport - Ticketing System

A static web app (no build step, no server needed) for booking seats on
MV Group 7 / MV G7 FastCraft, **Tilik (Lubang) <-> Wawa Port (Nasugbu)**.

## Run it

Open `index.html` in a browser. Or serve the folder:

```
python3 -m http.server 8000     # then visit http://localhost:8000
```

## Project layout (one concern per file)

| File | Responsibility |
|------|----------------|
| `index.html` | Page shell, loads scripts in dependency order |
| `css/styles.css` | Styling for the app screens (booking, tickets, office) and print rules |
| `css/home.css` | Site header + landing page styling |
| `css/booking.css` | Booking wizard, seat plan extras (aisle, labels) and ticket/confirmation styling |
| `js/icons.js` | Shared SVG icon set (`G7.icon('name')`) |
| `js/config.js` | Routes, default fares, seat layout (from your 4 deck images), PIN, out-of-service seats |
| `js/utils.js` | Formatting, toast, modal, CSV download |
| `js/storage.js` | **All persistence** (localStorage). Swap this file for a backend. |
| `js/trips.js` | Trip + seat availability logic (no DOM) |
| `js/seatmap.js` | Draws the seat plan from `config.sections` |
| `js/ticket.js` | Ticket cards, print, "My booking" lookup |
| `js/booking.js` | 4-step booking wizard: Choose trip, Pick seats (deck tabs), Passenger details, Review & confirm, then the confirmation ticket |
| `js/admin.js` | Ticket Office: dashboard, bookings, manifest, trip/seat control, fares, data |
| `js/home.js` | Landing page (hero, search box, destinations, routes, how it works, footer) |
| `js/app.js` | Hash router and nav (`#/home`, `#/book`, `#/ticket`, `#/office`) |

## Landing page photos

Landing page photos live in `assets/`. Replace a file with another image of the same name to change it:

- `assets/hero.jpg` (the banner: wide sea/boat photo used as the full hero background; already included)
- `assets/routes-bg.jpg` (optional: background for the Routes & Schedules section; if missing, a washed-out `hero.jpg` is used)
- `assets/card-book.jpg`, `assets/card-schedules.jpg`, `assets/card-booking.jpg` (photos for the three action cards; already included)

Phone, email, Facebook and YouTube links for the footer go in `contact` in `js/config.js`.
The Travel Advisory text (bar and popup) is `advisory` in the same file.
Also in `config.js`: `about` (About Us paragraph) and `legal` (Terms / Privacy / FAQ text; each link appears only once you fill it in).
Logo: `assets/logo.png` (transparent PNG, header) and `assets/logo-white.png` (light version for the dark sidebar and footer; `assets/favicon.png` is the tab icon). Optional: `assets/about-bg.jpg`, `assets/about-bg.jpg` (About Us background).

## Features

- Seat plan for Front, Mid, Aft and Upper decks (119 seats; 86-89 out of service)
- Fares: Regular 780, Student 670, Senior/PWD 650, Child 500, Infant 200 (editable in the office)
- Infants are lap passengers (no seat) and need an adult in the same booking
- Booking closes 60 minutes before departure (`bookingCutoffMinutes`)
- Seats are re-checked at confirmation so double-booking is prevented
- Ticket Office (PIN `1234` by default): sales dashboard, search/cancel/mark paid,
  printable manifest with boarding checkboxes, cancel trip / change time / block seats,
  CSV + JSON export, sample data loader

## Trips: add and reschedule

- Every route has a default trip each day (07:00 / 10:00, from `config.routes`).
- Ticket Office -> Trips & Seats -> **Add Trip** creates an extra departure (any date/route/time). Extra trips are stored under `g7.extraTrips`.
- The ⋮ menu on a trip changes its departure time and note, cancels/restores it, deletes an empty extra trip, or **reschedules** it to another date/time. Rescheduling moves its bookings (same seat numbers; blocked if a seat is not free on the new trip) and cancels the original.
- A new departure time also shows on that trip's existing tickets, so tell booked passengers.

## Blocking seats and maintenance

Ticket Office -> Trips & Seats -> **View Seats** (also the eye icon on the Dashboard). Pick a mode at the top:
- **Block / release (this trip):** blocks a seat for that one trip only.
- **Maintenance (all trips):** marks a seat out of service on every trip (stored under `g7.maintenance`; starts from `outOfService` in `config.js`). Refused if the seat has upcoming bookings.

Click seats to select them (blue), then **Save Changes**.

## Debugging tips

- Open DevTools (F12) -> Console. Modules log errors with a `[store]` / `[app]` prefix.
- Inspect or edit data: Application tab -> Local Storage -> keys starting with `g7.`
- Everything hangs off one global: type `G7` in the console to inspect `G7.config`, `G7.store`, `G7.trips`...
- Seat layout wrong? Edit only `sections` in `js/config.js`. Each row is 8 grid columns
  (numbers = seats, `null` = gap, `L('Text', span)` = label block).

## Known limits / assumptions

- **Data lives in one browser.** Different devices will not see each other's bookings.
  For real use, replace `js/storage.js` with calls to a backend (e.g. Supabase) so
  availability is shared.
- The office PIN is client-side and is **not real security**; a backend with proper auth is needed for production.
- No online payment: bookings start "Unpaid" and staff mark them paid.
- Ticket notes (`ticketNotes`), reminders (`reminders`) and ID types (`idTypes`) in `config.js` are placeholder wording; edit to match your real policies.
- Student and Senior/PWD passengers must enter an ID type and number in the wizard (checked against the ID at boarding).
- Assumptions to confirm: infants sit on laps, child/infant age rules, 60-minute booking
  cutoff, and the 07:00 / 10:00 departure times (taken from your screenshot, which says
  schedules vary by day and weather; use Trips & Seats to change a single day).
