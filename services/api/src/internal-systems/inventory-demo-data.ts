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
  },
  {
    productId: "prod_ping_g430_max_driver_2023",
    sku: "PING-G430MAX-DRV-2023",
    brand: "PING",
    productLine: "G430 Max",
    category: "DRIVER",
    year: 2023,
    aliases: ["ping g430 max", "g430 max driver", "ping g430 max driver"],
    shaftFamilies: ["PING Alta", "Tour 2.0", "Project X HZRDUS"]
  },
  {
    productId: "prod_cleveland_rtx6_zipcore_wedge_2023",
    sku: "CLEVELAND-RTX6ZIPCORE-WEDGE-2023",
    brand: "Cleveland",
    productLine: "RTX 6 ZipCore",
    category: "WEDGE",
    year: 2023,
    aliases: ["cleveland rtx 6 zipcore", "rtx 6 zipcore", "rtx6 zipcore", "rtx zipcore wedge"],
    shaftFamilies: ["True Temper", "Dynamic Gold", "KBS"]
  },
  {
    productId: "prod_odyssey_white_hot_og_putter_2021",
    sku: "ODYSSEY-WHITEHOTOG-PUTTER-2021",
    brand: "Odyssey",
    productLine: "White Hot OG",
    category: "PUTTER",
    year: 2021,
    aliases: ["odyssey white hot og", "white hot og putter", "odyssey wh og"],
    shaftFamilies: ["Odyssey Stroke Lab", "Steel"]
  },
  {
    productId: "prod_mizuno_jpx923_hot_metal_iron_set_2023",
    sku: "MIZUNO-JPX923HOTMETAL-IRONSET-2023",
    brand: "Mizuno",
    productLine: "JPX 923 Hot Metal",
    category: "IRON_SET",
    year: 2023,
    aliases: ["mizuno jpx 923 hot metal", "jpx 923 hot metal", "hot metal irons"],
    shaftFamilies: ["Nippon", "True Temper", "Mitsubishi MMT"]
  }
];
