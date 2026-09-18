# 722 Parser

Express server that bridges HTTP requests to OSC messages for a ChamSys lighting controller. State is persisted to `state/state.json`, broadcast to connected web GUI clients via Socket.IO, and pushed to an external feedback endpoint after every change.

- **HTTP port:** 4002
- **OSC target:** `127.0.0.1:8000` (`OSC_TARGET` / `OSC_PORT` in `constants.js`)
- **External feedback:** `POST http://10.50.40.103/cws/dmxpc/state?payload=TypeA`

## Running

```
npm install
npm run dev      # nodemon, ignores state/
npm start        # node server.js
```

Accessible at `http://<ip>:4002`.

- **Windows service:** `node install-windows-service.js` / `node uninstall-windows-service.js` (node-windows; edit the `script` path in the installer first).
- **Docker:** `Dockerfile` builds a `node:18-alpine` image exposing 4002.

## Web pages

| Path             | Purpose                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `/control.html`  | Live state + controls for every endpoint, with a filterable log (feedback / clients / OSC)        |
| `/diagrams.html` | Read-only system reference: OSC address tables and logic diagrams (linked from the control page) |

The `HULL DOOR` target is shown as **Guest Entrance** in the GUI; the backend name is unchanged.

---

## Files

| File                | Purpose                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `server.js`         | Express routes, Socket.IO, OSC dispatch, automation (door → name light, LD door spots) |
| `constants.js`      | Target lists, OSC address tables, vessel preset sequences, colour names                 |
| `state.js`          | In-memory state map with atomic persistence to `state/state.json`                      |
| `oscClient.js`      | UDP OSC sender (`osc` library, local port 57121)                                        |

---

## ChamSys zone mapping (event mode)

| Zone | Area       |
| ---- | ---------- |
| 1    | Sun Deck   |
| 2    | Main Deck  |
| 3    | Lower Deck |
| 4    | Underwater |

---

## Target aliases

Incoming `Target` values (request body and `GET /state?id=`) are normalised before handling:

| Incoming     | Canonical        |
| ------------ | ---------------- |
| `UNDERWATER` | `UNDERWATER ALL` |

---

## Endpoints

All `POST` endpoints take a JSON body, save the new state, broadcast `state:update` over Socket.IO, and (except `/eventmode`) push feedback payloads to the external endpoint. Invalid targets/states return `400 { error }`.

### `GET /`

Returns all current state objects as a JSON array.

---

### `GET /state?id=EVERYTHING`

Returns feedback payloads (`Target`, `Info`, `State`) for the feedback targets. Also triggers a push to the external endpoint.

- `id=EVERYTHING` — one payload per target below, in order.
- `id=<TARGET>` — payload(s) for just that target.

**Feedback targets:**

- `POOL`
- `WHIRLPOOL`
- `YACHT NAME` _(three payloads — see below)_
- `UNDERWATER ALL`
- `UNDERWATER STERN`
- `UNDERWATER AFT PS`
- `UNDERWATER AFT SB`
- `UNDERWATER MID PS`
- `UNDERWATER MID SB`
- `UNDERWATER FWD`
- `UNDERWATER UP BOW`
- `SUN DECK FWD SPOTS`
- `SUN DECK FWD STRIPS`
- `MAIN DECK AFT SPOTS POOL AND TABLE`
- `MAIN DECK AFT SPOTS`
- `MAIN DECK AFT STRIPS`
- `MAIN DECK COURTESY`
- `LD DOOR SPOTS`
- `LOWER DECK COURTESY`

**`YACHT NAME` payloads:**

```json
{ "Target": "YACHT NAME", "Info": "UD SB", "State": "ON" }
{ "Target": "YACHT NAME", "Info": "HULL DOOR CLOSED", "State": "ON" }
{ "Target": "YACHT NAME", "Info": "GUEST ENTRANCE", "State": "OFF" }
```

- `UD SB` — upper deck stbd name light.
- `HULL DOOR <OPEN|CLOSED>` — aft name light; the `Info` suffix reflects the current door position.
- `GUEST ENTRANCE` — side guest entrance name light, driven automatically by the door (see [Automation](#automation)).

---

### `POST /eventmode`

Enables or disables a ChamSys zone. Event mode ON disables the zone (`/zone/N/disable`); OFF re-enables it (`/zone/N/enable`). No external feedback push.

```json
{ "Target": "EVENT MODE SD", "State": "ON | OFF" }
```

| Target          | Zone |
| --------------- | ---- |
| `EVENT MODE SD` | 1    |
| `EVENT MODE MD` | 2    |
| `EVENT MODE LD` | 3    |
| `EVENT MODE UW` | 4    |

---

### `POST /toggle`

Flips a target between ON and OFF.

```json
{ "Target": "POOL", "Info": "" }
```

**Targets:** `POOL`, `WHIRLPOOL`, `YACHT NAME`, `UNDERWATER ALL`, `UNDERWATER STERN`, `UNDERWATER AFT PS`, `UNDERWATER AFT SB`, `UNDERWATER MID PS`, `UNDERWATER MID SB`, `UNDERWATER FWD`, `UNDERWATER UP BOW`

`YACHT NAME` toggles all three name lights together (`UD SB`, `HULL DOOR`, `GUEST ENTRANCE`), based on the current `UD SB` state. The response `State` is the new `UD SB` value.

---

### `POST /set`

Sets a target to an explicit state.

```json
{ "Target": "SUN DECK FWD SPOTS", "State": "ON | OFF", "Info": "" }
```

**ON / OFF targets:**

- `SUN DECK FWD SPOTS`
- `SUN DECK FWD STRIPS`
- `MAIN DECK AFT SPOTS POOL AND TABLE`
- `MAIN DECK AFT SPOTS`
- `MAIN DECK AFT STRIPS`
- `MAIN DECK COURTESY`
- `LOWER DECK COURTESY`
- `LD DOOR SPOTS` _(normally driven automatically — see [Automation](#automation))_

**Special targets:**

| Target       | States               | Notes                                                                                             |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------- |
| `FIRE ALARM` | `SILENT`, `SOUNDING` | State only, no OSC.                                                                               |
| `HULL DOOR`  | `OPEN`, `CLOSED`     | Guest entrance door sensor. Drives the `GUEST ENTRANCE` name light (see [Automation](#automation)). |
| `YACHT NAME` | `ON`, `OFF`          | `Info` selects the light: `UD SB`, or anything else (incl. blank) → `HULL DOOR` (aft name). `GUEST ENTRANCE` cannot be set directly. |

---

### `POST /scene`

Sets a scene for an area.

```json
{ "Target": "SUN DECK EXTERIOR FWD", "Scene": "ON | DIM | NIGHT | OFF" }
```

**Targets:** `SUN DECK EXTERIOR FWD`, `MAIN DECK EXTERIOR AFT`, `LOWER DECK WET AREA`, `VESSEL`

`LOWER DECK WET AREA` scenes re-evaluate the LD door spots.

**Vessel presets**

`Target: VESSEL` additionally accepts these scenes:

`ALL_ON`, `ALL_OFF`, `UNDERWAY`, `DOCK_GUESTS`, `DOCK_CREW`, `ANCHOR_GUESTS`, `ANCHOR_CREW`, `MAX_LIGHTING`, `HELI_OPS`, `PARTY`

Each preset fires a sequence of five OSC messages — one per area (`sd`, `md`, `name1`, `name2`, `ld`) — spaced `VESSEL_SCENE_OSC_GAP_MS` (100 ms) apart, e.g. `/v/uw/sd` … `/v/uw/ld`. The HTTP response is sent immediately; the sequence completes in the background. Addresses are in `VESSEL_SCENE_OSC` in `constants.js`; empty entries are skipped.

---

### `POST /colour`

Sets the colour for a target, optionally scoped to a subzone.

```json
{ "Target": "POOL", "Colour": 1, "Subzone": 0 }
```

**Targets:** `POOL`, `WHIRLPOOL`, `YACHT NAME`, `UNDERWATER ALL`, `SUN DECK EXTERIOR FWD`, `MAIN DECK EXTERIOR AFT`, `LOWER DECK WET AREA`

**Subzone:** `0` = all four subzones, `1–4` = individual. Subzone 0 writes the colour into every subzone in state.

**Colour indexes:** `1–20` are accepted; the named ones are:

| Index | Name       | Hex       |
| ----- | ---------- | --------- |
| 1     | Red        | `#FF0000` |
| 2     | Green      | `#00FF00` |
| 3     | Blue       | `#0000FF` |
| 4     | Yellow     | `#FFFF00` |
| 5     | Cyan       | `#00FFFF` |
| 6     | Magenta    | `#FF00FF` |
| 7     | White      | `#FFFFFF` |
| 8     | Warm White | `#f4ddb3` |
| 9     | Orange     | `#FFA500` |
| 10    | Purple     | `#800080` |
| 11    | Pink       | `#FFC0CB` |
| 12    | Lime       | `#00FF00` |
| 13    | Teal       | `#008080` |
| 14    | Lavender   | `#E6E6FA` |
| 15    | Turquoise  | `#40E0D0` |

**OSC mapping:** one executor page per target (POOL=3, WHIRLPOOL=4, YACHT NAME=5, UNDERWATER ALL=6, SUN DECK EXTERIOR FWD=7, MAIN DECK EXTERIOR AFT=8, LOWER DECK WET AREA=9). Within a page, subzone 1 colours are items 2–21, and each further subzone is +42 (subzone 2 = 44, 3 = 86, 4 = 128, all = 170). Full tables are in `COLOUR_OSC_MAPPINGS`.

---

### `POST /intensity`

Sets the intensity for a target, optionally scoped to a subzone. If every subzone ends up at `0` the target `State` becomes `OFF`, otherwise `ON`.

```json
{ "Target": "POOL", "Intensity": "75", "Subzone": 0 }
```

**Targets / Subzone:** same as `/colour`

**Intensity values:** `100`, `75`, `50`, `25`, `0`

**OSC mapping:** items 23–27 of the target's page for subzone 1 (0% → 23 … 100% → 27), same +42 offset per subzone. Full tables are in `INTENSITY_OSC_MAPPINGS`.

**Executors are toggles.** Colour and intensity executors on the ChamSys deactivate if fired while already active. When a request repeats the value already stored for that subzone, the server fires the executor twice (deactivate → activate) so the value is re-applied to every fixture.

---

## Automation

**Guest entrance door → name light.** `POST /set · HULL DOOR`:

- `OPEN` → `YACHT NAME.Lights["GUEST ENTRANCE"] = ON`, OSC `/exec/2/38`, then the stored `YACHT NAME` colours are re-asserted (all-subzone executor if every subzone matches, otherwise per subzone) so the guest entrance name comes up matching the other name lights.
- `CLOSED` → `GUEST ENTRANCE = OFF`, OSC `/exec/2/37`.

**LD door spots.** `syncLdDoorSpots()` runs after any `/scene`, `/colour` or `/intensity` request for `LOWER DECK WET AREA`. `LD DOOR SPOTS` is turned ON when the door is `OPEN` **and** the wet area is active (scene set and not `OFF`, or `State == ON`, or any colour subzone set); otherwise OFF. It is not re-evaluated on the door change itself.

---

## Socket.IO events

| Event          | Direction       | Payload                                                                                                                      |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `state:all`    | Server → Client | Array of all current states (emitted on connection)                                                                          |
| `state:update` | Server → Client | Single updated state object                                                                                                  |
| `log`          | Server → Client | `{ message, timestamp, group }` — `group` is shared by every line produced by one HTTP request or socket connection, including async lines (external push failures, vessel preset sequences); `null` otherwise |
| `log:history`  | Server → Client | Array of the last 500 log entries (emitted on connection)                                                                    |

---

## State object shape

Standard target:

```json
{ "Target": "SUN DECK FWD SPOTS", "Info": "", "State": "OFF", "Scene": "" }
```

Colour/intensity targets carry per-subzone maps:

```json
{
  "Target": "POOL",
  "Info": "",
  "State": "ON",
  "Scene": "",
  "Colours": { "1": 3, "2": 3, "3": 3, "4": 3 },
  "Intensities": { "1": "75", "2": "75", "3": "75", "4": "75" }
}
```

`YACHT NAME` additionally has a `Lights` map:

```json
"Lights": { "UD SB": "ON", "HULL DOOR": "ON", "GUEST ENTRANCE": "OFF" }
```

Special targets have reduced shapes:

```json
{ "Target": "FIRE ALARM", "State": "SILENT" }
{ "Target": "HULL DOOR", "State": "CLOSED" }
{ "Target": "EVENT MODE MD", "State": "OFF" }
```

State is written atomically (`state.json.tmp` → rename) on every change and restored on start-up; older files missing `Colours` / `Intensities` / `Lights` are migrated to the current shape on load.
