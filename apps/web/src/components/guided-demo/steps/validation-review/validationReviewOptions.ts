import type {
  ReviewConditionGrade,
  ReviewCorrectionCategory,
  ReviewCorrectionShaftFlex,
} from "../../../../types/workflow";

export const CATEGORY_OPTIONS: Array<{
  label: string;
  value: ReviewCorrectionCategory;
}> = [
  { label: "Driver", value: "DRIVER" },
  { label: "Fairway Wood", value: "FAIRWAY_WOOD" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Iron Set", value: "IRON_SET" },
  { label: "Wedge", value: "WEDGE" },
  { label: "Putter", value: "PUTTER" },
];

export const SHAFT_FLEX_OPTIONS: Array<{
  label: string;
  value: ReviewCorrectionShaftFlex;
}> = [
  { label: "Stiff", value: "STIFF" },
  { label: "Regular", value: "REGULAR" },
  { label: "Senior", value: "SENIOR" },
  { label: "X-Stiff", value: "X_STIFF" },
  { label: "Ladies", value: "LADIES" },
  { label: "Tour X-Stiff", value: "TOUR_X_STIFF" },
];

export const CONDITION_GRADE_OPTIONS: ReviewConditionGrade[] = [
  "9.5 Mint",
  "9.0 Above Average",
  "8.0 Average",
  "7.0 Below Average",
  "6.0 Poor",
];
