export type BillFlagType = "duplicate" | "high" | "vague" | "facility";

export interface BillFlag { type: BillFlagType; message: string; }

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  flags: BillFlag[];
  explanation: string;
}

const HIGH_THRESHOLDS: Record<string, number> = {
  default: 500,
  "blood panel": 200,
  "blood test": 200,
  "lab": 100,
  "lab processing": 75,
  "supplies": 50,
  "saline": 100,
  "iv bag": 100,
  "imaging review": 250,
  "physician evaluation": 250,
};

const VAGUE_KEYWORDS = ["misc", "miscellaneous", "supplies", "fee", "processing", "review"];

const EXPLANATIONS: Array<{ match: RegExp; text: string }> = [
  { match: /emergency room facility/i, text: "Charge for using the ER room and equipment, separate from any doctor's services." },
  { match: /comprehensive blood panel|cbc|metabolic panel/i, text: "A bundled set of blood tests checking general health markers." },
  { match: /physician evaluation|provider eval/i, text: "The doctor's professional fee for examining you and making clinical decisions." },
  { match: /lab processing/i, text: "An add-on charge for handling the sample in the lab — sometimes overlaps with the test itself." },
  { match: /saline|iv bag/i, text: "A bag of sterile fluids given through an IV; the fluid itself is usually inexpensive at wholesale." },
  { match: /imaging|x-?ray|mri|ct/i, text: "Charge for reading and interpreting an imaging study (separate from taking the image)." },
  { match: /supplies|misc/i, text: "A catch-all line item that often deserves an itemized breakdown." },
];

function explain(description: string): string {
  for (const e of EXPLANATIONS) if (e.match.test(description)) return e.text;
  return "A general healthcare charge — ask for an itemized description if it is unclear.";
}

function highThresholdFor(description: string): number {
  const d = description.toLowerCase();
  for (const k of Object.keys(HIGH_THRESHOLDS)) {
    if (d.includes(k)) return HIGH_THRESHOLDS[k];
  }
  return HIGH_THRESHOLDS.default;
}

export function parseBillText(input: string): BillItem[] {
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const items: BillItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)[\s\-–—:]+\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$/);
    if (!m) continue;
    const description = m[1].trim().replace(/[-–—:]+$/, "").trim();
    const amount = parseFloat(m[2].replace(/,/g, ""));
    if (!isFinite(amount) || !description) continue;
    items.push({ id: `${description}-${items.length}`, description, amount, flags: [], explanation: explain(description) });
  }
  return flagItems(items);
}

export function flagItems(items: BillItem[]): BillItem[] {
  const seen = new Map<string, number[]>();
  items.forEach((it, i) => {
    const key = it.description.toLowerCase();
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(i);
  });

  return items.map((it, i) => {
    const flags: BillFlag[] = [];
    const dupIdxs = seen.get(it.description.toLowerCase()) || [];
    if (dupIdxs.length > 1 && dupIdxs[0] !== i) flags.push({ type: "duplicate", message: "Possible duplicate of an earlier charge." });
    else if (dupIdxs.length > 1) flags.push({ type: "duplicate", message: "Appears more than once on this bill." });
    if (it.amount > highThresholdFor(it.description)) flags.push({ type: "high", message: "Higher than typical for this kind of line item." });
    if (VAGUE_KEYWORDS.some(k => it.description.toLowerCase().includes(k))) flags.push({ type: "vague", message: "Vague description — request an itemized breakdown." });
    if (/facility/i.test(it.description)) flags.push({ type: "facility", message: "Facility fees are often negotiable, especially out-of-network." });
    return { ...it, flags };
  });
}

export function billTotal(items: BillItem[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}
