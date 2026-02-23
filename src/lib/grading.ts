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

const WHOLE_GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const HALF_GRADES = [
  "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5",
  "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10",
];

const GRADE_OPTIONS_BY_COMPANY: Record<string, string[]> = {
  PSA: HALF_GRADES,
  BGS: HALF_GRADES,
  CGC: HALF_GRADES,
  SGC: HALF_GRADES,
  TAG: WHOLE_GRADES,
  BVG: HALF_GRADES,
  CSG: HALF_GRADES,
  HGA: HALF_GRADES,
  GMA: HALF_GRADES,
  MNT: HALF_GRADES,
  ISA: HALF_GRADES,
  KSA: HALF_GRADES,
  AGS: HALF_GRADES,
  "Arena Club": HALF_GRADES,
  Other: WHOLE_GRADES,
};

type GradingProfile = {
  labelOptions: string[];
  note: string;
};

const GRADING_PROFILES: Record<string, GradingProfile> = {
  PSA: {
    labelOptions: [],
    note: "PSA dropdown uses the available PSA number scale.",
  },
  BGS: {
    labelOptions: ["Gold Label", "Black Label"],
    note: "BGS supports premium Gold/Black label tiers.",
  },
  CGC: {
    labelOptions: ["Gold Label"],
    note: "CGC supports premium pristine label tiers.",
  },
  SGC: {
    labelOptions: [],
    note: "SGC dropdown uses the available SGC number scale.",
  },
  TAG: {
    labelOptions: [],
    note: "TAG dropdown uses the available TAG number scale.",
  },
  BVG: {
    labelOptions: [],
    note: "BVG dropdown uses the available BVG number scale.",
  },
  CSG: {
    labelOptions: ["Gold Label"],
    note: "CSG supports premium label tiers.",
  },
  HGA: {
    labelOptions: [],
    note: "HGA dropdown uses the available HGA number scale.",
  },
  GMA: {
    labelOptions: [],
    note: "GMA dropdown uses the available GMA number scale.",
  },
  MNT: {
    labelOptions: [],
    note: "MNT dropdown uses the available MNT number scale.",
  },
  ISA: {
    labelOptions: [],
    note: "ISA dropdown uses the available ISA number scale.",
  },
  KSA: {
    labelOptions: [],
    note: "KSA dropdown uses the available KSA number scale.",
  },
  AGS: {
    labelOptions: [],
    note: "AGS dropdown uses the available AGS number scale.",
  },
  "Arena Club": {
    labelOptions: [],
    note: "Arena Club dropdown uses the available Arena Club number scale.",
  },
  Other: {
    labelOptions: [],
    note: "Use custom grading details for other companies.",
  },
};

export function getGradingProfile(company: string) {
  return GRADING_PROFILES[company] ?? GRADING_PROFILES.Other;
}

export function getGradeOptions(company: string) {
  return GRADE_OPTIONS_BY_COMPANY[company] ?? WHOLE_GRADES;
}
