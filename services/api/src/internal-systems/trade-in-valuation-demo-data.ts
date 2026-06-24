export type DemoValuationRange = {
  productId: string;
  lowValue: number;
  highValue: number;
  evidence: string[];
};

export const demoValuationRanges: DemoValuationRange[] = [
  {
    productId: "prod_taylormade_stealth2_driver_2023",
    lowValue: 135,
    highValue: 185,
    evidence: [
      "Seeded demo range for TaylorMade Stealth 2 driver.",
      "Driver category receives accessory and crown-condition adjustments."
    ]
  },
  {
    productId: "prod_titleist_tsr2_fairway_2023",
    lowValue: 105,
    highValue: 145,
    evidence: [
      "Seeded demo range for Titleist TSR2 fairway wood.",
      "Fairway wood range is sensitive to face wear and included headcover."
    ]
  },
  {
    productId: "prod_titleist_tsr3_fairway_2023",
    lowValue: 115,
    highValue: 155,
    evidence: [
      "Seeded demo range for Titleist TSR3 fairway wood.",
      "Similar Titleist TSR fairway products may require review when model is ambiguous."
    ]
  },
  {
    productId: "prod_titleist_ts2_fairway_2019",
    lowValue: 70,
    highValue: 105,
    evidence: [
      "Seeded demo range for Titleist TS2 fairway wood.",
      "Older fairway wood product family uses a lower seeded demo range."
    ]
  },
  {
    productId: "prod_callaway_rogue_st_max_driver_2022",
    lowValue: 120,
    highValue: 165,
    evidence: [
      "Seeded demo range for Callaway Rogue ST Max driver.",
      "Driver category receives accessory and paint-condition adjustments."
    ]
  },
  {
    productId: "prod_ping_g425_iron_set_2021",
    lowValue: 210,
    highValue: 290,
    evidence: [
      "Seeded demo range for PING G425 iron set.",
      "Iron set value is sensitive to set composition and grip condition."
    ]
  },
  {
    productId: "prod_ping_g430_max_driver_2023",
    lowValue: 190,
    highValue: 250,
    evidence: [
      "Seeded demo range for PING G430 Max driver.",
      "Current-generation driver range is sensitive to loft, shaft and condition grade."
    ]
  },
  {
    productId: "prod_cleveland_rtx6_zipcore_wedge_2023",
    lowValue: 55,
    highValue: 85,
    evidence: [
      "Seeded demo range for Cleveland RTX 6 ZipCore wedge.",
      "Wedge range is sensitive to groove wear and loft details."
    ]
  },
  {
    productId: "prod_odyssey_white_hot_og_putter_2021",
    lowValue: 80,
    highValue: 120,
    evidence: [
      "Seeded demo range for Odyssey White Hot OG putter.",
      "Putter range is sensitive to finish, head shape and grip condition."
    ]
  },
  {
    productId: "prod_mizuno_jpx923_hot_metal_iron_set_2023",
    lowValue: 315,
    highValue: 425,
    evidence: [
      "Seeded demo range for Mizuno JPX 923 Hot Metal iron set.",
      "Iron set value is sensitive to set composition and shaft configuration."
    ]
  }
];
