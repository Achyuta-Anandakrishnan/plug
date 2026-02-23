export const GRADING_COMPANIES = [
  "PSA",
  "BGS",
  "CGC",
  "SGC",
  "TAG",
  "BVG",
  "CSG",
  "HGA",
  "GMA",
  "MNT",
  "ISA",
  "KSA",
  "AGS",
  "Arena Club",
  "Other",
] as const;

export type GradePrecision = "WHOLE" | "HALF";

const WHOLE_GRADES = Array.from({ length: 10 }, (_, index) => `${index + 1}`);
const HALF_GRADES = Array.from({ length: 19 }, (_, index) => `${(index + 2) / 2}`);

type GradingProfile = {
  supportsHalfGrades: boolean;
  defaultPrecision: GradePrecision;
  labelOptions: string[];
  note: string;
};

const GRADING_PROFILES: Record<string, GradingProfile> = {
  PSA: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "PSA supports half-point grades (for example 2.5, 6.5).",
  },
  BGS: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: ["Gold Label", "Black Label"],
    note: "BGS supports half-point grades and premium gold/black label tiers.",
  },
  CGC: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: ["Gold Label"],
    note: "CGC supports half-point grades and premium pristine label tiers.",
  },
  SGC: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "SGC grading supports half-point values when needed.",
  },
  TAG: {
    supportsHalfGrades: false,
    defaultPrecision: "WHOLE",
    labelOptions: [],
    note: "TAG uses a standardized numeric grade; premium label tiers are not used here.",
  },
  BVG: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "BVG supports half-point style card grades.",
  },
  CSG: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: ["Gold Label"],
    note: "CSG supports half-point values and premium top labels.",
  },
  HGA: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "HGA supports half-point grading values.",
  },
  GMA: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "GMA supports half-point grading values.",
  },
  MNT: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "MNT supports half-point grading values.",
  },
  ISA: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "ISA supports half-point grading values.",
  },
  KSA: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "KSA supports half-point grading values.",
  },
  AGS: {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "AGS supports half-point grading values.",
  },
  "Arena Club": {
    supportsHalfGrades: true,
    defaultPrecision: "HALF",
    labelOptions: [],
    note: "Arena Club supports half-point grading values.",
  },
  Other: {
    supportsHalfGrades: false,
    defaultPrecision: "WHOLE",
    labelOptions: [],
    note: "Use custom grading details for other companies.",
  },
};

export function getGradingProfile(company: string) {
  return GRADING_PROFILES[company] ?? GRADING_PROFILES.Other;
}

export function getGradeOptions(company: string, precision: GradePrecision = "WHOLE") {
  const half = precision === "HALF";
  switch (company) {
    case "BGS":
    case "CGC":
    case "SGC":
    case "PSA":
    case "BVG":
    case "CSG":
    case "HGA":
    case "GMA":
    case "MNT":
    case "ISA":
    case "KSA":
    case "AGS":
    case "Arena Club":
      return half ? HALF_GRADES : WHOLE_GRADES;
    case "TAG":
    case "Other":
      return WHOLE_GRADES;
    default:
      return WHOLE_GRADES;
  }
}
