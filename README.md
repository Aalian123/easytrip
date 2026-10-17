# EasyTrip — Fleet & Car Rental Management

A web platform where every vehicle, rider, assignment, inspection, accident,
maintenance event, fuel card and document has a **traceable digital history**
with exact dates and supporting evidence.

Built from the product brief in
`Product Requirements — Fleet & Car Rental Management.docx` (MVP Phase 1).

---

## Running it

Requirements: Node 20+, pnpm 10+, Docker.

```bash
pnpm install
cp env.example .env          # database URL, JWT secrets, ports
docker compose up -d         # postgres on 5433, adminer on 8081

pnpm --filter @easytrip/shared build
pnpm --filter @easytrip/api db:migrate
pnpm --filter @easytrip/api db:seed

pnpm dev                     # API on :3100 (docs at /docs), web on :3101
```

Seeded sign-ins (password `admin12345` unless changed in `.env`):

| Email | Role |
|---|---|
| admin@easytrip.local | Administrator |
| fleet@easytrip.local | Fleet manager |
| accounts@easytrip.local | Accounts |
| rider@easytrip.local | Rider (sees only their own records) |
| viewer@easytrip.local | Read only |

## Layout

```
apps/api        NestJS on Fastify, Prisma, PostgreSQL
apps/web        Next.js App Router, Tailwind, TanStack Query
packages/shared zod schemas, enums, and the rental and oil calculations
```

`packages/shared` holds every enum and schema once. The API validates with them
and the web forms reuse them, so a field is described in exactly one place. The
rental and oil-interval maths live there as pure functions, imported by both
sides rather than reimplemented.

## How the history guarantee works

Current state is derivable; history is not. Four mechanisms carry that:

1. **Append-only timelines.** Every state change writes a `VehicleEvent` (and
   where relevant a `RiderEvent`) inside the same transaction as the change.
   The vehicle timeline reads only from that table — it is never reconstructed
   from current state. Database triggers reject any update or delete.
2. **Audit trail.** A Prisma client extension records before/after JSON for
   every tracked write, attributed to the acting user. `AuditLog` is read-only
   to the whole application, enforced by a trigger rather than by convention.
3. **Frozen inspections.** A handover inspection is submitted, not saved as a
   draft. Once submitted the row cannot change — it is the evidence the return
   is compared against.
4. **One status chokepoint.** `VehicleStatusService.transition()` is the only
   code that writes `vehicle.status`. Illegal moves throw; every legal move
   lands on the timeline.

Business rules that must never be bypassed are enforced in the database as well
as in services: partial unique indexes guarantee one active assignment per
vehicle and one open holder per fuel card, so two racing requests cannot both
succeed.

## Evidence and documents

There are no file uploads. Photos, videos, receipts, invoices and documents are
**links** — paste a share URL from your own Google Drive, Dropbox or OneDrive.
The platform stores the URL, who added it, what it belongs to and (for
documents) when it expires. Whoever opens a link needs access to that folder in
the drive it lives in; the platform does not proxy or copy the file.

Only `http` and `https` links are accepted.

## Configuration, not conventions

Currency, currency symbol, the wording for rider identification (CNIC, national
ID, whatever applies), oil-change defaults and alert lead times all come from
the settings record and are editable by an administrator. No screen hardcodes a
country's conventions.

## Interface

The web app is built on shadcn/ui primitives (`apps/web/src/components/ui`) — Radix
behaviour with the easytrip palette applied: navy from the wordmark, the blue at
the top of the pin, the green of the road. One typeface, Plus Jakarta Sans, with
tabular figures wherever numbers sit in a column.

Navigation is grouped by the work rather than by the database: fleet, riders,
handovers, servicing, incidents, fuel, money, records. Groups remember whether
you left them open.

## Features and rollout order

Every part of the platform sits behind a feature switch, and the switches live
in `.env` — nothing in the running app can change them. That is deliberate: what
a client is shown in a demo is exactly what the API enforces, and it is the same
on every screen.

```bash
# everything (the default)
FEATURES=all

# or just the slice that is signed off
FEATURES=fleet,riders,documents,assignments,inspections

# or override one feature either way
FEATURE_REPORTS=true
```

Values accept `true/false`, `on/off`, `yes/no`, `1/0`. Restart the API after a
change. **Settings → Features** shows what is on, and the line to paste to change
each one.

A feature whose dependency was left out is dropped rather than half-working:
payments needs rentals, which needs assignments; fuel purchases need fuel cards;
condition checks need handovers.

Turn them on in this order as each part is accepted:

| Step | `FEATURES` entries | Why here |
|---|---|---|
| 1 | `fleet`, `riders` | The fleet and the people. Always on — every screen assumes them. |
| 2 | `documents` | Registration, insurance and licences, with the expiry dates step 8 reads. |
| 3 | `assignments`, `inspections` | The daily loop, and the checklists that make a return arguable. |
| 4 | `incidents` | Accidents and damage — needs handovers to attach them to. |
| 5 | `maintenance` | Servicing and oil, once real mileage is coming back from returns. |
| 6 | `fuelCards`, then `fuelTransactions` | Cards first; a purchase is checked against a card's limits. |
| 7 | `rentals`, then `payments` | Rates and charges before anything can be collected. |
| 8 | `alerts` | The daily sweep, once the data behind it is real. |
| 9 | `reports`, `audit` | Management reporting, when there is history worth reporting on. |

A sensible first demo is steps 1–3:

```bash
FEATURES=fleet,riders,documents,assignments,inspections
```

## Testing

```bash
pnpm --filter @easytrip/shared test   # rental brackets, oil intervals, fuel limits, URL safety
pnpm --filter @easytrip/api test      # vehicle status transition table
pnpm --filter @easytrip/api test:e2e  # business rules end to end
```

The end-to-end suite runs against its own database (`easytrip_test`, created
automatically on first run if it exists on the server) and asserts that each
business rule fails correctly: an unavailable vehicle cannot be assigned, a
second concurrent assignment is refused by both the service and the database, a
submitted inspection cannot be edited, maintenance records only accumulate, an
expired or blocked fuel card cannot be issued, a rider cannot read another
rider's records, and neither the audit log nor the vehicle timeline can be
rewritten.

Create the test database once with:

```bash
docker exec easytrip-db psql -U easytrip -d postgres -c 'CREATE DATABASE easytrip_test;'
```

## Alerts

A nightly job derives alerts from the fleet's own state: oil due, service due,
insurance, registration, licence and document expiry, overdue vehicles, fuel
card expiry, and fuel spend over a card's limit. Each alert carries a stable
dedupe key, so the sweep can be re-run at any time without duplicating anything.
Run it on demand from the API: `POST /notifications/generate`.

Email, SMS and WhatsApp delivery are deliberately out of scope for this phase —
alerts live in the app.

## Reports

Fourteen reports share one filter shape (date range, vehicle, rider, status) and
one route. Add `format=xlsx` or `format=pdf` to the same URL to download the
spreadsheet or the PDF instead of the JSON.
