import { demoInventoryProducts } from "../internal-systems/inventory-demo-data.js";
import { demoProductReferenceData } from "./demo-product-reference-data.js";
import { createInMemoryProductReferenceProvider } from "./product-reference-provider.js";

export const demoProductReferenceProvider =
  createInMemoryProductReferenceProvider(
    demoInventoryProducts,
    demoProductReferenceData,
  );
