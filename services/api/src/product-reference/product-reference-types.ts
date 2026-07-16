export type ProductReferenceCategory =
  | "DRIVER"
  | "FAIRWAY_WOOD"
  | "HYBRID"
  | "IRON_SET"
  | "WEDGE"
  | "PUTTER";

export type ProductReferenceRecord = {
  productId: string;
  sku: string;
  brand: string;
  productLine: string;
  category: ProductReferenceCategory;
  year: number;
  aliases: readonly string[];
  shaftFamilies: readonly string[];
};
