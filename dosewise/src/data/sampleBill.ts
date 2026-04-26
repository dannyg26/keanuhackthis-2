export const SAMPLE_BILL_TEXT = `Emergency Room Facility Fee - $980
Comprehensive Blood Panel - $320
Physician Evaluation - $150
Lab Processing Fee - $320
Saline IV Bag - $215
Misc. Supplies - $89
Imaging Review - $410`;

export const SEDATING_CATEGORIES = [
  "antihistamine",
  "benzodiazepine",
  "opioid",
  "sleep aid",
  "muscle relaxant",
  "antidepressant",
];

export const COMMON_INTERACTING_PAIRS: Array<[string, string, string]> = [
  ["warfarin", "ibuprofen", "Increased bleeding risk"],
  ["warfarin", "aspirin", "Increased bleeding risk"],
  ["lisinopril", "potassium", "Risk of high potassium"],
  ["metformin", "alcohol", "Risk of low blood sugar and lactic acidosis"],
  ["sertraline", "tramadol", "Risk of serotonin syndrome"],
  ["atorvastatin", "grapefruit", "Increased statin side effects"],
  ["simvastatin", "amiodarone", "Increased muscle damage risk"],
];
