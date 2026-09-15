# 722 LX — Incoming Command Checklist

Every command the server accepts, derived from `server.js` + `constants.js` (not the readme — see
[Readme discrepancies](#readme-discrepancies) at the bottom).

Base URL: `http://<host>:4002`

**147 command rows** — colour/intensity collapsed to one row per target × subzone — plus 4
behavioural checks at the end. Expanded across every colour index and intensity level, the
commands come to **952 discrete payloads**.

---

## 1. `GET /` — full state dump

- [ ] `GET /` → JSON array of all 28 state objects

---

## 2. `GET /state?id=<TARGET>` — feedback payloads

Valid ids are `EVERYTHING` plus the 18 `FEEDBACK_TARGETS`. Anything else → `400 Invalid target`.
Each call also fires the external state push to `http://10.50.40.103/cws/dmxpc/state?payload=TypeA`.

- [ ] `id=EVERYTHING` (returns 20 payloads — `YACHT NAME` expands to 3)
- [ ] `id=POOL`
- [ ] `id=WHIRLPOOL`
- [ ] `id=YACHT NAME` → 3 payloads: `UD SB`, `HULL DOOR <OPEN|CLOSED>`, `GUEST ENTRANCE`
- [ ] `id=UNDERWATER ALL`
- [ ] `id=UNDERWATER STERN`
- [ ] `id=UNDERWATER AFT PS`
- [ ] `id=UNDERWATER AFT SB`
- [ ] `id=UNDERWATER MID PS`
- [ ] `id=UNDERWATER MID SB`
- [ ] `id=UNDERWATER FWD`
- [ ] `id=UNDERWATER UP BOW`
- [ ] `id=SUN DECK FWD SPOTS`
- [ ] `id=SUN DECK FWD STRIPS`
- [ ] `id=MAIN DECK AFT SPOTS POOL AND TABLE`
- [ ] `id=MAIN DECK AFT SPOTS`
- [ ] `id=MAIN DECK AFT STRIPS`
- [ ] `id=MAIN DECK COURTESY`
- [ ] `id=LD DOOR SPOTS`

---

## 3. `POST /eventmode` — zone enable/disable

Body: `{ "Target": "...", "State": "ON" | "OFF" }`
ON = **disable** the Chamsys zone. OFF = **enable** it.

- [ ] `EVENT MODE SD` → `ON`  — `/zone/1/disable`
- [ ] `EVENT MODE SD` → `OFF` — `/zone/1/enable`
- [ ] `EVENT MODE MD` → `ON`  — `/zone/2/disable`
- [ ] `EVENT MODE MD` → `OFF` — `/zone/2/enable`
- [ ] `EVENT MODE LD` → `ON`  — `/zone/3/disable`
- [ ] `EVENT MODE LD` → `OFF` — `/zone/3/enable`
- [ ] `EVENT MODE UW` → `ON`  — `/zone/4/disable`
- [ ] `EVENT MODE UW` → `OFF` — `/zone/4/enable`

---

## 4. `POST /toggle` — flip ON ⇄ OFF

Body: `{ "Target": "...", "Info": "" }`. Non-`TOGGLE_TARGETS` → `400 Target cannot be toggled`.

- [ ] `POOL` → `/t/pool/1` | `/t/pool/0`
- [ ] `WHIRLPOOL` → `/t/whirl/1` | `/t/whirl/0`
- [ ] `YACHT NAME` → drives all three name lights at once: `/t/name/side/*`, `/t/name/aft/*`, `/t/name/guest/*`
- [ ] `UNDERWATER ALL` → `/t/uw-all/1` | `/t/uw-all/0`
- [ ] `UNDERWATER STERN` → `/t/uw-stern/1` | `/t/uw-stern/0`
- [ ] `UNDERWATER AFT PS` → `/t/uw-a-p/1` | `/t/uw-a-p/0`
- [ ] `UNDERWATER AFT SB` → `/t/uw-a-s/1` | `/t/uw-a-s/0`
- [ ] `UNDERWATER MID PS` → `/t/uw-m-p/1` | `/t/uw-m-p/0`
- [ ] `UNDERWATER MID SB` → `/t/uw-m-s/1` | `/t/uw-m-s/0`
- [ ] `UNDERWATER FWD` → `/t/uw-fwd/1` | `/t/uw-fwd/0`
- [ ] `UNDERWATER UP BOW` → `/t/uw-up-b/1` | `/t/uw-up-b/0`

---

## 5. `POST /set` — explicit state

Body: `{ "Target": "...", "State": "...", "Info": "" }`

### 5a. Special targets (handled before the `SET_TARGETS` check)

- [ ] `FIRE ALARM` → `SILENT` *(no OSC — state + feedback only)*
- [ ] `FIRE ALARM` → `SOUNDING` *(no OSC — state + feedback only)*
- [ ] `HULL DOOR` → `OPEN` — also sets `GUEST ENTRANCE` name light ON via `/exec/2/38`
- [ ] `HULL DOOR` → `CLOSED` — also sets `GUEST ENTRANCE` name light OFF via `/exec/2/37`
- [ ] `YACHT NAME` + `Info: "UD SB"` → `ON` → `/t/name/side/1`
- [ ] `YACHT NAME` + `Info: "UD SB"` → `OFF` → `/t/name/side/0`
- [ ] `YACHT NAME` + any other `Info` (aft / hull-door light) → `ON` → `/t/name/aft/1`
- [ ] `YACHT NAME` + any other `Info` (aft / hull-door light) → `OFF` → `/t/name/aft/0`

### 5b. Standard ON/OFF targets

- [ ] `SUN DECK FWD SPOTS` → `ON` — `/s/sd-f-sp/1`
- [ ] `SUN DECK FWD SPOTS` → `OFF` — `/s/sd-f-sp/0`
- [ ] `SUN DECK FWD STRIPS` → `ON` — `/s/sd-f-st/1`
- [ ] `SUN DECK FWD STRIPS` → `OFF` — `/s/sd-f-st/0`
- [ ] `MAIN DECK AFT SPOTS POOL AND TABLE` → `ON` — `/s/md-a-s-pt/1`
- [ ] `MAIN DECK AFT SPOTS POOL AND TABLE` → `OFF` — `/s/md-a-s-pt/0`
- [ ] `MAIN DECK AFT SPOTS` → `ON` — `/s/md-a-s/1`
- [ ] `MAIN DECK AFT SPOTS` → `OFF` — `/s/md-a-s/0`
- [ ] `MAIN DECK AFT STRIPS` → `ON` — `/s/md-a-st/1`
- [ ] `MAIN DECK AFT STRIPS` → `OFF` — `/s/md-a-st/0`
- [ ] `MAIN DECK COURTESY` → `ON` — `/s/md-a-c/1`
- [ ] `MAIN DECK COURTESY` → `OFF` — `/s/md-a-c/0`
- [ ] `LD DOOR SPOTS` → `ON` — `/s/ld-door-sp/1`
- [ ] `LD DOOR SPOTS` → `OFF` — `/s/ld-door-sp/0`

---

## 6. `POST /colour`

Body: `{ "Target": "...", "Colour": 1-20, "Subzone": 0-4 }`
`Subzone: 0` writes all four subzones. Every target has a full OSC map for zones 0–4 × colours 1–20.
Re-sending the colour already held sends the OSC address twice (deactivate + reactivate).

**`POOL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`WHIRLPOOL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`YACHT NAME`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`UNDERWATER ALL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`SUN DECK EXTERIOR FWD`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`MAIN DECK EXTERIOR AFT`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`LOWER DECK WET AREA`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

Colour indexes to sweep per row (20 each): 1–20.
Named in `COLOUR_MAPPINGS`: 1 Red, 2 Green, 3 Blue, 4 Yellow, 5 Cyan, 6 Magenta, 7 White,
8 Warm White, 9 Orange, 10 Purple, 11 Pink, 12 Lime, 13 Teal, 14 Lavender, 15 Turquoise.
**16–20 have OSC mappings but no name/hex entry.**

`LOWER DECK WET AREA` additionally re-runs the LD door-spot sync.

---

## 7. `POST /intensity`

Body: `{ "Target": "...", "Intensity": "100"|"75"|"50"|"25"|"0", "Subzone": 0-4 }`
All subzones at `0` sets the target `State` to `OFF`; anything else sets it `ON`.

**`POOL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`WHIRLPOOL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`YACHT NAME`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`UNDERWATER ALL`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`SUN DECK EXTERIOR FWD`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`MAIN DECK EXTERIOR AFT`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

**`LOWER DECK WET AREA`**
- [ ] Subzone 0 (all)
- [ ] Subzone 1
- [ ] Subzone 2
- [ ] Subzone 3
- [ ] Subzone 4

Levels to sweep per row (5 each): `100`, `75`, `50`, `25`, `0`.

`LOWER DECK WET AREA` additionally re-runs the LD door-spot sync.

---

## 8. `POST /scene`

Body: `{ "Target": "...", "Scene": "ON"|"DIM"|"NIGHT"|"OFF" }`

**`SUN DECK EXTERIOR FWD`**
- [ ] `ON` — `/exec/10/5`
- [ ] `DIM` — `/exec/10/4`
- [ ] `NIGHT` — `/exec/10/3`
- [ ] `OFF` — `/exec/10/2`

**`MAIN DECK EXTERIOR AFT`**
- [ ] `ON` — `/exec/10/10`
- [ ] `DIM` — `/exec/10/9`
- [ ] `NIGHT` — `/exec/10/8`
- [ ] `OFF` — `/exec/10/7`

**`LOWER DECK WET AREA`**
- [ ] `ON` — `/exec/10/15`
- [ ] `DIM` — `/exec/10/14`
- [ ] `NIGHT` — `/exec/10/13`
- [ ] `OFF` — `/exec/10/12`

**`VESSEL`**
- [ ] `ON` — `/exec/10/20`
- [ ] `DIM` — `/exec/10/19`
- [ ] `NIGHT` — `/exec/10/18`
- [ ] `OFF` — `/exec/10/17`

`LOWER DECK WET AREA` also re-runs the LD door-spot sync.

---

## 9. Socket.IO (inbound)

- [ ] `connection` — the only inbound event; server replies `state:all`. No inbound custom events are handled.

Outbound only: `state:all`, `state:update`, `log`.

---

## 10. Derived / non-HTTP behaviour to verify

Not commands, but triggered by the ones above — worth a pass each:

- [ ] **LD door-spot auto-sync** — `LD DOOR SPOTS` goes ON only when `HULL DOOR` is `OPEN`
      **and** `LOWER DECK WET AREA` is active (Scene ≠ OFF/blank, or State ON, or any colour set).
      Fires on `/scene`, `/colour`, `/intensity` for `LOWER DECK WET AREA`.
- [ ] **External state push** — every mutating endpoint plus `GET /state` POSTs the full feedback
      array to `http://10.50.40.103/cws/dmxpc/state?payload=TypeA`. Failures log a WARN only.
- [ ] **State persistence** — `state/state.json` rewritten atomically on every `setState`.

---

## Readme discrepancies

Worth resolving before using the readme as the test spec:

1. **`POST /scene` is undocumented** in the readme — 16 commands missing.
2. **`MAIN DECK COURTESY`** is the real target name; the readme's `/set` list says
   `MAIN DECK COURTESY SPOTS`. `TARGET_OSC_MAPPINGS` also still carries the `SPOTS` spelling.
3. **`LD DOOR SPOTS`** is a valid `/set` and `/state` target, absent from the readme.
4. **`FIRE ALARM`, `HULL DOOR`, `YACHT NAME`** are valid `/set` targets, absent from the readme.
5. **Event mode zones** — the readme maps SD→5, MD→2, LD→3, UW→4. The code sends
   `/zone/1/*` for SD, not `/zone/5/*`.
6. **Colour range** — readme lists 14; the code validates/maps 1–20 and names 15.
   Index 8 is Warm White in code, Orange in the readme (which shifts 9–14 by one).
7. **OSC target** — readme says `127.0.0.1:8001`; `constants.js` says `10.101.1.114:8000`.
