import * as THREE from "/vendor/three/three.module.js";

const $ = (id) => document.getElementById(id);
const mount = $("rpgCanvas");
const joinForm = $("rpgJoinForm");
const namegate = $("rpgNamegate");
const nameInput = $("rpgNameInput");
const roleInput = $("rpgRoleInput");
const chatForm = $("rpgChatForm");
const chatInput = $("rpgChatInput");
const levelEl = $("rpgLevel");
const xpEl = $("rpgXp");
const cashEl = $("rpgCash");
const toolEl = $("rpgTool");
const playersEl = $("rpgPlayers");
const rosterEl = $("rpgRoster");
const messagesEl = $("rpgMessages");
const targetEl = $("rpgTarget");
const activityTitleEl = $("rpgActivityTitle");
const activityBodyEl = $("rpgActivityBody");
const activityActionEl = $("rpgActivityAction");
const logEl = $("rpgLog");
const soundBtn = $("rpgSoundBtn");
const avatarGrid = $("rpgAvatarGrid");
const interactBtn = $("rpgInteractBtn");
const moneyBtn = $("rpgMoneyBtn");
const buildBtn = $("rpgBuildBtn");
const attackBtn = $("rpgAttackBtn");
const centerBtn = $("rpgCenterBtn");
const friendsBtn = $("rpgFriendsBtn");
const bagBtn = $("rpgBagBtn");
const gatherBtn = $("rpgGatherBtn");
const statsBtn = $("rpgStatsBtn");
const marketBtn = $("rpgMarketBtn");
const infoPanel = $("rpgInfoPanel");
const infoTitle = $("rpgInfoTitle");
const infoBody = $("rpgInfoBody");
const infoClose = $("rpgInfoClose");

const WORLD_X = 60;
const WORLD_Z = 50;
const PLAYER_MIN_X = -57;
const PLAYER_MAX_X = 57;
const PLAYER_MIN_Z = -47;
const PLAYER_MAX_Z = 47;
const TILE = 1.25;

const api = {
  async get(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

const avatars = {
  builder: { color: "#7df2aa", hat: "#151617", name: "Builder" },
  agent: { color: "#8ea4ff", hat: "#2d365c", name: "Agent" },
  scout: { color: "#ffd166", hat: "#4a3721", name: "Scout" },
  creator: { color: "#ff7d97", hat: "#4b1824", name: "Creator" }
};

const state = {
  player: null,
  remotePlayers: new Map(),
  pickups: new Map(),
  enemies: new Map(),
  homes: new Map(),
  npcs: new Map(),
  resources: new Map(),
  keys: new Set(),
  moveTarget: null,
  lastSync: 0,
  lastPoll: 0,
  nearestPickup: null,
  nearestEnemy: null,
  nearestActivity: null,
  nearestPlayer: null,
  nearestNpc: null,
  nearestResource: null,
  selectedActivity: null,
  selectedTool: "",
  avatar: "builder",
  avatarColor: "#7df2aa",
  sound: false,
  audio: null,
  cameraLock: true,
  cameraTarget: new THREE.Vector3(0, 0, 0),
  inventory: {
    axe: 0,
    pickaxe: 0,
    rod: 0,
    hammer: 0,
    sword: 0,
    wood: 0,
    stone: 0,
    fish: 0,
    jobProof: 0
  },
  skills: {
    woodcutting: 0,
    mining: 0,
    fishing: 0,
    building: 0,
    networking: 0,
    combat: 0
  },
  actionUntil: 0
};

const blockedRects = [];
const bridgeRects = [];

const activities = [
  { id: "job-board", title: "Job Board Plaza", x: 0, z: 0, xp: 18, pay: 35, jobTitle: "Job Scout", prompt: "Browse live applications, choose a role, and start a public job quest.", action: "Scout openings" },
  { id: "resume-forge", title: "Resume Forge", x: -10, z: -5, xp: 24, pay: 45, jobTitle: "Resume Builder", prompt: "Hammer raw experience into a sharper resume and collect a stronger pitch.", action: "Upgrade resume" },
  { id: "interview-dojo", title: "Interview Dojo", x: 6, z: -13, xp: 30, pay: 65, jobTitle: "Interview Pro", prompt: "Practice hard questions, dodge awkward silence, and earn confidence XP.", action: "Run mock interview" },
  { id: "agent-lab", title: "Agent Lab", x: -22, z: 12, xp: 26, pay: 55, jobTitle: "Agent Trainer", prompt: "Train SKILLS.md agents to search boards, write updates, and find leads.", action: "Train agent" },
  { id: "kol-harbor", title: "KOL Harbor", x: 24, z: -14, xp: 22, pay: 50, jobTitle: "KOL Runner", prompt: "Send an application signal across the docks and try to reach the right eyes.", action: "Send signal" },
  { id: "freelance-market", title: "Freelance Market", x: -24, z: -2, xp: 20, pay: 70, jobTitle: "Freelancer", prompt: "Pick up small quests, deliver useful work, and build reputation.", action: "Take gig" },
  { id: "offer-tower", title: "Offer Tower", x: 24, z: 18, xp: 36, pay: 120, jobTitle: "Hired Hero", prompt: "Climb the tower after collecting proof and pitch yourself for a better opportunity.", action: "Pitch yourself" },
  { id: "beach-break", title: "Burnout Beach", x: 4, z: 28, xp: 12, pay: 15, jobTitle: "Rested", prompt: "Rest, reset, and remember the grind is easier when it is a game.", action: "Recharge" },
  { id: "home-district", title: "Home District", x: -34, z: 22, xp: 16, pay: 25, jobTitle: "Resident", prompt: "Buy land, build homes, and flex what the job paid for.", action: "Tour homes" },
  { id: "salary-bank", title: "Salary Bank", x: 38, z: 6, xp: 28, pay: 95, jobTitle: "Paid Builder", prompt: "Cash out completed work, stack game cash, and fund your first home.", action: "Collect invoice" },
  { id: "network-cafe", title: "Network Cafe", x: -38, z: -18, xp: 22, pay: 40, jobTitle: "Networker", prompt: "Meet referrals, share leads, and turn strangers into teammates.", action: "Network" },
  { id: "startup-mine", title: "Startup Mine", x: 42, z: -30, xp: 42, pay: 135, jobTitle: "Startup Grinder", prompt: "Mine chaotic startup tasks, survive the sprint, and bring home the bag.", action: "Ship sprint" },
  { id: "creator-stage", title: "Creator Stage", x: -44, z: 33, xp: 32, pay: 85, jobTitle: "Creator", prompt: "Pitch your story to the island and turn proof-of-work into attention.", action: "Post update" }
];

const npcs = [
  { name: "Recruiter Rina", role: "Interview tips", x: 2, z: -3, color: "#ffd166", avatar: "scout" },
  { name: "Agent Nova", role: "SKILLS.md guide", x: -21, z: 9, color: "#8ea4ff", avatar: "agent" },
  { name: "Captain KOL", role: "Attention route", x: 25, z: -11, color: "#ff7d97", avatar: "creator" },
  { name: "Freelance Finn", role: "Task broker", x: -25, z: -4, color: "#7df2aa", avatar: "builder" },
  { name: "Coach Mint", role: "Confidence XP", x: 7, z: -11, color: "#d9ffe9", avatar: "scout" },
  { name: "Banker Byte", role: "Salary claims", x: 37, z: 8, color: "#7df2aa", avatar: "agent" },
  { name: "Mina Sprint", role: "Startup chaos", x: 43, z: -28, color: "#ffd166", avatar: "builder" },
  { name: "Cafe Kai", role: "Referrals", x: -38, z: -16, color: "#8ea4ff", avatar: "scout" },
  { name: "Stage Sage", role: "Story shill", x: -44, z: 31, color: "#ff7d97", avatar: "creator" }
  ,
  { name: "Wendy Wood", role: "Axe tutorial", x: -48, z: -2, color: "#7df2aa", avatar: "builder" },
  { name: "Miner Max", role: "Pickaxe tutorial", x: 43, z: -34, color: "#ffd166", avatar: "builder" },
  { name: "Old Fisher", role: "Rod tutorial", x: 17, z: -1, color: "#8ea4ff", avatar: "scout" },
  { name: "Foreman Hex", role: "Hammer tutorial", x: -30, z: 18, color: "#ff7d97", avatar: "creator" },
  { name: "Armory Ari", role: "Sword tutorial", x: 12, z: 18, color: "#d9ffe9", avatar: "scout" }
];

const resourceNodes = [
  { id: "wood-1", type: "wood", label: "Jobwood Tree", x: -50, z: -4, tool: "axe", skill: "woodcutting", gives: "wood", amount: 3, xp: 12 },
  { id: "wood-2", type: "wood", label: "Resume Tree", x: -47, z: 0, tool: "axe", skill: "woodcutting", gives: "wood", amount: 2, xp: 10 },
  { id: "mine-1", type: "mine", label: "Coal Deadline", x: 45, z: -32, tool: "pickaxe", skill: "mining", gives: "stone", amount: 3, xp: 14 },
  { id: "mine-2", type: "mine", label: "Offer Ore", x: 40, z: -28, tool: "pickaxe", skill: "mining", gives: "stone", amount: 2, xp: 12 },
  { id: "fish-1", type: "fish", label: "Referral Pond", x: 18, z: -1, tool: "rod", skill: "fishing", gives: "fish", amount: 2, xp: 12 },
  { id: "fish-2", type: "fish", label: "KOL Dock", x: 31, z: -16, tool: "rod", skill: "fishing", gives: "fish", amount: 3, xp: 14 },
  { id: "build-1", type: "build", label: "Construction Yard", x: -31, z: 20, tool: "hammer", skill: "building", gives: "jobProof", amount: 1, xp: 15 }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fd3e8");
scene.fog = new THREE.Fog("#8fd3e8", 34, 76);

const camera = new THREE.OrthographicCamera(-18, 18, 11, -11, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const hemi = new THREE.HemisphereLight("#ecfff1", "#31543e", 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff8df", 2.9);
sun.position.set(-18, 30, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -44;
sun.shadow.camera.right = 44;
sun.shadow.camera.top = 44;
sun.shadow.camera.bottom = -44;
scene.add(sun);

const mat = {
  grass: new THREE.MeshStandardMaterial({ color: "#65c85d", roughness: 0.84 }),
  grass2: new THREE.MeshStandardMaterial({ color: "#58b954", roughness: 0.84 }),
  road: new THREE.MeshStandardMaterial({ color: "#b9a382", roughness: 0.9 }),
  plaza: new THREE.MeshStandardMaterial({ color: "#9ca0a0", roughness: 0.82 }),
  sand: new THREE.MeshStandardMaterial({ color: "#e9d191", roughness: 0.92 }),
  snow: new THREE.MeshStandardMaterial({ color: "#ddebdc", roughness: 0.8 }),
  water: new THREE.MeshStandardMaterial({ color: "#2d83a6", roughness: 0.35, metalness: 0.05 }),
  forest: new THREE.MeshStandardMaterial({ color: "#3fa846", roughness: 0.9 }),
  office: new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.58 }),
  dark: new THREE.MeshStandardMaterial({ color: "#151617", roughness: 0.74 }),
  mint: new THREE.MeshStandardMaterial({ color: "#7df2aa", roughness: 0.48, metalness: 0.08 }),
  gold: new THREE.MeshStandardMaterial({ color: "#ffd166", roughness: 0.44, metalness: 0.12 }),
  enemy: new THREE.MeshStandardMaterial({ color: "#ff596a", emissive: "#5a0612", roughness: 0.42 }),
  pickup: new THREE.MeshStandardMaterial({ color: "#7df2aa", emissive: "#1d7f45", roughness: 0.28, metalness: 0.18 })
};

function tileKind(x, z) {
  if (Math.abs(x) < 5 && Math.abs(z) < 5) return "plaza";
  if (Math.abs(x) <= 2 || Math.abs(z) <= 2) return "road";
  const river = Math.abs(x - Math.sin(z * 0.22) * 4) <= 1 && z > -30 && z < 32;
  const lake = Math.hypot(x - 18, z + 4) < 6;
  const harbor = x > 28 && z < -6 && z > -22;
  const northSea = z > 40;
  const westCanal = x < -50 && z > -30 && z < 18;
  if (river || lake || harbor || northSea || westCanal) return "water";
  if (z > 24 && x > -10) return "sand";
  if (x < -32 && z < -18) return "snow";
  if (x > 14 && z < -8) return "forest";
  if (x > 32 && z > -2 && z < 14) return "plaza";
  if (x > 36 && z < -24) return "road";
  if (x < -34 && z < -12) return "plaza";
  if (x < -36 && z > 26) return "sand";
  if (x < -28 && z > 14) return "plaza";
  return "grass";
}

function tileMaterial(x, z) {
  const kind = tileKind(x, z);
  if (kind === "water") return mat.water;
  if (kind === "sand") return mat.sand;
  if (kind === "snow") return mat.snow;
  if (kind === "road") return mat.road;
  if (kind === "plaza") return mat.plaza;
  if (kind === "forest") return mat.forest;
  return (x + z) % 2 === 0 ? mat.grass : mat.grass2;
}

function addMap() {
  const tileGeo = new THREE.BoxGeometry(TILE, 0.12, TILE);
  for (let x = -WORLD_X; x <= WORLD_X; x++) {
    for (let z = -WORLD_Z; z <= WORLD_Z; z++) {
      const tile = new THREE.Mesh(tileGeo, tileMaterial(x, z));
      tile.position.set(x * TILE, -0.06, z * TILE);
      tile.receiveShadow = true;
      tile.userData.ground = true;
      world.add(tile);
    }
  }
  addWaterEdge();
  addTrees();
  addTown();
  addActivityBuildings();
  addNpcs();
  addResourceNodes();
  addMapLabels();
  addBridges();
  addWorldDetails();
}

function addWaterEdge() {
  const waveMat = new THREE.MeshStandardMaterial({ color: "#7df2aa", emissive: "#0d4d31", roughness: 0.3 });
  for (let i = 0; i < 22; i++) {
    const wave = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), waveMat);
    wave.position.set((-6 + i * 1.8) * TILE, 0.04, 32.5 * TILE + Math.sin(i) * 0.4);
    wave.rotation.y = Math.sin(i) * 0.35;
    world.add(wave);
  }
  for (let i = 0; i < 12; i++) {
    const wave = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.08), waveMat);
    wave.position.set((16 + Math.cos(i) * 5.5) * TILE, 0.04, (-4 + Math.sin(i) * 5.5) * TILE);
    wave.rotation.y = i;
    world.add(wave);
  }
  for (let i = 0; i < 26; i++) {
    const dockPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.65, 8), mat.dark);
    dockPost.position.set((27 + (i % 7)) * TILE, 0.3, (-20 + Math.floor(i / 7) * 2.4) * TILE);
    dockPost.castShadow = true;
    world.add(dockPost);
  }
}

function addTrees() {
  for (let i = 0; i < 260; i++) {
    const x = randInt(-56, 56);
    const z = randInt(-46, 42);
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    if (Math.abs(x) <= 2 || Math.abs(z) <= 2) continue;
    if (z > 24 && x > -10) continue;
    if (Math.abs(x - Math.sin(z * 0.22) * 4) <= 2 && z > -30 && z < 32) continue;
    if ((x > 9 && z < -4) || Math.random() > 0.5) addTree(x, z);
  }
  for (let i = 0; i < 22; i++) addPalm(randInt(-4, 30), randInt(25, 35));
}

function addTown() {
  addFountain(0, 0);
  addBuilding(-7, -7, 3.5, 2.5, 1.6, "#4f3a31", "#283528");
  addBuilding(-3, -8, 3, 2.2, 1.4, "#6c4e38", "#2f2934");
  addBuilding(5, -6, 3.2, 2.3, 1.5, "#5a4634", "#34252a");
  addBuilding(-7, 5, 3.2, 2.2, 1.35, "#625543", "#25342c");
  addBuilding(6, 5, 3.2, 2.2, 1.35, "#625543", "#25342c");
  addBuilding(11, 2, 2.4, 2.4, 2.2, "#394445", "#7df2aa");
  addBuilding(-12, 2, 2.5, 2.6, 2, "#373338", "#ffd166");
}

function addActivityBuildings() {
  addSign("JOB BOARD", 0, -2.6, "#7df2aa");
  addBuilding(-10, -5, 4.6, 3.1, 1.8, "#42352c", "#ff7d97");
  addSign("RESUME FORGE", -10, -7.2, "#ffb6be");
  addBuilding(6, -13, 5, 3.5, 2.2, "#2f3a4a", "#7df2aa");
  addSign("INTERVIEW DOJO", 6, -15.7, "#7df2aa");
  addBuilding(-22, 12, 4.6, 3.2, 2.1, "#202636", "#8ea4ff");
  addSign("AGENT LAB", -22, 9.5, "#8ea4ff");
  addBuilding(24, -14, 5.4, 3.2, 1.6, "#403145", "#ffd166");
  addSign("KOL HARBOR", 24, -16.5, "#ffd166");
  addStalls(-24, -2);
  addTower(24, 18);
  addBeach(4, 28);
  addHomePlots(-34, 22);
  addPortal(24, -19);
  addBuilding(38, 6, 5.6, 4, 2.3, "#1e2c25", "#7df2aa");
  addSign("SALARY BANK", 38, 3, "#7df2aa");
  addBuilding(-38, -18, 5, 3.8, 1.7, "#352d25", "#ffd166");
  addSign("NETWORK CAFE", -38, -21, "#ffd166");
  addBuilding(42, -30, 5.2, 4.2, 2, "#332f33", "#ff7d97");
  addSign("STARTUP MINE", 42, -33, "#ffb6be");
  addStage(-44, 33);
}

function addBridges() {
  for (const z of [-18, -2, 14, 26]) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.18, 2.1), new THREE.MeshStandardMaterial({ color: "#7b5534", roughness: 0.78 }));
    bridge.position.set(Math.sin(z * 0.22) * 4 * TILE, 0.18, z * TILE);
    bridge.castShadow = true;
    bridge.receiveShadow = true;
    world.add(bridge);
    bridgeRects.push({ x: Math.sin(z * 0.22) * 4, z, w: 6.8, d: 2.1 });
  }
}

function addHomePlots(x, z) {
  addSign("HOME DISTRICT", x, z - 3.2, "#f8fff9");
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const plot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: "#4f8d59", roughness: 0.9 }));
      plot.position.set((x + col * 3.2) * TILE, 0.08, (z + row * 3.2) * TILE);
      world.add(plot);
    }
  }
}

function addBuilding(x, z, w, d, h, wallColor, roofColor) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w * TILE, h * TILE, d * TILE), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.68 }));
  wall.position.y = (h * TILE) / 2;
  wall.castShadow = true;
  group.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * TILE * 0.78, 1.1, 4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.55 }));
  roof.position.y = h * TILE + 0.52;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  group.position.set(x * TILE, 0, z * TILE);
  world.add(group);
  blockedRects.push({ x, z, w: w + 0.7, d: d + 0.7 });
}

function addTower(x, z) {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6 - i * 0.18, 0.8, 2.6 - i * 0.18), mat.office);
    floor.position.y = 0.4 + i * 0.82;
    floor.castShadow = true;
    group.add(floor);
  }
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), mat.gold);
  crown.position.y = 5;
  crown.castShadow = true;
  group.add(crown);
  group.position.set(x * TILE, 0, z * TILE);
  world.add(group);
  addSign("OFFER TOWER", x, z + 2.6, "#ffd166");
}

function addStalls(x, z) {
  for (let i = 0; i < 4; i++) {
    const stall = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), new THREE.MeshStandardMaterial({ color: "#5b4636" }));
    table.position.y = 0.25;
    table.castShadow = true;
    stall.add(table);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.18, 1.25), new THREE.MeshStandardMaterial({ color: i % 2 ? "#7df2aa" : "#ffd166" }));
    roof.position.y = 1.05;
    roof.castShadow = true;
    stall.add(roof);
    stall.position.set((x + i * 2) * TILE, 0, (z + (i % 2)) * TILE);
    world.add(stall);
  }
  addSign("FREELANCE MARKET", x + 2.5, z - 2.4, "#7df2aa");
}

function addBeach(x, z) {
  for (let i = 0; i < 5; i++) {
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: i % 2 ? "#ff7d97" : "#8ea4ff", roughness: 0.7 }));
    towel.position.set((x + i * 2) * TILE, 0.06, (z + (i % 2)) * TILE);
    towel.rotation.y = 0.35;
    world.add(towel);
  }
  addPalm(x - 2, z + 1);
  addSign("BURNOUT BEACH", x + 4, z - 1.8, "#07100a");
}

function addPortal(x, z) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 3.2), mat.dark);
  base.castShadow = true;
  group.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.16, 12, 48), new THREE.MeshStandardMaterial({ color: "#151617", emissive: "#140024", roughness: 0.3 }));
  ring.position.y = 2.4;
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  group.add(ring);
  const light = new THREE.PointLight("#b55cff", 8, 12);
  light.position.y = 2.5;
  group.add(light);
  group.position.set(x * TILE, 0.5, z * TILE);
  world.add(group);
  blockedRects.push({ x, z, w: 4.8, d: 3.5 });
  addSign("PUMP PORTAL", x, z + 2.5, "#d9b3ff");
}

function addFountain(x, z) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.35, 32), mat.plaza);
  base.position.set(x * TILE, 0.18, z * TILE);
  base.receiveShadow = true;
  world.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.18, 32), mat.water);
  water.position.set(x * TILE, 0.48, z * TILE);
  world.add(water);
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 18), mat.mint);
  spray.position.set(x * TILE, 1.25, z * TILE);
  spray.castShadow = true;
  world.add(spray);
}

function addTree(x, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.1, 0.36), new THREE.MeshStandardMaterial({ color: "#724a28" }));
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.25 - i * 0.18, 0.55, 1.25 - i * 0.18), mat.forest);
    leaf.position.y = 1.15 + i * 0.42;
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x * TILE, 0, z * TILE);
  world.add(group);
  if (Math.random() > 0.8) blockedRects.push({ x, z, w: 0.9, d: 0.9 });
}

function addResourceNodes() {
  for (const node of resourceNodes) {
    const group = new THREE.Group();
    if (node.type === "wood") {
      addTree(node.x, node.z);
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.36, 10), new THREE.MeshStandardMaterial({ color: "#8b5a30", roughness: 0.78 }));
      stump.position.y = 0.18;
      group.add(stump);
    } else if (node.type === "mine") {
      for (let i = 0; i < 4; i++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + i * 0.05), new THREE.MeshStandardMaterial({ color: "#44484d", roughness: 0.9 }));
        rock.position.set((i % 2) * 0.75 - 0.38, 0.28, Math.floor(i / 2) * 0.7 - 0.35);
        rock.castShadow = true;
        group.add(rock);
      }
    } else if (node.type === "fish") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: "#7df2aa", transparent: true, opacity: 0.74 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);
    } else {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), new THREE.MeshStandardMaterial({ color: "#8b5a30", roughness: 0.78 }));
      crate.position.y = 0.35;
      crate.castShadow = true;
      group.add(crate);
    }
    const label = makeNameSprite(node.label, "#7df2aa");
    label.position.y = 1.7;
    group.add(label);
    group.position.set(node.x * TILE, 0, node.z * TILE);
    group.userData.resource = node;
    world.add(group);
    state.resources.set(node.id, group);
    if (node.type !== "fish") blockedRects.push({ x: node.x, z: node.z, w: 1.2, d: 1.2 });
  }
}

function addPalm(x, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.9, 8), new THREE.MeshStandardMaterial({ color: "#8a5a32" }));
  trunk.position.y = 0.95;
  trunk.rotation.z = 0.12;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.34), mat.forest);
    leaf.position.y = 1.95;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x * TILE, 0, z * TILE);
  world.add(group);
}

function addNpcs() {
  for (const npc of npcs) {
    const group = makeCharacterMesh({ ...npc, id: `npc-${npc.name}`, level: 10 }, false, true);
    group.position.set(npc.x * TILE, 0, npc.z * TILE);
    group.userData.npc = npc;
    world.add(group);
    state.npcs.set(`npc-${npc.name}`, group);
  }
}

function addMapLabels() {
  addSign("GET ME A JOB WORLD", -18, -22, "#f8fff9", 2.4);
  addSign("CAREER CHAIN", 13, 10, "#7df2aa", 1.35);
  addSign("THE JOB HUNT IS THE GAME", -42, 42, "#07100a", 1.2);
}

function addWorldDetails() {
  addBillboard("APPLY", 12, -4, "#7df2aa");
  addBillboard("GET PAID", 34, 10, "#ffd166");
  addBillboard("BUILD", -28, 28, "#ff7d97");
  addBillboard("SHARE LEADS", -36, -14, "#8ea4ff");
  addBoats();
  addOfficeBlocks();
  addMoneyFountain(38, 8);
}

function addBillboard(text, x, z, color) {
  const group = new THREE.Group();
  const posts = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), mat.dark);
  posts.position.y = 0.8;
  group.add(posts);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 0.18), new THREE.MeshStandardMaterial({ color, roughness: 0.42 }));
  board.position.y = 1.8;
  board.castShadow = true;
  group.add(board);
  group.position.set(x * TILE, 0, z * TILE);
  world.add(group);
  addSign(text, x, z - 0.8, "#07100a", 0.72);
}

function addBoats() {
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 0.78), new THREE.MeshStandardMaterial({ color: i % 2 ? "#7df2aa" : "#ffd166", roughness: 0.55 }));
    hull.position.y = 0.18;
    boat.add(hull);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.54, 1.2, 3), new THREE.MeshStandardMaterial({ color: "#f8fff9", roughness: 0.7 }));
    sail.position.y = 1;
    sail.rotation.y = Math.PI / 6;
    boat.add(sail);
    boat.position.set((29 + i * 2.6) * TILE, 0.12, (-18 + (i % 3) * 3.2) * TILE);
    boat.rotation.y = 0.15 * i;
    world.add(boat);
  }
}

function addOfficeBlocks() {
  for (let i = 0; i < 6; i++) {
    const x = 32 + (i % 3) * 4;
    const z = 14 + Math.floor(i / 3) * 4;
    addBuilding(x, z, 2.4, 2.4, 2.4 + (i % 3) * 0.7, "#c8d5d0", i % 2 ? "#151617" : "#7df2aa");
  }
}

function addMoneyFountain(x, z) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.3, 24), mat.gold);
  base.position.set(x * TILE, 0.2, z * TILE);
  world.add(base);
  for (let i = 0; i < 9; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20), mat.gold);
    coin.position.set((x + Math.cos(i) * 1.1) * TILE, 0.85 + (i % 3) * 0.22, (z + Math.sin(i) * 1.1) * TILE);
    coin.rotation.x = Math.PI / 2;
    world.add(coin);
  }
}

function addStage(x, z) {
  const stage = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 3.8), mat.dark);
  base.position.y = 0.3;
  base.castShadow = true;
  stage.add(base);
  for (let i = 0; i < 5; i++) {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? "#7df2aa" : "#ff7d97", emissive: i % 2 ? "#195c36" : "#5a1020" }));
    light.position.set(-2.6 + i * 1.3, 1.1, -1.7);
    stage.add(light);
  }
  stage.position.set(x * TILE, 0, z * TILE);
  world.add(stage);
  addSign("CREATOR STAGE", x, z - 3, "#ffb6be");
}

function addSign(text, x, z, color = "#7df2aa", scale = 1) {
  const sprite = makeNameSprite(text, color, "rgba(0,0,0,0.58)");
  sprite.position.set(x * TILE, 2.1 * scale, z * TILE);
  sprite.scale.multiplyScalar(scale);
  world.add(sprite);
}

function makeNameSprite(text, color = "#ffffff", bg = "rgba(0,0,0,0.52)") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "900 38px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = bg;
  roundRect(ctx, 20, 26, 472, 66, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(125,242,170,0.38)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 70);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(3.6, 0.9, 1);
  return sprite;
}

function makeBubbleSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.font = "800 28px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8,10,9,0.84)";
  roundRect(ctx, 18, 28, 476, 84, 20);
  ctx.fill();
  ctx.fillStyle = "#f8fff9";
  ctx.fillText(text.slice(0, 44), 256, 80);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(4, 1.25, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeCharacterMesh(player, isLocal = false, isNpc = false) {
  const group = new THREE.Group();
  const avatar = avatars[player.avatar] || avatars.builder;
  const color = player.color || avatar.color || "#7df2aa";
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.06 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.42), bodyMat);
  body.position.y = 0.82;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.5), new THREE.MeshStandardMaterial({ color: "#f0d6a8", roughness: 0.7 }));
  head.position.y = 1.48;
  head.castShadow = true;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.58), new THREE.MeshStandardMaterial({ color: avatar.hat, roughness: 0.55 }));
  hat.position.y = 1.8;
  hat.castShadow = true;
  group.add(hat);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.16), mat.dark);
  bag.position.set(0, 0.86, -0.32);
  bag.castShadow = true;
  group.add(bag);
  if (player.avatar === "agent") {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), mat.mint);
    antenna.position.y = 2.13;
    group.add(antenna);
  }
  const label = makeNameSprite(`${player.name} L${player.level || 1}`, isLocal ? "#07100a" : "#f8fff9", isLocal ? "rgba(125,242,170,0.92)" : "rgba(0,0,0,0.52)");
  label.position.y = 2.45;
  group.add(label);
  group.userData.nameSprite = label;
  group.userData.playerId = player.id;
  group.userData.playerName = player.name;
  group.position.set((player.x || 0) * TILE, 0, (player.z || 0) * TILE);
  group.rotation.y = player.rot || 0;
  return group;
}

function makePickupMesh(item) {
  const group = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat.pickup);
  gem.position.y = 0.65;
  gem.castShadow = true;
  group.add(gem);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 44), new THREE.MeshBasicMaterial({ color: "#7df2aa", transparent: true, opacity: 0.54 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.16;
  group.add(halo);
  const label = makeNameSprite(item.label, "#7df2aa");
  label.position.y = 1.62;
  group.add(label);
  group.position.set(item.x * TILE, 0, item.z * TILE);
  world.add(group);
  return group;
}

function makeEnemyMesh(enemy) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.95, 0.72), mat.enemy);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);
  const label = makeNameSprite(`${enemy.label} ${enemy.hp}/${enemy.maxHp}`, "#ffb6be");
  label.position.y = 1.85;
  group.add(label);
  group.userData.nameSprite = label;
  group.userData.enemy = enemy;
  group.position.set(enemy.x * TILE, 0, enemy.z * TILE);
  world.add(group);
  return group;
}

function makeHomeMesh(home) {
  const tier = Math.max(1, Math.min(3, Number(home.tier || 1)));
  const group = new THREE.Group();
  const baseColor = tier === 1 ? "#6b4b35" : tier === 2 ? "#4b5f7a" : "#2d254c";
  const roofColor = tier === 1 ? "#7df2aa" : tier === 2 ? "#ffd166" : "#ff7d97";
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.7 + tier * 0.35, 0.9 + tier * 0.3, 1.55 + tier * 0.28), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.65 }));
  base.position.y = (0.9 + tier * 0.3) / 2;
  base.castShadow = true;
  group.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35 + tier * 0.28, 0.82, 4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.55 }));
  roof.position.y = 1.25 + tier * 0.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  const label = makeNameSprite(`${home.ownerName || "Player"}'s Home`, "#f8fff9");
  label.position.y = 2.45 + tier * 0.2;
  group.add(label);
  group.position.set((home.x || 0) * TILE, 0, (home.z || 0) * TILE);
  world.add(group);
  blockedRects.push({ x: Number(home.x || 0), z: Number(home.z || 0), w: 2.5 + tier * 0.35, d: 2.3 + tier * 0.28 });
  return group;
}

function createAudio() {
  if (state.audio) return state.audio;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.08;
  master.connect(ctx.destination);
  state.audio = { ctx, master };
  return state.audio;
}

function sound(type) {
  if (!state.sound) return;
  const { ctx, master } = createAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const notes = {
    step: [180, 0.035],
    collect: [660, 0.12],
    attack: [95, 0.16],
    activity: [440, 0.18],
    chat: [520, 0.08],
    join: [330, 0.16]
  };
  const [freq, dur] = notes[type] || notes.step;
  osc.type = type === "attack" ? "sawtooth" : "triangle";
  osc.frequency.setValueAtTime(freq, now);
  if (type === "collect" || type === "activity") osc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + dur);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.8, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

addMap();
let localMesh = makeCharacterMesh({ id: "local", name: "You", color: "#7df2aa", avatar: "builder" }, true);
localMesh.visible = false;
world.add(localMesh);

function syncScene(remote) {
  const players = Array.isArray(remote.players) ? remote.players : [];
  playersEl.textContent = players.length || 1;
  rosterEl.innerHTML = players
    .map((p) => {
      const activity = p.activity ? ` - ${escapeHtml(p.activity)}` : "";
      return `<div><span style="background:${p.color || "#7df2aa"}"></span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.role || "Applicant")} - L${p.level || 1}${activity}</small></div>`;
    })
    .join("");

  const seenPlayers = new Set();
  for (const player of players) {
    if (!player?.id || player.id === state.player?.id) continue;
    seenPlayers.add(player.id);
    let mesh = state.remotePlayers.get(player.id);
    if (!mesh || mesh.userData.avatar !== player.avatar) {
      if (mesh) world.remove(mesh);
      mesh = makeCharacterMesh(player, false);
      mesh.userData.avatar = player.avatar;
      world.add(mesh);
      state.remotePlayers.set(player.id, mesh);
    }
    mesh.position.lerp(new THREE.Vector3((player.x || 0) * TILE, 0, (player.z || 0) * TILE), 0.62);
    mesh.rotation.y = player.rot || 0;
    mesh.userData.playerName = player.name;
  }
  for (const [id, mesh] of state.remotePlayers.entries()) {
    if (!seenPlayers.has(id)) {
      world.remove(mesh);
      state.remotePlayers.delete(id);
    }
  }

  const seenPickups = new Set();
  for (const item of remote.pickups || []) {
    seenPickups.add(item.id);
    if (!state.pickups.has(item.id)) state.pickups.set(item.id, makePickupMesh(item));
  }
  for (const [id, mesh] of state.pickups.entries()) {
    if (!seenPickups.has(id)) {
      world.remove(mesh);
      state.pickups.delete(id);
    }
  }

  const seenEnemies = new Set();
  for (const enemy of remote.enemies || []) {
    seenEnemies.add(enemy.id);
    let mesh = state.enemies.get(enemy.id);
    if (!mesh) {
      mesh = makeEnemyMesh(enemy);
      state.enemies.set(enemy.id, mesh);
    }
    mesh.userData.enemy = enemy;
  }
  for (const [id, mesh] of state.enemies.entries()) {
    if (!seenEnemies.has(id)) {
      world.remove(mesh);
      state.enemies.delete(id);
    }
  }

  const seenHomes = new Set();
  for (const home of remote.homes || []) {
    if (!home?.id) continue;
    seenHomes.add(home.id);
    if (!state.homes.has(home.id)) state.homes.set(home.id, makeHomeMesh(home));
  }
  for (const [id, mesh] of state.homes.entries()) {
    if (!seenHomes.has(id)) {
      world.remove(mesh);
      state.homes.delete(id);
    }
  }

  renderMessages(remote.messages || []);
}

function renderMessages(messages) {
  messagesEl.innerHTML = messages
    .slice(-8)
    .map((m) => `<p><b>${escapeHtml(m.name || "World")}:</b> ${escapeHtml(m.text || "")}</p>`)
    .join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (logEl) {
    logEl.innerHTML = messages
      .slice(-5)
      .reverse()
      .map((m) => `<li>${escapeHtml(m.text || "")}</li>`)
      .join("");
  }
}

function showBubble(mesh, text) {
  if (!mesh) return;
  if (mesh.userData.bubble) mesh.remove(mesh.userData.bubble);
  const bubble = makeBubbleSprite(text);
  bubble.position.y = 3.35;
  mesh.add(bubble);
  mesh.userData.bubble = bubble;
  clearTimeout(mesh.userData.bubbleTimer);
  mesh.userData.bubbleTimer = setTimeout(() => {
    mesh.remove(bubble);
    mesh.userData.bubble = null;
  }, 2800);
}

function updateHud() {
  if (!state.player) return;
  levelEl.textContent = state.player.level || 1;
  xpEl.textContent = state.player.xp || 0;
  if (cashEl) cashEl.textContent = Math.floor(Number(state.player.cash || 0));
  if (toolEl) toolEl.textContent = state.selectedTool ? state.selectedTool : "None";

  const nearPickup = findNearestMesh(state.pickups, 2.25);
  const nearEnemy = findNearestMesh(state.enemies, 2.8);
  const nearActivity = findNearestActivity(2.7);
  const nearPlayer = findNearestPlayer(2.8);
  const nearNpc = findNearestNpc(2.7);
  const nearResource = findNearestResource(2.8);
  state.nearestPickup = nearPickup?.id || null;
  state.nearestEnemy = nearEnemy?.id || null;
  state.nearestActivity = nearActivity?.id || null;
  state.nearestPlayer = nearPlayer?.id || null;
  state.nearestNpc = nearNpc?.id || null;
  state.nearestResource = nearResource?.id || null;

  interactBtn.disabled = !(state.nearestActivity || state.nearestPickup || state.nearestPlayer || state.nearestNpc || state.nearestResource);
  moneyBtn.disabled = !state.nearestPlayer;
  buildBtn.disabled = Number(state.player.cash || 0) < 180 || !state.inventory.hammer;
  attackBtn.disabled = !state.nearestEnemy;
  if (gatherBtn) gatherBtn.disabled = !state.nearestResource;

  if (nearActivity) {
    const activity = activities.find((row) => row.id === nearActivity.id);
    targetEl.textContent = `Press E or Interact: ${activity.action} at ${activity.title}.`;
    showActivity(activity);
  } else if (nearPickup) {
    targetEl.textContent = "Press E or Interact to collect a job item.";
  } else if (nearEnemy) {
    const enemy = nearEnemy.mesh.userData.enemy;
    targetEl.textContent = `Press Space or Attack to fight ${enemy?.label || "enemy"}.`;
  } else if (nearPlayer) {
    targetEl.textContent = `Press F or Interact to network with ${nearPlayer.name}.`;
  } else if (nearNpc) {
    targetEl.textContent = `Press E or Interact to talk with ${nearNpc.name}.`;
  } else if (nearResource) {
    const node = nearResource.mesh.userData.resource;
    targetEl.textContent = `Press E or Tool to use ${node.tool} on ${node.label}.`;
  } else {
    targetEl.textContent = "Click anywhere to walk. Visit stations, collect job items, meet NPCs, and build after getting paid.";
    if (!state.selectedActivity) showActivity(null);
  }
}

function showActivity(activity) {
  if (!activityTitleEl || !activityBodyEl || !activityActionEl) return;
  state.selectedActivity = activity?.id || null;
  if (!activity) {
    activityTitleEl.textContent = "World activities";
    activityBodyEl.textContent = "Walk near a station to discover job quests, interviews, freelance gigs, agent training, or KOL routes.";
    activityActionEl.textContent = "Explore";
    activityActionEl.disabled = true;
    return;
  }
  activityTitleEl.textContent = activity.title;
  activityBodyEl.textContent = activity.prompt;
  activityActionEl.textContent = activity.action;
  activityActionEl.disabled = false;
}

function findNearestMesh(map, range) {
  if (!state.player) return null;
  let best = null;
  for (const [id, mesh] of map.entries()) {
    const d = Math.hypot(mesh.position.x / TILE - state.player.x, mesh.position.z / TILE - state.player.z);
    if (d <= range && (!best || d < best.distance)) best = { id, mesh, distance: d };
  }
  return best;
}

function findNearestActivity(range) {
  if (!state.player) return null;
  let best = null;
  for (const activity of activities) {
    const d = Math.hypot(activity.x - state.player.x, activity.z - state.player.z);
    if (d <= range && (!best || d < best.distance)) best = { id: activity.id, distance: d };
  }
  return best;
}

function findNearestPlayer(range) {
  if (!state.player) return null;
  let best = null;
  for (const [id, mesh] of state.remotePlayers.entries()) {
    const d = Math.hypot(mesh.position.x / TILE - state.player.x, mesh.position.z / TILE - state.player.z);
    if (d <= range && (!best || d < best.distance)) {
      best = { id, name: mesh.userData.playerName || "player", distance: d };
    }
  }
  return best;
}

function findNearestNpc(range) {
  if (!state.player) return null;
  let best = null;
  for (const [id, mesh] of state.npcs.entries()) {
    const npc = mesh.userData.npc || {};
    const d = Math.hypot(mesh.position.x / TILE - state.player.x, mesh.position.z / TILE - state.player.z);
    if (d <= range && (!best || d < best.distance)) {
      best = { id, name: npc.name || "NPC", role: npc.role || "Guide", mesh, distance: d };
    }
  }
  return best;
}

function findNearestResource(range) {
  if (!state.player) return null;
  let best = null;
  for (const [id, mesh] of state.resources.entries()) {
    const d = Math.hypot(mesh.position.x / TILE - state.player.x, mesh.position.z / TILE - state.player.z);
    if (d <= range && (!best || d < best.distance)) best = { id, mesh, distance: d };
  }
  return best;
}

function movement(dt) {
  if (!state.player) return;
  const speed = state.keys.has("shift") ? 8.4 : 5.4;
  const dir = new THREE.Vector3();
  if (state.keys.has("w") || state.keys.has("arrowup")) dir.z -= 1;
  if (state.keys.has("s") || state.keys.has("arrowdown")) dir.z += 1;
  if (state.keys.has("a") || state.keys.has("arrowleft")) dir.x -= 1;
  if (state.keys.has("d") || state.keys.has("arrowright")) dir.x += 1;
  if (dir.lengthSq() > 0) {
    state.moveTarget = null;
    dir.normalize();
    applyMovement(dir.x, dir.z, speed, dt);
  } else if (state.moveTarget) {
    const dx = state.moveTarget.x - state.player.x;
    const dz = state.moveTarget.z - state.player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.16) {
      state.moveTarget = null;
    } else {
      applyMovement(dx / dist, dz / dist, speed, dt);
    }
  }
  localMesh.position.set(state.player.x * TILE, 0, state.player.z * TILE);
  localMesh.rotation.y = state.player.rot;
}

let lastStepSound = 0;
function applyMovement(dx, dz, speed, dt) {
  const nextX = clamp(state.player.x + dx * speed * dt, PLAYER_MIN_X, PLAYER_MAX_X);
  const nextZ = clamp(state.player.z + dz * speed * dt, PLAYER_MIN_Z, PLAYER_MAX_Z);
  if (canStandAt(nextX, state.player.z)) {
    state.player.x = nextX;
  } else {
    state.moveTarget = null;
  }
  if (canStandAt(state.player.x, nextZ)) {
    state.player.z = nextZ;
  } else {
    state.moveTarget = null;
  }
  state.player.rot = Math.atan2(dx, dz);
  const now = performance.now();
  if (now - lastStepSound > 260) {
    sound("step");
    lastStepSound = now;
  }
}

function canStandAt(x, z) {
  const roundedX = Math.round(x);
  const roundedZ = Math.round(z);
  if (tileKind(roundedX, roundedZ) === "water" && !isBridgeAt(x, z)) return false;
  for (const rect of blockedRects) {
    if (Math.abs(x - rect.x) <= rect.w / 2 && Math.abs(z - rect.z) <= rect.d / 2) return false;
  }
  return true;
}

function isBridgeAt(x, z) {
  return bridgeRects.some((rect) => Math.abs(x - rect.x) <= rect.w / 2 && Math.abs(z - rect.z) <= rect.d / 2);
}

async function syncPlayer(force = false) {
  if (!state.player) return;
  const now = performance.now();
  if (!force && now - state.lastSync < 120) return;
  state.lastSync = now;
  try {
    const payload = await api.post("/api/rpg/player", state.player);
    if (payload.player) {
      state.player = {
        ...payload.player,
        x: state.player.x,
        z: state.player.z,
        rot: state.player.rot
      };
    }
    syncScene(payload.state || {});
  } catch {
    // next live event or poll can recover
  }
}

async function pollState(force = false) {
  if (!state.player && !force) return;
  const now = performance.now();
  if (!force && now - state.lastPoll < 1400) return;
  state.lastPoll = now;
  try {
    syncScene(await api.get("/api/rpg/state"));
  } catch {
    targetEl.textContent = "World server is not responding yet.";
  }
}

async function collectNearest() {
  if (!state.player || !state.nearestPickup) return false;
  try {
    const payload = await api.post("/api/rpg/collect", { id: state.player.id, itemId: state.nearestPickup });
    state.player = payload.player || state.player;
    sound("collect");
    syncScene(payload.state || {});
    return true;
  } catch {
    targetEl.textContent = "Move closer to collect.";
    return false;
  }
}

async function attackNearest() {
  if (!state.player || !state.nearestEnemy) return false;
  punchAnimation();
  try {
    const payload = await api.post("/api/rpg/attack", { id: state.player.id, enemyId: state.nearestEnemy });
    state.player = payload.player || state.player;
    sound("attack");
    syncScene(payload.state || {});
    return true;
  } catch {
    targetEl.textContent = "Move closer to fight.";
    return false;
  }
}

async function runActivity() {
  if (!state.player || !state.nearestActivity) return false;
  const activity = activities.find((row) => row.id === state.nearestActivity);
  if (!activity) return false;
  try {
    const payload = await api.post("/api/rpg/activity", {
      id: state.player.id,
      activity: activity.title,
      xp: activity.xp,
      pay: activity.pay || 0,
      jobTitle: activity.jobTitle || ""
    });
    state.player = payload.player || state.player;
    state.player.activity = activity.title;
    sound("activity");
    showBubble(localMesh, `+${activity.xp} XP`);
    syncScene(payload.state || {});
    targetEl.textContent = `${activity.title} complete. +${activity.xp} XP${activity.pay ? ` and $${activity.pay}` : ""}.`;
    return true;
  } catch {
    targetEl.textContent = "Activity failed. Try again.";
    return false;
  }
}

async function throwMoney() {
  if (!state.player || !state.nearestPlayer) return false;
  try {
    const payload = await api.post("/api/rpg/throw-money", {
      id: state.player.id,
      targetId: state.nearestPlayer,
      amount: 25
    });
    state.player = {
      ...(payload.player || state.player),
      x: state.player.x,
      z: state.player.z,
      rot: state.player.rot
    };
    showBubble(localMesh, "threw $25");
    sound("collect");
    syncScene(payload.state || {});
    return true;
  } catch (error) {
    targetEl.textContent = "Need game cash and a nearby live player to throw money. Open another tab to test multiplayer locally.";
    return false;
  }
}

async function buildHome() {
  if (!state.player) return false;
  if (!state.inventory.hammer) {
    targetEl.textContent = "You need a hammer first. Talk to Foreman Hex at the Construction Yard.";
    return false;
  }
  const tier = Number(state.player.cash || 0) >= 900 ? 3 : Number(state.player.cash || 0) >= 420 ? 2 : 1;
  const woodCost = tier === 1 ? 8 : tier === 2 ? 16 : 30;
  const stoneCost = tier === 1 ? 4 : tier === 2 ? 10 : 18;
  if (Number(state.inventory.wood || 0) < woodCost || Number(state.inventory.stone || 0) < stoneCost) {
    targetEl.textContent = `Need ${woodCost} wood and ${stoneCost} stone to build this home. Use axe and pickaxe first.`;
    renderInfoPanel("Inventory");
    return false;
  }
  try {
    const payload = await api.post("/api/rpg/build-home", {
      id: state.player.id,
      tier,
      x: Math.round(state.player.x + 2),
      z: Math.round(state.player.z + 2)
    });
    state.inventory.wood = Number(state.inventory.wood || 0) - woodCost;
    state.inventory.stone = Number(state.inventory.stone || 0) - stoneCost;
    state.skills.building = Number(state.skills.building || 0) + 35;
    state.player = {
      ...(payload.player || state.player),
      x: state.player.x,
      z: state.player.z,
      rot: state.player.rot
    };
    showBubble(localMesh, "built a home");
    sound("activity");
    syncScene(payload.state || {});
    renderInfoPanel(infoPanel?.hidden ? null : infoTitle?.textContent);
    return true;
  } catch {
    targetEl.textContent = "Get paid first. Homes start at $180 game cash.";
    return false;
  }
}

function gatherNearestResource() {
  if (!state.player || !state.nearestResource) return false;
  const mesh = state.resources.get(state.nearestResource);
  const node = mesh?.userData?.resource;
  if (!node) return false;
  if (!state.inventory[node.tool]) {
    targetEl.textContent = `You need a ${node.tool}. Talk to the tutorial NPC near this area.`;
    showBubble(localMesh, `need ${node.tool}`);
    return false;
  }
  if (state.selectedTool && state.selectedTool !== node.tool) {
    targetEl.textContent = `${node.label} needs ${node.tool}. Open Bag and choose ${node.tool}, or clear the selected tool.`;
    showBubble(localMesh, `use ${node.tool}`);
    return false;
  }
  if (performance.now() < state.actionUntil) return false;
  state.actionUntil = performance.now() + 850;
  state.inventory[node.gives] = Number(state.inventory[node.gives] || 0) + node.amount;
  state.skills[node.skill] = Number(state.skills[node.skill] || 0) + node.xp;
  state.player.xp = Number(state.player.xp || 0) + node.xp;
  state.player.cash = Number(state.player.cash || 0) + Math.max(4, Math.floor(node.xp / 2));
  state.player.level = 1 + Math.floor(Number(state.player.xp || 0) / 100);
  state.player.activity = `${node.label}`;
  animateToolUse(node.type, mesh);
  showBubble(localMesh, `+${node.amount} ${node.gives}`);
  targetEl.textContent = `${node.label}: +${node.amount} ${node.gives}, +${node.xp} ${node.skill} XP.`;
  sound(node.type === "fish" ? "collect" : "attack");
  renderInfoPanel(infoPanel?.hidden ? null : infoTitle?.textContent);
  syncPlayer(true);
  return true;
}

function animateToolUse(type, mesh) {
  punchAnimation();
  const startScale = mesh.scale.clone();
  mesh.scale.set(1.2, 0.82, 1.2);
  setTimeout(() => mesh.scale.copy(startScale), 180);
  if (type === "fish") {
    const splash = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: "#d9ffe9", transparent: true, opacity: 0.9 }));
    splash.rotation.x = Math.PI / 2;
    splash.position.y = 0.16;
    mesh.add(splash);
    setTimeout(() => mesh.remove(splash), 520);
  }
}

async function interactPlayer() {
  if (!state.player || !state.nearestPlayer) return false;
  try {
    const payload = await api.post("/api/rpg/interact", {
      id: state.player.id,
      targetId: state.nearestPlayer,
      kind: "shared a job lead"
    });
    state.player = payload.player || state.player;
    showBubble(localMesh, "shared a lead");
    sound("chat");
    syncScene(payload.state || {});
    return true;
  } catch {
    targetEl.textContent = "Move closer to interact.";
    return false;
  }
}

function interactNpc() {
  if (!state.player || !state.nearestNpc) return false;
  const mesh = state.npcs.get(state.nearestNpc);
  const npc = mesh?.userData?.npc;
  if (!mesh || !npc) return false;
  const lines = {
    "Recruiter Rina": "Practice one story: problem, action, result.",
    "Agent Nova": "Write SKILLS.md like a worker: search, summarize, post.",
    "Captain KOL": "Send proof, not noise. Make your application easy to share.",
    "Freelance Finn": "Small tasks stack into reputation. Ship one useful thing.",
    "Coach Mint": "Confidence is XP. Take the mock interview.",
    "Banker Byte": "Get paid first, then build. Salary turns quests into homes.",
    "Mina Sprint": "Startup work is chaos, but shipping fast pays the best.",
    "Cafe Kai": "Most jobs start as a conversation. Share one useful lead.",
    "Stage Sage": "Your story is the signal. Post progress people can believe.",
    "Wendy Wood": "Take this axe. Cut Jobwood to craft your first workstation.",
    "Miner Max": "Take this pickaxe. Offer Ore pays better when you mine it yourself.",
    "Old Fisher": "Take this rod. Fish the Referral Pond when the grind gets loud.",
    "Foreman Hex": "Take this hammer. Build after the work pays you.",
    "Armory Ari": "Take this sword. Use it when blockers get in your way."
  };
  const rewards = {
    "Wendy Wood": "axe",
    "Miner Max": "pickaxe",
    "Old Fisher": "rod",
    "Foreman Hex": "hammer",
    "Armory Ari": "sword"
  };
  const reward = rewards[npc.name];
  if (reward) {
    state.inventory[reward] = 1;
    state.selectedTool = reward;
  }
  const text = lines[npc.name] || `${npc.role}: keep exploring.`;
  showBubble(mesh, text);
  showBubble(localMesh, "got a tip");
  state.player.xp = Number(state.player.xp || 0) + 8;
  state.player.cash = Number(state.player.cash || 0) + 10;
  state.player.activity = `Talking to ${npc.name}`;
  targetEl.textContent = `${npc.name}: ${text}${reward ? ` Tool unlocked: ${reward}.` : " +8 XP and $10."}`;
  sound("chat");
  renderInfoPanel(infoPanel?.hidden ? null : infoTitle?.textContent);
  syncPlayer(true);
  return true;
}

async function primaryInteract() {
  if (state.nearestActivity) return runActivity();
  if (state.nearestPickup) return collectNearest();
  if (state.nearestPlayer) return interactPlayer();
  if (state.nearestNpc) return interactNpc();
  if (state.nearestResource) return gatherNearestResource();
  return false;
}

function punchAnimation() {
  localMesh.scale.set(1.16, 0.9, 1.16);
  setTimeout(() => localMesh.scale.set(1, 1, 1), 120);
}

function resize() {
  const rect = mount.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(320, rect.height);
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const zoom = width < 720 ? 9.5 : 13.5;
  camera.left = -zoom * aspect;
  camera.right = zoom * aspect;
  camera.top = zoom;
  camera.bottom = -zoom;
  camera.updateProjectionMatrix();
}

function setMoveTargetFromPointer(event) {
  if (!state.player || event.target !== renderer.domElement) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    const target = { x: clamp(hit.x / TILE, PLAYER_MIN_X, PLAYER_MAX_X), z: clamp(hit.z / TILE, PLAYER_MIN_Z, PLAYER_MAX_Z) };
    if (!canStandAt(target.x, target.z)) {
      targetEl.textContent = "That spot is blocked. Use bridges, docks, roads, and open paths.";
      return;
    }
    state.moveTarget = target;
    sound("step");
  }
}

function startLiveEvents() {
  if (!window.EventSource) return;
  const events = new EventSource("/api/rpg/events");
  events.addEventListener("state", (event) => syncScene(JSON.parse(event.data || "{}")));
  ["join", "chat", "collect", "battle", "activity", "interact"].forEach((name) => {
    events.addEventListener(name, (event) => syncScene(JSON.parse(event.data || "{}")));
  });
  events.onerror = () => {
    // Polling remains as fallback.
  };
}

avatarGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-avatar]");
  if (!button) return;
  avatarGrid.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
  state.avatar = button.dataset.avatar || "builder";
  state.avatarColor = button.dataset.color || avatars[state.avatar]?.color || "#7df2aa";
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await enableSoundAfterGesture(true);
  const payload = await api.post("/api/rpg/join", {
    name: nameInput.value,
    role: roleInput.value,
    color: state.avatarColor,
    avatar: state.avatar,
    x: randFloat(-2, 2),
    z: randFloat(-2, 2),
    activity: "Exploring"
  });
  state.player = payload.player;
  world.remove(localMesh);
  localMesh = makeCharacterMesh(state.player, true);
  localMesh.visible = true;
  world.add(localMesh);
  syncScene(payload.state || {});
  namegate.hidden = true;
  chatInput.blur();
  sound("join");
  startLiveEvents();
  await syncPlayer(true);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !state.player) return;
  chatInput.value = "";
  showBubble(localMesh, text);
  sound("chat");
  const payload = await api.post("/api/rpg/chat", { id: state.player.id, text });
  syncScene(payload.state || {});
});

activityActionEl?.addEventListener("click", runActivity);
interactBtn?.addEventListener("click", primaryInteract);
moneyBtn?.addEventListener("click", throwMoney);
buildBtn?.addEventListener("click", buildHome);
attackBtn?.addEventListener("click", attackNearest);
centerBtn?.addEventListener("click", () => {
  state.cameraLock = true;
  state.moveTarget = null;
});
gatherBtn?.addEventListener("click", gatherNearestResource);
bagBtn?.addEventListener("click", () => renderInfoPanel("Inventory"));
statsBtn?.addEventListener("click", () => renderInfoPanel("Stats"));
marketBtn?.addEventListener("click", () => renderInfoPanel("Marketplace"));
friendsBtn?.addEventListener("click", () => renderInfoPanel("Players"));
infoClose?.addEventListener("click", () => {
  if (infoPanel) infoPanel.hidden = true;
});
soundBtn?.addEventListener("click", async () => {
  await enableSoundAfterGesture(true);
});

async function enableSoundAfterGesture(toggle = true) {
  if (!state.audio) createAudio();
  if (state.audio?.ctx?.state === "suspended") await state.audio.ctx.resume();
  if (toggle) state.sound = !state.sound;
  soundBtn.textContent = state.sound ? "Sound on" : "Sound off";
}

renderer.domElement.addEventListener("pointerdown", setMoveTargetFromPointer);
renderer.domElement.tabIndex = 0;

window.addEventListener("keydown", (event) => {
  if (document.activeElement === chatInput && event.key !== "Enter") return;
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    state.keys.add(key);
  }
  if (key === "shift") state.keys.add("shift");
  if (key === "e") primaryInteract();
  if (key === "q") gatherNearestResource();
  if (key === "i") renderInfoPanel("Inventory");
  if (key === "m") renderInfoPanel("Marketplace");
  if (key === "f") interactPlayer();
  if (event.code === "Space") {
    event.preventDefault();
    attackNearest();
  }
  if (key === "enter" && document.activeElement !== chatInput) {
    event.preventDefault();
    chatInput.focus();
  }
});

function renderInfoPanel(mode) {
  if (!mode || !infoPanel || !infoTitle || !infoBody) return;
  infoPanel.hidden = false;
  infoTitle.textContent = mode;
  if (mode === "Inventory") {
    const items = [
      ["axe", "Axe", state.inventory.axe ? "Unlocked" : "Talk to Wendy Wood"],
      ["pickaxe", "Pickaxe", state.inventory.pickaxe ? "Unlocked" : "Talk to Miner Max"],
      ["rod", "Fishing Rod", state.inventory.rod ? "Unlocked" : "Talk to Old Fisher"],
      ["hammer", "Hammer", state.inventory.hammer ? "Unlocked" : "Talk to Foreman Hex"],
      ["sword", "Sword", state.inventory.sword ? "Unlocked" : "Talk to Armory Ari"],
      ["wood", "Wood", state.inventory.wood],
      ["stone", "Stone", state.inventory.stone],
      ["fish", "Fish", state.inventory.fish],
      ["jobProof", "Job Proof", state.inventory.jobProof]
    ];
    const tools = new Set(["axe", "pickaxe", "rod", "hammer", "sword"]);
    infoBody.innerHTML = `
      <p>Choose a tool, then stand near a matching resource and press Tool or E.</p>
      <div class="rpg-inventory-grid">${items.map(([key, name, value]) => {
        const unlocked = !tools.has(key) || state.inventory[key];
        const selected = state.selectedTool === key ? " selected" : "";
        return `<button class="rpg-inventory-item${selected}" type="button" data-tool="${tools.has(key) ? key : ""}" ${unlocked ? "" : "disabled"}><strong>${escapeHtml(name)}</strong><span>${escapeHtml(value)}</span></button>`;
      }).join("")}</div>
    `;
    infoBody.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        const tool = button.dataset.tool || "";
        if (!tool) return;
        state.selectedTool = state.selectedTool === tool ? "" : tool;
        targetEl.textContent = state.selectedTool ? `${state.selectedTool} selected.` : "Tool cleared.";
        renderInfoPanel("Inventory");
      });
    });
    return;
  }
  if (mode === "Stats") {
    const rows = Object.entries(state.skills).map(([name, xp]) => {
      const level = Math.max(1, 1 + Math.floor(Number(xp || 0) / 50));
      const pct = Math.min(100, Number(xp || 0) % 50 * 2);
      return `<div class="rpg-skill-row"><strong>${escapeHtml(name)}</strong><span>Lvl ${level}</span><i><b style="width:${pct}%"></b></i></div>`;
    }).join("");
    infoBody.innerHTML = `${rows}<div class="rpg-total-level">Total Level ${Object.values(state.skills).reduce((sum, xp) => sum + 1 + Math.floor(Number(xp || 0) / 50), 0)}</div>`;
    return;
  }
  if (mode === "Marketplace") {
    const woodValue = Number(state.inventory.wood || 0) * 6;
    const stoneValue = Number(state.inventory.stone || 0) * 8;
    const fishValue = Number(state.inventory.fish || 0) * 7;
    infoBody.innerHTML = `
      <p>Sell gathered materials for game cash, then use cash to build homes or help other players.</p>
      <button class="rpg-sell-btn" type="button" data-sell="all">Sell materials for $${woodValue + stoneValue + fishValue}</button>
    `;
    infoBody.querySelector("[data-sell='all']")?.addEventListener("click", () => {
      const total = woodValue + stoneValue + fishValue;
      if (!total) {
        targetEl.textContent = "Gather wood, stone, or fish before selling.";
        return;
      }
      state.inventory.wood = 0;
      state.inventory.stone = 0;
      state.inventory.fish = 0;
      state.player.cash = Number(state.player.cash || 0) + total;
      state.player.activity = "Sold materials";
      targetEl.textContent = `Sold materials for $${total}.`;
      sound("collect");
      syncPlayer(true);
      renderInfoPanel("Marketplace");
    });
    return;
  }
  const players = Array.from(state.remotePlayers.values()).map((mesh) => mesh.userData.playerName || "Player");
  infoBody.innerHTML = `<p>${players.length ? `Nearby live players: ${players.map(escapeHtml).join(", ")}` : "Open a second tab to test live multiplayer interactions."}</p>`;
}

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  state.keys.delete(key);
  if (key === "shift") state.keys.delete("shift");
});

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("resize", resize);
resize();
showActivity(null);

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  movement(dt);
  const t = now * 0.001;
  for (const mesh of state.pickups.values()) {
    mesh.rotation.y += dt * 1.8;
    mesh.position.y = Math.sin(t * 3 + mesh.position.x) * 0.08;
  }
  for (const mesh of state.enemies.values()) {
    mesh.rotation.y += dt * 1.15;
    mesh.position.y = Math.sin(t * 2.2 + mesh.position.z) * 0.08;
  }
  const targetX = (state.player?.x || 0) * TILE;
  const targetZ = (state.player?.z || 0) * TILE;
  state.cameraTarget.x += (targetX - state.cameraTarget.x) * 0.034;
  state.cameraTarget.z += (targetZ - state.cameraTarget.z) * 0.034;
  camera.position.x += (state.cameraTarget.x + 20 - camera.position.x) * 0.034;
  camera.position.y += (23 - camera.position.y) * 0.034;
  camera.position.z += (state.cameraTarget.z + 20 - camera.position.z) * 0.034;
  camera.lookAt(state.cameraTarget.x, 0, state.cameraTarget.z);
  updateHud();
  syncPlayer(false);
  pollState(false);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

pollState(true);
requestAnimationFrame(animate);
