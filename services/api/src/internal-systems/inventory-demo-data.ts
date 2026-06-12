export type InventoryProductCategory =
  | "DRIVER"
  | "FAIRWAY_WOOD"
  | "HYBRID"
  | "IRON_SET"
  | "WEDGE"
  | "PUTTER";

export type DemoInventoryProduct = {
  productId: string;
  sku: string;
  brand: string;
  productLine: string;
  category: InventoryProductCategory;
  year: number;
  aliases: string[];
  shaftFamilies: string[];
};

export const demoInventoryProducts: DemoInventoryProduct[] = [
  {
    productId: "prod_taylormade_stealth2_driver_2023",
    sku: "TM-STEALTH2-DRV-2023",
    brand: "TaylorMade",
    productLine: "Stealth 2",
    category: "DRIVER",
    year: 2023,
    aliases: ["tm stealth2", "tm stealth 2", "taylormade stealth2", "stealth2 drv"],
    shaftFamilies: ["Ventus", "Fujikura Ventus"]
  },
  {
    productId: "prod_titleist_tsr2_fairway_2023",
    sku: "TITLEIST-TSR2-FWY-2023",
    brand: "Titleist",
    productLine: "TSR2",
    category: "FAIRWAY_WOOD",
    year: 2023,
    aliases: ["titleist tsr2", "tsr2 3w", "titleist tsr 2 fairway"],
    shaftFamilies: ["Tensei", "Mitsubishi Tensei"]
  },
  {
    productId: "prod_titleist_tsr3_fairway_2023",
    sku: "TITLEIST-TSR3-FWY-2023",
    brand: "Titleist",
    productLine: "TSR3",
    category: "FAIRWAY_WOOD",
    year: 2023,
    aliases: ["titleist tsr3", "tsr3 3w", "titleist tsr 3 fairway"],
    shaftFamilies: ["Tensei", "Mitsubishi Tensei"]
  },
  {
    productId: "prod_titleist_ts2_fairway_2019",
    sku: "TITLEIST-TS2-FWY-2019",
    brand: "Titleist",
    productLine: "TS2",
    category: "FAIRWAY_WOOD",
    year: 2019,
    aliases: ["titleist ts2", "ts2 3w", "titleist ts 2 fairway"],
    shaftFamilies: ["Tensei", "Mitsubishi Tensei"]
  },
  {
    productId: "prod_callaway_rogue_st_max_driver_2022",
    sku: "CALLAWAY-ROGUESTMAX-DRV-2022",
    brand: "Callaway",
    productLine: "Rogue ST Max",
    category: "DRIVER",
    year: 2022,
    aliases: ["cally rogue st max", "callaway rogue st max", "rogue st max driver"],
    shaftFamilies: ["Project X HZRDUS", "HZRDUS"]
  },
  {
    productId: "prod_ping_g425_iron_set_2021",
    sku: "PING-G425-IRONSET-2021",
    brand: "PING",
    productLine: "G425",
    category: "IRON_SET",
    year: 2021,
    aliases: ["ping g425 irons", "g425 iron set", "g425 5-pw"],
    shaftFamilies: ["PING Alta", "Nippon", "True Temper"]
  },
  {
    productId: "prod_ping_g430_iron_set_2023",
    sku: "PING-G430-IRONSET-2023",
    brand: "PING",
    productLine: "G430",
    category: "IRON_SET",
    year: 2023,
    aliases: ["ping g430 irons", "g430 iron set", "g430 5-pw"],
    shaftFamilies: ["PING Alta", "Nippon", "True Temper"]
  }
];
