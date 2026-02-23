export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "Other"] as const;

const WHOLE_GRADES = Array.from({ length: 10 }, (_, index) => `${index + 1}`);
const HALF_GRADES = Array.from({ length: 19 }, (_, index) => `${(index + 2) / 2}`);

export function getGradeOptions(company: string) {
  switch (company) {
    case "PSA":
      return [...WHOLE_GRADES.slice(0, 9), "10 GEM MINT"];
    case "BGS":
      return HALF_GRADES;
    case "CGC":
    case "SGC":
    case "TAG":
      return WHOLE_GRADES;
    default:
      return [];
  }
}
