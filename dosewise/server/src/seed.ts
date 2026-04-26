import "dotenv/config";
import { db, initDb, uid } from "./db.ts";
import { hashPassword } from "./auth.ts";

initDb();

const DEMO_EMAIL = "demo@clarity.app";
const DEMO_PASSWORD = "clarity123";
const DEMO_NAME = "Demo User";

const SAMPLE_MEDS = [
  {
    name: "Lisinopril", dosage: "10 mg tablet", frequency: "Once daily",
    purpose: "Lowers blood pressure and protects the kidneys.",
    category: "Blood pressure (ACE inhibitor)",
    sideEffects: ["Dry cough", "Mild dizziness when standing up", "Slightly higher potassium levels"],
    callDoctor: ["Swelling of lips, tongue, or face", "Trouble breathing or swallowing", "Persistent dizziness"],
    schedule: [{ time: "08:00", label: "Morning", withFood: false }],
    refillsLeft: 2,
  },
  {
    name: "Metformin", dosage: "500 mg tablet", frequency: "Twice daily with meals",
    purpose: "Helps your body use insulin and lowers blood sugar.",
    category: "Type 2 diabetes",
    sideEffects: ["Upset stomach or nausea", "Mild diarrhea (usually passes)", "Metallic taste"],
    callDoctor: ["Severe muscle pain or weakness", "Trouble breathing", "Cold or numb hands and feet"],
    schedule: [
      { time: "08:00", label: "Morning", withFood: true },
      { time: "19:00", label: "Evening", withFood: true },
    ],
    refillsLeft: 1,
  },
  {
    name: "Atorvastatin", dosage: "20 mg tablet", frequency: "Once daily at bedtime",
    purpose: "Lowers cholesterol and reduces heart disease risk.",
    category: "Cholesterol (statin)",
    sideEffects: ["Muscle aches", "Mild headache", "Occasional digestive upset"],
    callDoctor: ["Unexplained muscle pain", "Dark urine", "Yellowing of skin or eyes"],
    schedule: [{ time: "21:00", label: "Bedtime", withFood: false }],
    refillsLeft: 3,
  },
  {
    name: "Sertraline", dosage: "50 mg tablet", frequency: "Once daily",
    purpose: "Helps balance brain chemicals to ease depression and anxiety.",
    category: "Antidepressant (SSRI)",
    sideEffects: ["Trouble sleeping or drowsiness", "Reduced appetite", "Mild nausea early on"],
    callDoctor: ["Thoughts of self-harm", "Severe mood changes", "Unusual bleeding or bruising"],
    schedule: [{ time: "08:00", label: "Morning", withFood: true }],
    refillsLeft: 4,
  },
];

const SAMPLE_COUPONS = [
  { medication: "Lisinopril 10mg",   pharmacy: "CVS Pharmacy",          originalPrice: 24.99, couponPrice: 4.50, expiresOn: "2026-12-31", code: "GRX-LIS-4502", source: "GoodRx",       note: "Show this code at the pharmacy counter to apply.", saved: 1 },
  { medication: "Metformin 500mg",   pharmacy: "Walgreens",              originalPrice: 16.50, couponPrice: 2.00, expiresOn: "2026-09-15", code: "MFR-MET-CARE", source: "Manufacturer", note: "Manufacturer copay assistance card. One use per fill.", saved: 1 },
  { medication: "Atorvastatin 20mg", pharmacy: "Costco Pharmacy",        originalPrice: 32.00, couponPrice: 8.75, expiresOn: "2026-08-30", code: "GRX-ATO-8875", source: "GoodRx",       note: null,                                                  saved: 1 },
  { medication: "Sertraline 50mg",   pharmacy: "Rite Aid",                originalPrice: 28.40, couponPrice: 9.20, expiresOn: "2026-11-01", code: "INS-SER-A",    source: "Insurance",    note: "Tier 1 generic preferred. Use insurance card with this BIN.", saved: 0 },
  { medication: "Lisinopril 10mg",   pharmacy: "Local Independent Rx",   originalPrice: 22.00, couponPrice: 6.00, expiresOn: "2026-07-22", code: "LOCAL-LIS-200", source: "Local",        note: "Independent pharmacy weekly special.", saved: 0 },
];

async function ensureDemoUser() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEMO_EMAIL) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = uid("user");
  const hash = await hashPassword(DEMO_PASSWORD);
  db.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
    .run(id, DEMO_EMAIL, DEMO_NAME, hash);
  return id;
}

function seedMedications(userId: string) {
  db.prepare("DELETE FROM medications WHERE user_id = ?").run(userId);
  const insert = db.prepare(`
    INSERT INTO medications (id, user_id, name, dosage, frequency, purpose, category, side_effects, call_doctor, schedule, refills_left)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of SAMPLE_MEDS) {
    insert.run(
      uid("med"), userId, m.name, m.dosage, m.frequency, m.purpose, m.category,
      JSON.stringify(m.sideEffects), JSON.stringify(m.callDoctor), JSON.stringify(m.schedule),
      m.refillsLeft,
    );
  }
}

function seedCoupons(userId: string) {
  db.prepare("DELETE FROM coupons WHERE user_id = ?").run(userId);
  const insert = db.prepare(`
    INSERT INTO coupons (id, user_id, medication, pharmacy, original_price, coupon_price, expires_on, code, source, note, saved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of SAMPLE_COUPONS) {
    insert.run(
      uid("cpn"), userId, c.medication, c.pharmacy, c.originalPrice, c.couponPrice,
      c.expiresOn, c.code, c.source, c.note, c.saved,
    );
  }
}

function seedAdherence(userId: string) {
  db.prepare("DELETE FROM adherence_logs WHERE user_id = ?").run(userId);
  const meds = db.prepare("SELECT id FROM medications WHERE user_id = ?").all(userId) as Array<{ id: string }>;
  const insert = db.prepare(
    "INSERT INTO adherence_logs (id, user_id, medication_id, date, taken) VALUES (?, ?, ?, ?, ?)",
  );

  const today = new Date();
  for (let i = 13; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    for (const m of meds) {
      const seed = (date + m.id).split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      const taken = isWeekend ? seed % 4 !== 0 : seed % 9 !== 0;
      insert.run(uid("log"), userId, m.id, date, taken ? 1 : 0);
    }
  }
}

async function main() {
  const userId = await ensureDemoUser();
  seedMedications(userId);
  seedCoupons(userId);
  seedAdherence(userId);
  console.log("Seeded demo data.");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
