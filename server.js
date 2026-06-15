const express = require("express");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const http = require("http");
const { sendOSC2, sendOSC } = require("./oscClient");
const { getState, setState, getAllStates, loadState } = require("./state");
const {
  SET_TARGETS,
  TOGGLE_TARGETS,
  COLOUR_INTENSITY_TARGETS,
  COLOUR_OSC_MAPPINGS,
  INTENSITY_OSC_MAPPINGS,
  SUBZONE_COUNT,
  SCENE_TARGETS,
  SCENES,
  FEEDBACK_TARGETS,
} = require("./constants");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());
app.use(express.static("public"));
const PORT = 4002;

loadState();

function broadcastStateUpdate(target) {
  io.emit("state:update", getState(target));
}

function log(message) {
  console.log(message);
  io.emit("log", { message, timestamp: new Date().toISOString() });
}

io.on("connection", (socket) => {
  log("New client connected");
  socket.emit("state:all", getAllStates());
});

app.get("/", (req, res) => {
  return res.json(getAllStates());
});

function buildFeedbackPayloads(target) {
  const current = getState(target);
  if (!current) return [];

  if (target === "YACHT NAME") {
    const hullDoorState = getState("HULL DOOR")?.State || "CLOSED";
    const lights = current.Lights || {};
    return [
      { Target: "YACHT NAME", Info: "UD SB", State: lights["UD SB"] || "OFF" },
      {
        Target: "YACHT NAME",
        Info: `HULL DOOR ${hullDoorState}`,
        State: lights["HULL DOOR"] || "OFF",
      },
    ];
  }

  return [{ Target: target, Info: current.Info || "", State: current.State }];
}

app.get("/state", (req, res) => {
  const { id = "EVERYTHING" } = req.query;

  if (id !== "EVERYTHING" && !FEEDBACK_TARGETS.includes(id)) {
    return res.status(400).json({ error: "Invalid target" });
  }

  const targets = id === "EVERYTHING" ? FEEDBACK_TARGETS : [id];
  const payloads = targets.flatMap(buildFeedbackPayloads);

  log(`State feedback request: ${id}`);

  res.json(payloads);
});

app.post("/eventmode", (req, res) => {
  const { Target, State = "" } = req.body;
  log(`Event mode request: ${Target} → ${State}`);

  //event mode ON = disable zone in chamsys
  //event mode OFF = enable zone in chamsys

  if (!["ON", "OFF"].includes(State)) {
    return res.status(400).json({ error: "Invalid state" });
  }
  setState(Target, { State });

  //send OSC message
  switch (Target) {
    case "EVENT MODE SD":
      if (State === "OFF") {
        sendOSC("/zone/1/enable", []);
        log("OSC: zone/1 enabled (SD event mode OFF)");
      } else {
        sendOSC("/zone/1/disable", []);
        log("OSC: zone/1 disabled (SD event mode ON)");
      }
      break;
    case "EVENT MODE MD":
      if (State === "OFF") {
        sendOSC("/zone/2/enable", []);
        log("OSC: zone/2 enabled (MD event mode OFF)");
      } else {
        sendOSC("/zone/2/disable", []);
        log("OSC: zone/2 disabled (MD event mode ON)");
      }
      break;
    case "EVENT MODE LD":
      if (State === "OFF") {
        sendOSC("/zone/3/enable", []);
        log("OSC: zone/3 enabled (LD event mode OFF)");
      } else {
        sendOSC("/zone/3/disable", []);
        log("OSC: zone/3 disabled (LD event mode ON)");
      }
      break;
    case "EVENT MODE UW":
      if (State === "OFF") {
        sendOSC("/zone/4/enable", []);
        log("OSC: zone/4 enabled (UW event mode OFF)");
      } else {
        sendOSC("/zone/4/disable", []);
        log("OSC: zone/4 disabled (UW event mode ON)");
      }
      break;
    default:
      log(`WARN: No OSC mapping for event mode target: ${Target}`);
  }

  broadcastStateUpdate(Target);

  res.json({ Target, State: State });
});

app.post("/toggle", (req, res) => {
  const { Target, Info = "" } = req.body;
  log(`Toggle request: ${Target} (info: ${Info})`);

  if (!getState(Target)) {
    return res.status(400).json({ error: "Invalid target" });
  }

  if (!TOGGLE_TARGETS.includes(Target)) {
    return res.status(400).json({ error: "Target cannot be toggled" });
  }

  if (Target === "YACHT NAME") {
    const lights = { ...getState("YACHT NAME").Lights };
    const turningOn = lights["UD SB"] !== "ON";
    const doorClosed = getState("HULL DOOR")?.State === "CLOSED";

    lights["UD SB"] = turningOn ? "ON" : "OFF";
    sendOSC(turningOn ? "/t/name/side/1" : "/t/name/side/0", []);

    if (turningOn && doorClosed) {
      lights["HULL DOOR"] = "ON";
      sendOSC("/t/name/aft/1", []);
      log("OSC: yacht name ON (all names, hull door closed)");
    } else if (turningOn) {
      log("OSC: yacht name ON (UD SB only, hull door open)");
    } else {
      lights["HULL DOOR"] = "OFF";
      sendOSC("/t/name/aft/0", []);
      log("OSC: yacht name OFF (all names)");
    }

    setState("YACHT NAME", { Lights: lights });
    broadcastStateUpdate("YACHT NAME");
    return res.json({ Target, State: lights["UD SB"], Info });
  }

  const current = getState(Target);

  const newState = current.State === "ON" ? "OFF" : "ON";
  setState(Target, { State: newState });

  switch (Target) {
    case "POOL":
      if (newState === "ON") {
        sendOSC("/t/pool/1", []);
        log("OSC: pool ON");
      } else {
        sendOSC("/t/pool/0", []);
        log("OSC: pool OFF");
      }
      break;
    case "WHIRLPOOL":
      if (newState === "ON") {
        sendOSC("/t/whirl/1", []);
        log("OSC: whirlpool ON");
      } else {
        sendOSC("/t/whirl/0", []);
        log("OSC: whirlpool OFF");
      }
      break;
    case "UNDERWATER ALL":
      if (newState === "ON") {
        sendOSC("/t/uw-all/1", []);
        log("OSC: underwater all ON");
      } else {
        sendOSC("/t/uw-all/0", []);
        log("OSC: underwater all OFF");
      }
      break;
    case "UNDERWATER STERN":
      if (newState === "ON") {
        sendOSC("/t/uw-stern/1", []);
        log("OSC: underwater stern ON");
      } else {
        sendOSC("/t/uw-stern/0", []);
        log("OSC: underwater stern OFF");
      }
      break;
    case "UNDERWATER AFT PS":
      if (newState === "ON") {
        sendOSC("/t/uw-a-p/1", []);
        log("OSC: underwater aft PS ON");
      } else {
        sendOSC("/t/uw-a-p/0", []);
        log("OSC: underwater aft PS OFF");
      }
      break;
    case "UNDERWATER AFT SB":
      if (newState === "ON") {
        sendOSC("/t/uw-a-s/1", []);
        log("OSC: underwater aft SB ON");
      } else {
        sendOSC("/t/uw-a-s/0", []);
        log("OSC: underwater aft SB OFF");
      }
      break;
    case "UNDERWATER MID PS":
      if (newState === "ON") {
        sendOSC("/t/uw-m-p/1", []);
        log("OSC: underwater mid PS ON");
      } else {
        sendOSC("/t/uw-m-p/0", []);
        log("OSC: underwater mid PS OFF");
      }
      break;
    case "UNDERWATER MID SB":
      if (newState === "ON") {
        sendOSC("/t/uw-m-s/1", []);
        log("OSC: underwater mid SB ON");
      } else {
        sendOSC("/t/uw-m-s/0", []);
        log("OSC: underwater mid SB OFF");
      }
      break;
    case "UNDERWATER FWD":
      if (newState === "ON") {
        sendOSC("/t/uw-fwd/1", []);
        log("OSC: underwater fwd ON");
      } else {
        sendOSC("/t/uw-fwd/0", []);
        log("OSC: underwater fwd OFF");
      }
      break;
    case "UNDERWATER UP BOW":
      if (newState === "ON") {
        sendOSC("/t/uw-up-b/1", []);
        log("OSC: underwater up bow ON");
      } else {
        sendOSC("/t/uw-up-b/0", []);
        log("OSC: underwater up bow OFF");
      }
      break;
    default:
      log(`WARN: No OSC mapping for toggle target: ${Target}`);
  }

  broadcastStateUpdate(Target);

  //send OSC message
  // toggle zone

  res.json({ Target, State: newState, Info });
});

app.post("/set", (req, res) => {
  const { Target, Info, State } = req.body;
  log(`Set request: ${Target} → ${State}${Info ? ` (${Info})` : ""}`);

  if (Target === "FIRE ALARM") {
    if (!["SILENT", "SOUNDING"].includes(State)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    setState(Target, { State });
    res.json({ Target, State });
    return;
  }

  if (Target === "HULL DOOR") {
    if (!["OPEN", "CLOSED"].includes(State)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    setState(Target, { State });
    res.json({ Target, State });

    const lights = { ...getState("YACHT NAME").Lights };

    if (State === "OPEN") {
      if (lights["HULL DOOR"] === "ON") {
        lights["HULL DOOR"] = "OFF";
        sendOSC("/t/name/aft/0", []);
        log("OSC: yacht name hull-door light OFF (hull door opened)");
        setState("YACHT NAME", { Lights: lights });
        broadcastStateUpdate("YACHT NAME");
      }
    } else {
      if (lights["UD SB"] === "ON" && lights["HULL DOOR"] !== "ON") {
        lights["HULL DOOR"] = "ON";
        sendOSC("/t/name/aft/1", []);
        log(
          "OSC: yacht name hull-door light restored ON (hull door closed, UD SB on)",
        );
        setState("YACHT NAME", { Lights: lights });
        broadcastStateUpdate("YACHT NAME");
      }
    }
    return;
  }

  if (Target === "YACHT NAME") {
    if (!["ON", "OFF"].includes(State)) {
      return res.status(400).json({ error: "Invalid state" });
    }

    const lightKey = Info === "UD SB" ? "UD SB" : "HULL DOOR";
    const lights = { ...getState("YACHT NAME").Lights };

    if (
      lightKey === "HULL DOOR" &&
      State === "ON" &&
      getState("HULL DOOR")?.State === "OPEN"
    ) {
      log("Ignored: hull-door name light ON request while HULL DOOR is OPEN");
      return res.json({ Target, Info, State: lights["HULL DOOR"] });
    }

    lights[lightKey] = State;
    setState("YACHT NAME", { Lights: lights });

    if (lightKey === "UD SB") {
      sendOSC(State === "ON" ? "/t/name/side/1" : "/t/name/side/0", []);
      log(`OSC: yacht name UD SB ${State}`);
    } else {
      sendOSC(State === "ON" ? "/t/name/aft/1" : "/t/name/aft/0", []);
      log(`OSC: yacht name hull-door light ${State}`);
    }

    broadcastStateUpdate("YACHT NAME");
    return res.json({ Target, Info, State });
  }

  if (!getState(Target)) {
    return res.status(400).json({ error: "Invalid target" });
  }

  if (!["ON", "OFF"].includes(State)) {
    return res.status(400).json({ error: "Invalid state" });
  }

  if (!SET_TARGETS.includes(Target)) {
    return res.status(400).json({ error: "Target cannot be set" });
  }

  setState(Target, { State, Info });

  switch (Target) {
    case "SUN DECK FWD SPOTS":
      if (State == "ON") {
        sendOSC("/s/sd-f-sp/1");
        log("OSC: Sun Deck Fwd Spots ON");
      } else {
        sendOSC("/s/sd-f-sp/0");
        log("OSC: Sun Deck Fwd Spots OFF");
      }
      break;
    case "SUN DECK FWD STRIPS":
      if (State == "ON") {
        sendOSC("/s/sd-f-st/1");
        log("OSC: Sun Deck Fwd Strips ON");
      } else {
        sendOSC("/s/sd-f-st/0");
        log("OSC: Sun Deck Fwd Strips OFF");
      }
      break;
    case "MAIN DECK AFT SPOTS POOL AND TABLE":
      if (State == "ON") {
        sendOSC("/s/md-a-s-pt/1");
        log("OSC: Main Deck Aft Spots Pool/Table ON");
      } else {
        sendOSC("/s/md-a-s-pt/0");
        log("OSC: Main Deck Aft Spots Pool/Table OFF");
      }
      break;
    case "MAIN DECK AFT SPOTS":
      if (State == "ON") {
        sendOSC("/s/md-a-s/1");
        log("OSC: Main Deck Aft Spots ON");
      } else {
        sendOSC("/s/md-a-s/0");
        log("OSC: Main Deck Aft Spots OFF");
      }
      break;
    case "MAIN DECK AFT STRIPS":
      if (State == "ON") {
        sendOSC("/s/md-a-st/1");
        log("OSC: Main Deck Aft Strips ON");
      } else {
        sendOSC("/s/md-a-st/0");
        log("OSC: Main Deck Aft Strips OFF");
      }
      break;
    case "MAIN DECK COURTESY":
      if (State == "ON") {
        sendOSC("/s/md-a-c/1");
        log("OSC: Main Deck Aft Courtesy ON");
      } else {
        sendOSC("/s/md-a-c/0");
        log("OSC: Main Deck Aft Courtesy OFF");
      }
      break;
    default:
      log(`WARN: No OSC mapping for toggle target: ${Target}`);
  }

  broadcastStateUpdate(Target);

  //send OSC message
  // set zone

  res.json({ Target, State, Info });
});

app.post("/colour", (req, res) => {
  const { Target, Colour, Subzone } = req.body;
  const subzoneNum = parseInt(Subzone, 10);
  log(
    `Colour request: ${Target} → colour ${Colour}${Subzone !== undefined ? ` (subzone ${subzoneNum})` : ""}`,
  );

  if (!getState(Target)) {
    return res.status(400).json({ error: "Invalid target" });
  }

  if (!COLOUR_INTENSITY_TARGETS.includes(Target)) {
    return res.status(400).json({ error: "Target cannot have colour set" });
  }

  if (isNaN(subzoneNum) || subzoneNum < 0 || subzoneNum > SUBZONE_COUNT) {
    return res.status(400).json({
      error: `Invalid subzone — must be 0 (all) or 1–${SUBZONE_COUNT}`,
    });
  }

  const existing = getState(Target).Colours || {};
  let updatedColours;

  if (subzoneNum === 0) {
    updatedColours = {};
    for (let i = 1; i <= SUBZONE_COUNT; i++) updatedColours[i] = Colour;
  } else {
    updatedColours = { ...existing, [subzoneNum]: Colour };
  }

  setState(Target, { Colours: updatedColours });

  broadcastStateUpdate(Target);

  const zonesToSend =
    subzoneNum === 0
      ? Array.from({ length: SUBZONE_COUNT }, (_, i) => i + 1)
      : [subzoneNum];

  for (const zone of zonesToSend) {
    const oscAddress = COLOUR_OSC_MAPPINGS[Target]?.[zone]?.[Colour];
    if (oscAddress) {
      sendOSC(oscAddress, []);
      log(`OSC: ${Target} zone ${zone} colour ${Colour} → ${oscAddress}`);
    } else {
      log(`WARN: No OSC mapping for ${Target} zone ${zone} colour ${Colour}`);
    }
  }

  res.json({
    Target,
    Subzone: subzoneNum,
    Scene: getState(Target).Scene,
    Colour,
  });
});

app.post("/intensity", (req, res) => {
  const { Target, Intensity, Subzone } = req.body;
  const subzoneNum = parseInt(Subzone, 10);
  log(
    `Intensity request: ${Target} → ${Intensity}%${Subzone !== undefined ? ` (subzone ${subzoneNum})` : ""}`,
  );

  if (!getState(Target)) {
    return res.status(400).json({ error: "Invalid target" });
  }

  if (!COLOUR_INTENSITY_TARGETS.includes(Target)) {
    return res.status(400).json({ error: "Target cannot have intensity set" });
  }

  if (isNaN(subzoneNum) || subzoneNum < 0 || subzoneNum > SUBZONE_COUNT) {
    return res.status(400).json({
      error: `Invalid subzone — must be 0 (all) or 1–${SUBZONE_COUNT}`,
    });
  }

  const existing = getState(Target).Intensities || {};
  let updatedIntensities;

  if (subzoneNum === 0) {
    updatedIntensities = {};
    for (let i = 1; i <= SUBZONE_COUNT; i++) updatedIntensities[i] = Intensity;
  } else {
    updatedIntensities = { ...existing, [subzoneNum]: Intensity };
  }

  const allOff = Object.values(updatedIntensities).every(
    (v) => !v || v === "0",
  );

  setState(Target, {
    Intensities: updatedIntensities,
    State: allOff ? "OFF" : "ON",
  });

  broadcastStateUpdate(Target);

  const intensityZonesToSend =
    subzoneNum === 0
      ? Array.from({ length: SUBZONE_COUNT }, (_, i) => i + 1)
      : [subzoneNum];

  for (const zone of intensityZonesToSend) {
    const oscAddress = INTENSITY_OSC_MAPPINGS[Target]?.[zone]?.[Intensity];
    if (oscAddress) {
      sendOSC(oscAddress, []);
      log(`OSC: ${Target} zone ${zone} intensity ${Intensity} → ${oscAddress}`);
    } else {
      log(
        `WARN: No OSC mapping for ${Target} zone ${zone} intensity ${Intensity}`,
      );
    }
  }

  res.json({
    Target,
    Subzone: subzoneNum,
    Scene: getState(Target).Scene,
    Intensity,
  });
});

app.post("/scene", (req, res) => {
  const { Target, Scene } = req.body;
  log(`Scene request: ${Target} -> ${Scene}`);

  if (!getState(Target)) {
    return res.status(400).json({ error: "Invalid Target" });
  }

  if (!SCENE_TARGETS.includes(Target)) {
    return res.status(400).json({ error: "Target cannot have a scene set" });
  }

  if (!SCENES.includes(Scene)) {
    return res.status(400).json({ error: "Invalid scene" });
  }

  setState(Target, { Scene });

  switch (Target) {
    case "SUN DECK EXTERIOR FWD":
      if (Scene === "ON") {
        sendOSC("/exec/10/5", []);
        log("OSC: Sun Deck Exterior Fwd Scene ON");
      } else if (Scene === "DIM") {
        sendOSC("/exec/10/4", []);
        log("OSC: Sun Deck Exterior Fwd Scene DIM");
      } else if (Scene === "NIGHT") {
        sendOSC("/exec/10/3", []);
        log("OSC: Sun Deck Exterior Fwd Scene NIGHT");
      } else if (Scene === "OFF") {
        sendOSC("/exec/10/2", []);
        log("OSC: Sun Deck Exterior Fwd Scene OFF");
      }

      break;
    case "MAIN DECK EXTERIOR AFT":
      if (Scene === "ON") {
        sendOSC("/exec/10/10", []);
        log("OSC: Main Deck Exterior Aft Scene ON");
      } else if (Scene === "DIM") {
        sendOSC("/exec/10/9", []);
        log("OSC: Main Deck Exterior Aft Scene DIM");
      } else if (Scene === "NIGHT") {
        sendOSC("/exec/10/8", []);
        log("OSC: Main Deck Exterior Aft Scene NIGHT");
      } else if (Scene === "OFF") {
        sendOSC("/exec/10/7", []);
        log("OSC: Main Deck Exterior Aft Scene OFF");
      }
      break;
    case "LOWER DECK WET AREA":
      if (Scene === "ON") {
        sendOSC("/exec/10/15", []);
        log("OSC: Lower Deck Wet Area Scene ON");
      } else if (Scene === "DIM") {
        sendOSC("/exec/10/14", []);
        log("OSC: Lower Deck Wet Area Scene DIM");
      } else if (Scene === "NIGHT") {
        sendOSC("/exec/10/13", []);
        log("OSC: Lower Deck Wet Area Scene NIGHT");
      } else if (Scene === "OFF") {
        sendOSC("/exec/10/12", []);
        log("OSC: Lower Deck Wet Area Scene OFF");
      }
      break;
    case "VESSEL":
      if (Scene === "ON") {
        sendOSC("/exec/10/20", []);
        log("OSC: Vessel Scene ON");
      } else if (Scene === "DIM") {
        sendOSC("/exec/10/19", []);
        log("OSC: Vessel Scene DIM");
      } else if (Scene === "NIGHT") {
        sendOSC("/exec/10/18", []);
        log("OSC: Vessel Scene NIGHT");
      } else if (Scene === "OFF") {
        sendOSC("/exec/10/17", []);
        log("OSC: Vessel Scene OFF");
      }
      break;
    default:
      log(`WARN: No OSC mapping for scene target: ${Target}`);
  }

  broadcastStateUpdate(Target);
  res.json({ Target, Scene });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
