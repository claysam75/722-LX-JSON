# 722 Parser

Express server that bridges HTTP requests to OSC messages for a Chamsys lighting controller. State is persisted to `state.json` and broadcast to connected web gui clients via Socket.IO.

- **HTTP port:** 4002
- **OSC target:** 127.0.0.1:8001

## Running in dev

npm install

npm run dev

Accessible at http://ip:4002

````

---

## Chamsys Zone Mapping

| Zone | Area |
|------|------|
| 5 | Sun Deck |
| 2 | Main Deck |
| 3 | Lower Deck |
| 4 | Underwater |

---

## Endpoints

### `GET /`

Returns all current states as a JSON array.

---

### `GET /state?id=EVERYTHING`

Returns feedback payloads (`Target`, `Info`, `State`) for the discrete lighting targets only.

- `id=EVERYTHING` — returns one payload per target below, in order.
- `id=<TARGET>` — returns payload(s) for just that target.

**Targets:**
- `POOL`
- `WHIRLPOOL`
- `YACHT NAME` *(returns two payloads — see below)*
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

**`YACHT NAME` payloads:**

`YACHT NAME` always produces two entries — one for the upper deck stbd name, and one reflecting the hull door position:
```json
{ "Target": "YACHT NAME", "Info": "UD SB", "State": "ON" }
{ "Target": "YACHT NAME", "Info": "HULL DOOR CLOSED", "State": "ON" }
````

---

### `POST /eventmode`

Enables or disables a Chamsys zone. Event mode ON disables the zone; event mode OFF enables it.

**Request body:**

```json
{
  "Target": "EVENT MODE SD",
  "State": "ON | OFF"
}
```

**Targets:**

| Target          | Zone                |
| --------------- | ------------------- |
| `EVENT MODE SD` | Zone 5 — Sun Deck   |
| `EVENT MODE MD` | Zone 2 — Main Deck  |
| `EVENT MODE LD` | Zone 3 — Lower Deck |
| `EVENT MODE UW` | Zone 4 — Underwater |

---

### `POST /toggle`

Toggles a target between ON and OFF.

**Request body:**

```json
{
  "Target": "POOL",
  "Info": ""
}
```

**Targets:**

- `POOL`
- `WHIRLPOOL`
- `YACHT NAME`
- `UNDERWATER ALL`
- `UNDERWATER STERN`
- `UNDERWATER AFT PS`
- `UNDERWATER AFT SB`
- `UNDERWATER MID PS`
- `UNDERWATER MID SB`
- `UNDERWATER FWD`
- `UNDERWATER UP BOW`

---

### `POST /set`

Sets a target to an explicit ON or OFF state.

**Request body:**

```json
{
  "Target": "SUN DECK FWD SPOTS",
  "State": "ON | OFF",
  "Info": ""
}
```

**Targets:**

- `SUN DECK FWD SPOTS`
- `SUN DECK FWD STRIPS`
- `MAIN DECK AFT SPOTS POOL AND TABLE`
- `MAIN DECK AFT SPOTS`
- `MAIN DECK AFT STRIPS`
- `MAIN DECK COURTESY SPOTS`

---

### `POST /colour`

Sets the colour for a target. Optionally scoped to a subzone.

**Request body:**

```json
{
  "Target": "POOL",
  "Colour": 1,
  "Subzone": 0
}
```

**Targets:**

- `POOL`
- `WHIRLPOOL`
- `YACHT NAME`
- `UNDERWATER ALL`
- `SUN DECK EXTERIOR FWD`
- `MAIN DECK EXTERIOR AFT`
- `LOWER DECK WET AREA`

**Colour indexes:**

| Index | Name      | Hex       |
| ----- | --------- | --------- |
| 1     | Red       | `#FF0000` |
| 2     | Green     | `#00FF00` |
| 3     | Blue      | `#0000FF` |
| 4     | Yellow    | `#FFFF00` |
| 5     | Cyan      | `#00FFFF` |
| 6     | Magenta   | `#FF00FF` |
| 7     | White     | `#FFFFFF` |
| 8     | Orange    | `#FFA500` |
| 9     | Purple    | `#800080` |
| 10    | Pink      | `#FFC0CB` |
| 11    | Lime      | `#00FF00` |
| 12    | Teal      | `#008080` |
| 13    | Lavender  | `#E6E6FA` |
| 14    | Turquoise | `#40E0D0` |

**Subzone values:** `0–4` (0 = all subzones)

---

### `POST /intensity`

Sets the intensity for a target. Setting intensity to `0` also sets the state to OFF. Optionally scoped to a subzone.

**Request body:**

```json
{
  "Target": "POOL",
  "Intensity": "75",
  "Subzone": 0
}
```

**Targets:** same as `/colour`

**Intensity values:** `100`, `75`, `50`, `25`, `0`

---

## Socket.IO Events

| Event          | Direction       | Payload                                             |
| -------------- | --------------- | --------------------------------------------------- |
| `state:all`    | Server → Client | Array of all current states (emitted on connection) |
| `state:update` | Server → Client | Single updated state object                         |
| `log`          | Server → Client | `{ message, timestamp }`                            |

---

## State Object Shape

```json
{
  "Target": "POOL",
  "Info": "",
  "State": "OFF",
  "Scene": "",
  "Colour": "",
  "Intensity": ""
}
```

Special targets have reduced shapes:

```json
{ "Target": "FIRE ALARM", "State": "SILENT" }
{ "Target": "HULL DOOR",  "State": "CLOSED" }
{ "Target": "EVENT MODE MD", "State": "OFF" }
```
