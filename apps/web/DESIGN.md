---
name: easytrip
description: Fleet and rental operations UI. Navy, white and a road. One accent, one shape system, colour reserved for the state a vehicle is in.
---

# easytrip design system

The product is a working record: every vehicle, rider, handover, repair and
charge with the dates that prove it. The interface is a ledger people read all
day, so it is quiet by default. Colour is data, not decoration.

## Colours

Tokens live in `tailwind.config.ts`. Do not introduce hex values in components;
the only exception is `src/lib/status.ts`, which owns the state palette.

| Token | Hex | Used for |
|---|---|---|
| `canvas` | `#F1F5F9` | the page behind every panel |
| `surface` | `#FFFFFF` | panels, tables, forms |
| `sunken` | `#E8EEF5` | recesses: avatars, skeletons, hover fills |
| `navy` | `#0E2748` | headings, every button fill, the fleet band |
| `navy-soft` | `#1B3A63` | button hover |
| `ink` | `#14243A` | body text |
| `muted` | `#5B6F87` | labels and secondary text |
| `faint` | `#8E9FB3` | placeholders and empty values |
| `line` / `line-strong` | `#DFE6EE` / `#C9D4E0` | hairlines, control borders |
| `sky` | `#0B8BEE` | focus rings and the "on the road" state |
| `grass` | `#16A02E` | the "available" state |

**Navy is the only interactive colour.** Buttons, active navigation and the
fleet band are navy. Sky and grass appear only where a state is being reported:
a status chip, a plate chip edge, a lane of the road bar, a figure that has gone
wrong. A blue button and a green button on the same screen would make colour
mean two things at once.

State colours are defined once in `status.ts` (`VEHICLE_STATUS`, `RIDER_STATUS`,
`CARD_STATUS`) as a label, a text colour and a tint. Read them; never re-pick a
colour for a status inline.

## Type

One family, Plus Jakarta Sans, loaded through `next/font`. Weights 400 to 800.

| Role | Class | Notes |
|---|---|---|
| Page title | `text-xl font-bold text-navy` | one per screen |
| Section title | `text-sm font-bold text-navy` | use `<SectionTitle>` |
| Body | `text-sm text-ink` | 15px base, 13px in dense tables |
| Label | `text-xs text-muted` | never all caps |
| Figure | `tabular text-xl font-bold text-navy` | the road bar goes to `text-4xl` |

Numbers use tabular figures everywhere. `td` and `time` get them automatically;
add `.tabular` on any figure outside a table. Headings are sentence case. There
are no all-caps eyebrow labels and no em-dashes anywhere in the interface: use a
full stop, a comma or a colon.

## Shape and depth

One radius scale: controls and chips 8px (`rounded-md`), panels 12px
(`rounded-lg`), sheets and the fleet band 16px (`rounded-xl`), status labels 6px
(`rounded`). Nothing is a pill; nothing is square.

Depth comes from the surface ladder plus a hairline, not from shadows. Panels
sit flat on the canvas (`.panel`). `shadow-lift` is for something being picked
up; `shadow-pop` is for overlays only: dialogs, dropdowns, popovers, toasts.

## Components

- `.panel` (or `<Card>`) is the only container. Group rows inside it with
  `divide-y divide-line`, never with nested cards.
- `<DataTable>` owns the whole list: filters go in its `toolbar`, the count in
  its `summary`, and the empty case in `empty`. Filters do not float above it.
- `<Facts>` / `<Fact>` is the labelled-fact list down the side of every detail
  page. It renders a missing value as a faint "None" so columns stay readable.
- `<PlateChip>` names a vehicle everywhere in the product, with the state on its
  leading edge. `<StatusChip>` names a state in its own colour.
- `<RoadBar>` is the one bold object in the product: the fleet as a stretch of
  road, each lane sized by how many vehicles are in that state, with the day's
  figures in a strip beneath it. There is exactly one per screen, on the
  dashboard.
- Buttons: `default` (navy fill) for the action the page is for, `outline` for
  everything beside it, `ghost` for icons in chrome. One filled button per view.

## States

Every list has a loading skeleton shaped like its result, an empty state that
says what to do next, and inline errors under the field that caused them.
Toasts confirm in the same words as the button that was pressed. An empty value
is blank or a faint "None", never a dash that could be mistaken for a value.

## Copy

Plain, active, sentence case. Say what a thing is for the person doing the work:
"Out now", "Due back", "Not back on time". Errors say what happened and what to
do. Do not apologise, do not exclaim, and do not name database columns on
screen.
