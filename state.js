const fs = require("fs");
const path = require("path");
const {
  ALL_TARGETS,
  COLOUR_INTENSITY_TARGETS,
  SUBZONE_COUNT,
} = require("./constants");

const STATE_FILE = path.join(__dirname, "/state/state.json");

const state = new Map();

/* --------------------------------------------------
   Initialise Default State
-------------------------------------------------- */

function makeSubzoneDefault() {
  const m = {};
  for (let i = 1; i <= SUBZONE_COUNT; i++) m[i] = "";
  return m;
}

function initialiseDefaults() {
  ALL_TARGETS.forEach((target) => {
    const base = {
      Target: target,
      Info: "",
      State: "OFF",
      Scene: "",
    };
    if (COLOUR_INTENSITY_TARGETS.includes(target)) {
      base.Colours = makeSubzoneDefault();
      base.Intensities = makeSubzoneDefault();
    }
    if (target === "YACHT NAME") {
      base.Lights = { "UD SB": "OFF", "HULL DOOR": "OFF", "GUEST ENTRANCE": "OFF" };
    }
    state.set(target, base);
  });

  // Fire Alarm
  state.set("FIRE ALARM", {
    Target: "FIRE ALARM",
    State: "SILENT",
  });

  // Hull Door
  state.set("HULL DOOR", {
    Target: "HULL DOOR",
    State: "CLOSED",
  });

  // Event Mode MD
  state.set("EVENT MODE MD", {
    Target: "EVENT MODE MD",
    State: "OFF",
  });

  // Event Mode SD
  state.set("EVENT MODE SD", {
    Target: "EVENT MODE SD",
    State: "OFF",
  });

  // Event Mode LD
  state.set("EVENT MODE LD", {
    Target: "EVENT MODE LD",
    State: "OFF",
  });

  // Event Mode UW
  state.set("EVENT MODE UW", {
    Target: "EVENT MODE UW",
    State: "OFF",
  });
}

/* --------------------------------------------------
   Load From Disk (if exists)
-------------------------------------------------- */

function loadState() {
  initialiseDefaults();

  if (!fs.existsSync(STATE_FILE)) {
    console.log("No existing state file found — using defaults");
    return;
  }

  try {
    const raw = fs.readFileSync(STATE_FILE);
    const parsed = JSON.parse(raw);

    parsed.forEach((entry) => {
      if (COLOUR_INTENSITY_TARGETS.includes(entry.Target)) {
        if (!entry.Colours) {
          entry.Colours = makeSubzoneDefault();
          delete entry.Colour;
        }
        if (!entry.Intensities) {
          entry.Intensities = makeSubzoneDefault();
          delete entry.Intensity;
        }
        delete entry.Subzone;
      }
      if (entry.Target === "YACHT NAME") {
        if (!entry.Lights) {
          entry.Lights = { "UD SB": "OFF", "HULL DOOR": "OFF", "GUEST ENTRANCE": "OFF" };
        } else if (!("GUEST ENTRANCE" in entry.Lights)) {
          entry.Lights["GUEST ENTRANCE"] = "OFF";
        }
      }
      state.set(entry.Target, entry);
    });

    console.log("State restored from disk");
  } catch (err) {
    console.error("Failed to load state file — using defaults", err);
  }
}

/* --------------------------------------------------
   Atomic Save To Disk
-------------------------------------------------- */

function saveState() {
  try {
    const tempFile = STATE_FILE + ".tmp";
    const data = JSON.stringify(Array.from(state.values()), null, 2);

    fs.writeFileSync(tempFile, data);
    fs.renameSync(tempFile, STATE_FILE);
  } catch (err) {
    console.error("Failed to save state file", err);
  }
}

/* --------------------------------------------------
   Public API
-------------------------------------------------- */

function getState(target) {
  return state.get(target);
}

function setState(target, newState) {
  if (newState.State && typeof newState.State === "object") {
    throw new Error(`Invalid State value for ${target}`);
  }

  const updated = {
    ...state.get(target),
    ...newState,
  };

  state.set(target, updated);

  saveState(); // 👈 persist immediately
}

function getAllStates() {
  return Array.from(state.values());
}

module.exports = {
  loadState,
  getState,
  setState,
  getAllStates,
};
