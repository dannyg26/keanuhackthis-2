/**
 * Curated list of REAL, public medication discount programs.
 * Each program lists the generic drug names it covers (lowercase, no dosage).
 * These are real services anyone can sign up for or use directly.
 */

import type { CouponSource } from "../lib/api";

export interface RealOffer {
  id: string;
  programName: string;     // e.g. "Walmart $4 Generic Prescriptions"
  pharmacy: string;        // Pharmacy/chain name
  source: CouponSource;    // Maps to CouponSource for the existing ticket palette
  url: string;             // Where to learn more / redeem
  note: string;            // Short description of how the program works
  estimatedRetail: number; // Typical cash price without the program (USD)
  estimatedPrice: number;  // Price with this program (USD)
  expiresOn: string;       // Most are ongoing — far-future placeholder date
  code: string;            // Code or program tag shown on the ticket
  eligible: string[];      // Lowercase drug names this program covers
}

// Common $4 / low-cost generic list — most major chains have a similar tier.
// (Source: Walmart, Costco, Kroger, Sam's Club public generic lists.)
const COMMON_4_LIST_GENERICS = [
  "lisinopril", "amlodipine", "losartan", "metoprolol", "hydrochlorothiazide",
  "furosemide", "atenolol", "atorvastatin", "simvastatin", "pravastatin",
  "metformin", "glipizide", "levothyroxine",
  "omeprazole", "ranitidine", "famotidine", "pantoprazole",
  "sertraline", "fluoxetine", "citalopram", "escitalopram", "bupropion", "trazodone",
  "gabapentin", "amitriptyline",
  "amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline",
  "prednisone", "methylprednisolone",
  "ibuprofen", "naproxen", "acetaminophen",
  "albuterol",
];

export const REAL_OFFERS: RealOffer[] = [
  {
    id: "walmart-4-generics",
    programName: "Walmart $4 Generics",
    pharmacy: "Walmart Pharmacy",
    source: "Local",
    url: "https://www.walmart.com/cp/4-prescriptions/1078664",
    note: "$4 for a 30-day supply or $10 for a 90-day supply on hundreds of generic medications. No membership required.",
    estimatedRetail: 22,
    estimatedPrice: 4,
    expiresOn: "2030-12-31",
    code: "WALMART-$4-RX",
    eligible: COMMON_4_LIST_GENERICS,
  },
  {
    id: "costco-member-rx",
    programName: "Costco Member Prescription Program",
    pharmacy: "Costco Pharmacy",
    source: "Local",
    url: "https://www.costco.com/pharmacy-member-prescription-program.html",
    note: "Discounted cash prices on generics for Costco members. You don't need to use insurance.",
    estimatedRetail: 28,
    estimatedPrice: 7,
    expiresOn: "2030-12-31",
    code: "COSTCO-MEMBER-RX",
    eligible: COMMON_4_LIST_GENERICS,
  },
  {
    id: "kroger-rx-club",
    programName: "Kroger Rx Savings Club",
    pharmacy: "Kroger Pharmacy",
    source: "Local",
    url: "https://www.krogerprescriptionsavings.com/",
    note: "$36/year membership ($72 family). Hundreds of generics free or $3–$6. Available at Kroger family stores.",
    estimatedRetail: 24,
    estimatedPrice: 6,
    expiresOn: "2030-12-31",
    code: "KROGER-RX-CLUB",
    eligible: [
      ...COMMON_4_LIST_GENERICS,
      "cetirizine", "loratadine", "diphenhydramine", "ondansetron",
    ],
  },
  {
    id: "cost-plus-drugs",
    programName: "Mark Cuban Cost Plus Drug Company",
    pharmacy: "Cost Plus Drugs",
    source: "Custom",
    url: "https://costplusdrugs.com/",
    note: "Transparent pricing: manufacturer cost + 15% + $5 pharmacy fee + shipping. Often the lowest price on common generics.",
    estimatedRetail: 30,
    estimatedPrice: 8,
    expiresOn: "2030-12-31",
    code: "COSTPLUSDRUGS",
    eligible: [
      ...COMMON_4_LIST_GENERICS,
      "tadalafil", "sildenafil", "finasteride", "ezetimibe", "rosuvastatin",
      "valsartan", "carvedilol", "spironolactone", "tamsulosin",
    ],
  },
  {
    id: "goodrx-free",
    programName: "GoodRx Free Coupons",
    pharmacy: "Most major pharmacies",
    source: "GoodRx",
    url: "https://www.goodrx.com/",
    note: "Free coupons usable at CVS, Walgreens, Walmart, Kroger, and many more. No signup needed.",
    estimatedRetail: 35,
    estimatedPrice: 12,
    expiresOn: "2030-12-31",
    code: "GOODRX-FREE",
    // GoodRx covers nearly everything — leave eligible empty to mean "any med"
    eligible: [],
  },
  {
    id: "needymeds",
    programName: "NeedyMeds Patient Assistance Programs",
    pharmacy: "Manufacturer / NeedyMeds",
    source: "Manufacturer",
    url: "https://www.needymeds.org/",
    note: "Directory of free / low-cost medication assistance programs from manufacturers. Income-based eligibility for many programs.",
    estimatedRetail: 120,
    estimatedPrice: 0,
    expiresOn: "2030-12-31",
    code: "NEEDYMEDS-PAP",
    eligible: [], // matches any med — directory covers thousands
  },
  {
    id: "blink-health",
    programName: "Blink Health",
    pharmacy: "Participating pharmacies",
    source: "GoodRx",
    url: "https://www.blinkhealth.com/",
    note: "Pre-pay prices for generic medications. Pickup at participating pharmacies or get them mailed.",
    estimatedRetail: 30,
    estimatedPrice: 9,
    expiresOn: "2030-12-31",
    code: "BLINKHEALTH",
    eligible: COMMON_4_LIST_GENERICS,
  },
];

/** Strip dosage / form words to get just the drug name. */
function drugBaseName(medName: string): string {
  return medName
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%)\b/gi, "")
    .replace(/\b(tablet|capsule|cap|tab|pill|liquid|gel|cream|patch|injection|er|xr|sr)s?\b/gi, "")
    .trim()
    .toLowerCase();
}

/**
 * For a given user medication, return all real offers that apply.
 * An offer applies if its eligible list contains the drug's base name,
 * OR if its eligible list is empty (catch-all programs like GoodRx).
 */
export function offersForMed(medName: string): RealOffer[] {
  const base = drugBaseName(medName);
  return REAL_OFFERS.filter((o) =>
    o.eligible.length === 0 || o.eligible.some((e) => base.includes(e)),
  );
}
