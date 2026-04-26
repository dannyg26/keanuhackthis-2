import type { Coupon, PharmacyPrice } from "../types";

export const SAMPLE_COUPONS: Coupon[] = [
  {
    id: "lis-grx",
    medication: "Lisinopril 10mg",
    pharmacy: "CVS Pharmacy",
    originalPrice: 24.99,
    couponPrice: 4.50,
    expiresOn: "2026-12-31",
    code: "GRX-LIS-4502",
    source: "GoodRx",
    note: "Show this code at the pharmacy counter to apply.",
  },
  {
    id: "met-mfr",
    medication: "Metformin 500mg",
    pharmacy: "Walgreens",
    originalPrice: 16.50,
    couponPrice: 2.00,
    expiresOn: "2026-09-15",
    code: "MFR-MET-CARE",
    source: "Manufacturer",
    note: "Manufacturer copay assistance card. One use per fill.",
  },
  {
    id: "ato-grx",
    medication: "Atorvastatin 20mg",
    pharmacy: "Costco Pharmacy",
    originalPrice: 32.00,
    couponPrice: 8.75,
    expiresOn: "2026-08-30",
    code: "GRX-ATO-8875",
    source: "GoodRx",
  },
  {
    id: "ser-ins",
    medication: "Sertraline 50mg",
    pharmacy: "Rite Aid",
    originalPrice: 28.40,
    couponPrice: 9.20,
    expiresOn: "2026-11-01",
    code: "INS-SER-PLAN-A",
    source: "Insurance",
    note: "Tier 1 generic preferred. Use insurance card with this BIN.",
  },
  {
    id: "lis-local",
    medication: "Lisinopril 10mg",
    pharmacy: "Local Independent Rx",
    originalPrice: 22.00,
    couponPrice: 6.00,
    expiresOn: "2026-07-22",
    code: "LOCAL-LIS-200",
    source: "Local",
    note: "Independent pharmacy weekly special.",
  },
];

export const SAMPLE_PHARMACY_PRICES: Record<string, PharmacyPrice[]> = {
  "Lisinopril 10mg": [
    { pharmacy: "CVS Pharmacy",         distanceMiles: 0.4, cashPrice: 24.99, withCouponPrice: 4.50 },
    { pharmacy: "Walgreens",            distanceMiles: 0.7, cashPrice: 23.10, withCouponPrice: 5.20 },
    { pharmacy: "Costco Pharmacy",      distanceMiles: 2.1, cashPrice: 12.50, withCouponPrice: 4.10 },
    { pharmacy: "Local Independent Rx", distanceMiles: 1.3, cashPrice: 22.00, withCouponPrice: 6.00 },
  ],
  "Metformin 500mg": [
    { pharmacy: "Walgreens",            distanceMiles: 0.7, cashPrice: 16.50, withCouponPrice: 2.00 },
    { pharmacy: "CVS Pharmacy",         distanceMiles: 0.4, cashPrice: 18.00, withCouponPrice: 3.40 },
    { pharmacy: "Costco Pharmacy",      distanceMiles: 2.1, cashPrice: 9.20,  withCouponPrice: 2.80 },
  ],
  "Atorvastatin 20mg": [
    { pharmacy: "Costco Pharmacy",      distanceMiles: 2.1, cashPrice: 32.00, withCouponPrice: 8.75 },
    { pharmacy: "CVS Pharmacy",         distanceMiles: 0.4, cashPrice: 41.50, withCouponPrice: 11.40 },
    { pharmacy: "Rite Aid",             distanceMiles: 1.8, cashPrice: 38.60, withCouponPrice: 12.20 },
  ],
  "Sertraline 50mg": [
    { pharmacy: "Rite Aid",             distanceMiles: 1.8, cashPrice: 28.40, withCouponPrice: 9.20 },
    { pharmacy: "Walgreens",            distanceMiles: 0.7, cashPrice: 31.00, withCouponPrice: 10.50 },
    { pharmacy: "Costco Pharmacy",      distanceMiles: 2.1, cashPrice: 18.40, withCouponPrice: 7.80 },
  ],
};
