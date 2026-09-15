# 722 Parser

Express server that bridges HTTP requests to OSC messages for a Chamsys lighting controller. State is persisted to `state.json` and broadcast to connected web gui clients via Socket.IO.

- **HTTP port:** 4002
- **OSC target:** 127.0.0.1:8001

## Running in dev

npm install

npm run dev

Accessible at http://ip:4002

---

## Chamsys Zone Mapping

| Zone | Area       |
| ---- | ---------- |
| 5    | Sun Deck   |
| 2    | Main Deck  |
| 3    | Lower Deck |
| 4    | Underwater |

---

## Area Hierarchy (`areas.json`)

`areas.json` is the single source of truth for which areas sit on which deck,
which commands each area answers to, and which groups it belongs to. Every
target list in `constants.js` is derived from it at start-up, so an area is
described in one place only.

Each area has:

| Field          | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `Target`       | The API target name used in request bodies                             |
| `Toggle`       | `Yes` if the area accepts `POST /toggle`                               |
| `Set`          | `Yes` if the area accepts `POST /set`                                  |
| `ColIntDirect` | `Yes` if the area accepts `POST /colour` and `POST /intensity` directly |
| `SceneMember`  | Scene group the area belongs to, or `""` for none                      |
| `ColIntMember` | Colour/intensity group the area belongs to, or `""` for none           |

Current structure:

| Deck       | Area                                 | Toggle | Set | Col/Int direct | Scene + Col/Int group  |
| ---------- | ------------------------------------ | ------ | --- | -------------- | ---------------------- |
| Sun Deck   | `WHIRLPOOL`                          | Yes    | No  | Yes            | SUN DECK EXTERIOR FWD  |
| Sun Deck   | `SUN DECK FWD SPOTS`                 | No     | Yes | No             | SUN DECK EXTERIOR FWD  |
| Sun Deck   | `SUN DECK FWD STRIPS`                | No     | Yes | No             | SUN DECK EXTERIOR FWD  |
| Main Deck  | `POOL`                               | Yes    | No  | Yes            | MAIN DECK EXTERIOR AFT |
| Main Deck  | `MAIN DECK AFT SPOTS POOL AND TABLE` | No     | Yes | No             | MAIN DECK EXTERIOR AFT |
| Main Deck  | `MAIN DECK AFT SPOTS`                | No     | Yes | No             | MAIN DECK EXTERIOR AFT |
| Main Deck  | `MAIN DECK AFT STRIPS`               | No     | Yes | No             | MAIN DECK EXTERIOR AFT |
| Main Deck  | `MAIN DECK COURTESY`                 | No     | Yes | No             | _none_                 |
| Lower Deck | `LOWER DECK WET AREA`                | No     | No  | Yes            | LOWER DECK WET AREA    |

`LOWER DECK WET AREA` names itself as its own group — it is both the group
target and the area that takes colour and intensity directly.

### What the hierarchy drives

- **Command validation.** A target is only accepted by `/toggle`, `/set`,
  `/colour`, `/intensity` and `/scene` if the hierarchy says it answers to that
  command. The request bodies, responses and error messages are unchanged.
- **Group commands flow down.** A scene, colour or intensity set on a group
  updates the state of every member of that group. A scene of `OFF`, or an
  intensity of `0`, turns its members `OFF`; any other value turns them `ON`.
  Members with no colour of their own (spots and strips) follow the on/off
  state only. An area with no group (`MAIN DECK COURTESY`) is never touched by
  a group command.
- **Member state rolls up.** A group reads `ON` while any of its members is
  `ON`, and `OFF` once they are all off.

Propagation is state only — the console already applies a group command to the
whole group, so no extra OSC messages are sent. `GET /state` therefore reports
what the lights are actually doing after a group command, rather than the last
value that area was given individually.

### Editing it

Add, move or re-flag an area in `areas.json` and restart — the target lists,
validation and propagation all follow. Targets outside the deck hierarchy
(yacht name, underwater, vessel, fire alarm, hull door, LD door spots) are
listed at the top of `constants.js`.

---

## Endpoints

### `GET /areas`

Returns the area hierarchy as loaded from `areas.json`, grouped by deck.

---

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
- `YACHT NAME` _(returns two payloads — see below)_
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

`YACHT NAME` always produces three entries — one for the upper deck stbd name, one for the aft name (reflecting the hull door position), and one for the guest entrance name light (driven by the side guest entrance hull door):

```json
{ "Target": "YACHT NAME", "Info": "UD SB", "State": "ON" }
{ "Target": "YACHT NAME", "Info": "HULL DOOR CLOSED", "State": "ON" }
{ "Target": "YACHT NAME", "Info": "GUEST ENTRANCE", "State": "OFF" }
```

The `GUEST ENTRANCE` light turns ON when the side guest entrance hull door opens, and OFF when it closes.

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
- `MAIN DECK COURTESY`

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
