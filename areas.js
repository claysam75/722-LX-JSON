/* --------------------------------------------------
   Area Hierarchy

   Single source of truth for which areas live on which
   deck, which commands each area answers to, and which
   scene / colour+intensity group each area belongs to.

   Edit areas.json to change the structure — every target
   list below is derived from it at start-up.
-------------------------------------------------- */

const fs = require("fs");
const path = require("path");

const AREAS_FILE = path.join(__dirname, "areas.json");

const TRUTHY = ["yes", "y", "true", "1"];

/* Short deck prefixes used in the hierarchy file */
const PREFIX_ALIASES = [
  ["SD ", "SUN DECK "],
  ["MD ", "MAIN DECK "],
  ["LD ", "LOWER DECK "],
  ["UW ", "UNDERWATER "],
];

/**
 * Turn a friendly hierarchy name ("MD Aft Spots Pool + Table") into the
 * canonical API target name ("MAIN DECK AFT SPOTS POOL AND TABLE").
 * An explicit "Target" in areas.json always wins over this.
 */
function normaliseTarget(name) {
  let target = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s*\+\s*/g, " AND ")
    .replace(/\s+/g, " ");

  for (const [short, full] of PREFIX_ALIASES) {
    if (target.startsWith(short)) {
      target = full + target.slice(short.length);
      break;
    }
  }

  return target;
}

function isYes(value) {
  return TRUTHY.includes(String(value ?? "").trim().toLowerCase());
}

/**
 * Reads a flag that has been spelled more than one way over the life of the
 * project (e.g. "ColIntDirect" and "ColInt-Direct").
 */
function readFlag(area, ...keys) {
  for (const key of keys) {
    if (key in area) return area[key];
  }
  return "";
}

function readGroup(area, ...keys) {
  for (const key of keys) {
    if (key in area && String(area[key]).trim() !== "") {
      return normaliseTarget(area[key]);
    }
  }
  return null;
}

/* --------------------------------------------------
   Build
-------------------------------------------------- */

function buildHierarchy(raw) {
  const decks = [];
  const areasByTarget = new Map();
  const sceneMembers = new Map(); // group target -> [member targets]
  const colIntMembers = new Map(); // group target -> [member targets]

  Object.entries(raw).forEach(([deckName, deckAreas]) => {
    const deck = { Name: deckName, Areas: [] };

    Object.entries(deckAreas).forEach(([areaName, definition]) => {
      const target = definition.Target
        ? normaliseTarget(definition.Target)
        : normaliseTarget(areaName);

      if (areasByTarget.has(target)) {
        throw new Error(
          `Duplicate area target "${target}" in areas.json (${areaName} on ${deckName})`,
        );
      }

      const area = {
        Name: areaName,
        Target: target,
        Deck: deckName,
        Toggle: isYes(readFlag(definition, "Toggle")),
        Set: isYes(readFlag(definition, "Set")),
        ColIntDirect: isYes(
          readFlag(definition, "ColIntDirect", "ColInt-Direct"),
        ),
        SceneGroup: readGroup(definition, "SceneMember", "Scene-Member"),
        ColIntGroup: readGroup(definition, "ColIntMember", "ColInt-Member"),
      };

      areasByTarget.set(target, area);
      deck.Areas.push(area);
    });

    decks.push(deck);
  });

  /* Membership — an area that names itself as its own group (e.g. Lower Deck
     Wet Area) is the group, so it is never listed as a member of itself. */
  for (const area of areasByTarget.values()) {
    if (area.SceneGroup) {
      if (!sceneMembers.has(area.SceneGroup)) {
        sceneMembers.set(area.SceneGroup, []);
      }
      if (area.SceneGroup !== area.Target) {
        sceneMembers.get(area.SceneGroup).push(area.Target);
      }
    }

    if (area.ColIntGroup) {
      if (!colIntMembers.has(area.ColIntGroup)) {
        colIntMembers.set(area.ColIntGroup, []);
      }
      if (area.ColIntGroup !== area.Target) {
        colIntMembers.get(area.ColIntGroup).push(area.Target);
      }
    }
  }

  return { decks, areasByTarget, sceneMembers, colIntMembers };
}

const RAW_HIERARCHY = JSON.parse(fs.readFileSync(AREAS_FILE, "utf8"));
const { decks, areasByTarget, sceneMembers, colIntMembers } =
  buildHierarchy(RAW_HIERARCHY);

/* --------------------------------------------------
   Derived Target Lists
-------------------------------------------------- */

const AREAS = Array.from(areasByTarget.values());
const AREA_TARGETS = AREAS.map((a) => a.Target);

const TOGGLE_AREA_TARGETS = AREAS.filter((a) => a.Toggle).map((a) => a.Target);
const SET_AREA_TARGETS = AREAS.filter((a) => a.Set).map((a) => a.Target);
const COL_INT_DIRECT_TARGETS = AREAS.filter((a) => a.ColIntDirect).map(
  (a) => a.Target,
);

const SCENE_GROUP_TARGETS = Array.from(sceneMembers.keys());
const COL_INT_GROUP_TARGETS = Array.from(colIntMembers.keys());

/* --------------------------------------------------
   Public API
-------------------------------------------------- */

function getArea(target) {
  return areasByTarget.get(target) || null;
}

/** Members of a scene group, excluding the group itself. */
function getSceneMembers(groupTarget) {
  return sceneMembers.get(groupTarget) || [];
}

/** Members of a colour/intensity group, excluding the group itself. */
function getColIntMembers(groupTarget) {
  return colIntMembers.get(groupTarget) || [];
}

/** Every area affected by a group command, whatever the group type. */
function getGroupMembers(groupTarget) {
  return Array.from(
    new Set([...getSceneMembers(groupTarget), ...getColIntMembers(groupTarget)]),
  );
}

function getSceneGroup(target) {
  return getArea(target)?.SceneGroup || null;
}

function getColIntGroup(target) {
  return getArea(target)?.ColIntGroup || null;
}

function isSceneGroup(target) {
  return sceneMembers.has(target);
}

function isColIntGroup(target) {
  return colIntMembers.has(target);
}

function canToggle(target) {
  return getArea(target)?.Toggle === true;
}

function canSet(target) {
  return getArea(target)?.Set === true;
}

function canColourIntensityDirect(target) {
  return getArea(target)?.ColIntDirect === true;
}

/** Deck → areas view, for diagnostics and the /areas endpoint. */
function describeHierarchy() {
  return decks.map((deck) => ({
    Deck: deck.Name,
    Areas: deck.Areas.map((area) => ({
      Name: area.Name,
      Target: area.Target,
      Toggle: area.Toggle,
      Set: area.Set,
      ColIntDirect: area.ColIntDirect,
      SceneMember: area.SceneGroup || "",
      ColIntMember: area.ColIntGroup || "",
    })),
  }));
}

module.exports = {
  RAW_HIERARCHY,
  DECKS: decks,
  AREAS,
  AREA_TARGETS,
  TOGGLE_AREA_TARGETS,
  SET_AREA_TARGETS,
  COL_INT_DIRECT_TARGETS,
  SCENE_GROUP_TARGETS,
  COL_INT_GROUP_TARGETS,
  normaliseTarget,
  getArea,
  getSceneMembers,
  getColIntMembers,
  getGroupMembers,
  getSceneGroup,
  getColIntGroup,
  isSceneGroup,
  isColIntGroup,
  canToggle,
  canSet,
  canColourIntensityDirect,
  describeHierarchy,
};
