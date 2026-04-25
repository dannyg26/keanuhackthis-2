# DoseWise — Frontend

A polished, hackathon-ready healthcare copilot UI built with React + TypeScript + Tailwind.

DoseWise helps users:
- Score their medication risk (0–100, explainable)
- Track daily adherence and weekly trends
- Decode medical bills line-by-line
- Read plain-language MedGuide explanations with a visual schedule

> DoseWise does **not** diagnose or treat. It is an organization and risk-awareness tool.

---

## Quick start

```bash
cd dosewise
npm install
npm run dev
```

Then open <http://localhost:5173>.

To build for production:

```bash
npm run build
npm run preview
```

---

## Tech stack

- **React 19 + TypeScript** (Vite)
- **Tailwind CSS** with a custom DoseWise theme (`tailwind.config.js`)
- **react-router-dom** for routing
- **recharts** for the adherence chart
- **localStorage** for persistence — no backend required

---

## Project structure

```
src/
  assets/logo.jpg              DoseWise mascot logo (used across the app)
  components/
    Layout.tsx                 Sidebar + mobile nav shell
    Logo.tsx                   Logo + wordmark
    Icon.tsx                   Inline SVG icon set
    PageHeader.tsx             Reusable page header
    StatCard.tsx               Reusable stat tile
    RiskGauge.tsx              SVG circular risk gauge
  pages/
    Landing.tsx                Public landing page
    Dashboard.tsx              Main dashboard
    RiskEngine.tsx             Medication Risk Engine form + result
    Adherence.tsx              Adherence tracker + weekly chart
    Bills.tsx                  Medical Bill Breakdown
    MedGuide.tsx               "Explain my medication" companion
  data/
    sampleMedications.ts       Realistic sample meds for instant demo
    sampleBill.ts              Sample bill text + interactions
  utils/
    risk.ts                    Explainable rule-based risk engine
    bill.ts                    Bill parser + flagging
    storage.ts                 localStorage helpers
  types/index.ts               Shared TypeScript types
  App.tsx                      Routes
  main.tsx                     Entry
  index.css                    Tailwind + design tokens
```

---

## Routes

| Path           | Page          |
| -------------- | ------------- |
| `/`            | Landing       |
| `/dashboard`   | Main dashboard |
| `/risk`        | Medication Risk Engine |
| `/adherence`   | Adherence Tracker |
| `/bills`       | Bill Breakdown |
| `/medguide`    | MedGuide |

---

## Risk scoring rules (explainable)

| Factor                                       | Points |
| -------------------------------------------- | -----: |
| Drug interaction found                       |    +30 |
| Alcohol use with sedating medication         |    +25 |
| Frequent missed doses (≥ 2 / week)           |    +20 |
| Sleep under 5 hours                          |    +15 |
| Inconsistent medication timing               |    +15 |
| Age 65 or older                              |    +15 |
| 3 or more medications                        |    +10 |

Capped at **100**. Levels: **Low** (< 30), **Moderate** (30–59), **High** (≥ 60).

Implemented in `src/utils/risk.ts`.

---

## Bill parsing

Lines like `Description - $123.45` are parsed and flagged when:
- A description repeats (duplicate)
- An amount exceeds a category threshold (unusually high)
- Description is vague (`misc`, `supplies`, `processing`, etc.)
- Description includes "facility" (often negotiable)

See `src/utils/bill.ts`.

---

## Sample data

The app loads with realistic sample data so it's demo-ready immediately:
- 4 medications (Lisinopril, Metformin, Atorvastatin, Sertraline)
- A 14-day seeded adherence history
- A sample bill ready to analyze

All sample data lives in `src/data/`.

---

## Design notes

- Brand color: teal (`#1aaca8`) inspired by the mascot logo
- Soft healthcare gradients, rounded 2xl corners, subtle shadows
- Plus Jakarta Sans for headlines, Inter for body
- Fully responsive: sidebar on desktop, top + bottom nav on mobile
- No emojis, no clutter — designed for a hackathon demo
