const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Mock rewards catalog
const REWARDS = [
  { id: "sticker_pack", title: "Sticker Pack", cost: 30, description: "A set of WasteWise neon stickers." },
  { id: "reusable_bottle", title: "Reusable Bottle", cost: 120, description: "Branded 500ml reusable bottle." },
  { id: "donation_5", title: "Donate $5", cost: 200, description: "Donate $5 to local cleanup initiatives." },
];

// Simple mock classify endpoint — accepts an image file and returns the same
// shape as the front-end's mockClassify result so integration is smooth.
app.post("/api/classify", upload.single("image"), (req, res) => {
  const name = (req.file && req.file.originalname) || "upload.jpg";
  // lightweight deterministic hash -> pick a category
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.abs(h);
  const categories = [
    "plastic",
    "paper",
    "organic",
    "ewaste",
    "glass",
    "metal",
    "hazardous",
  ];
  const idx = h % categories.length;
  const confidence = 80 + (h % 15);
  const hazardScore = categories[idx] === "hazardous" ? 0.9 : 0.03 + ((h >> 3) % 12) / 100;
  res.json({ categoryId: categories[idx], confidence, hazardScore });
});

// Return rewards catalog
app.get("/api/rewards", (req, res) => {
  res.json(REWARDS);
});

// Redeem a reward (mock) — accepts { rewardId }
app.post("/api/redeem", (req, res) => {
  const { rewardId } = req.body || {};
  const reward = REWARDS.find((r) => r.id === rewardId);
  if (!reward) return res.status(404).json({ error: "Unknown reward" });
  // In a real app, check auth and server-side balances. Here we just echo success.
  return res.json({ ok: true, reward: { id: reward.id, title: reward.title, cost: reward.cost } });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`WasteWise mock API listening on port ${port}`));
