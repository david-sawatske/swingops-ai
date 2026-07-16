import type {
  ProductReferenceRecord
} from "./product-reference-types.js";

export type ProductReferenceProvider = {
  listProducts: () => readonly ProductReferenceRecord[];
  findByProductId: (
    productId: string
  ) => ProductReferenceRecord | null;
  findBySku: (
    sku: string
  ) => ProductReferenceRecord | null;
};

function cloneProductReference(
  product: ProductReferenceRecord
): ProductReferenceRecord {
  return {
    ...product,
    aliases: [...product.aliases],
    shaftFamilies: [...product.shaftFamilies]
  };
}

function validateUniqueProductReferences(
  products: readonly ProductReferenceRecord[]
): void {
  const productIds = new Set<string>();
  const skus = new Set<string>();

  for (const product of products) {
    if (productIds.has(product.productId)) {
      throw new Error(
        `Duplicate product reference ID: ${product.productId}`
      );
    }

    if (skus.has(product.sku)) {
      throw new Error(
        `Duplicate product reference SKU: ${product.sku}`
      );
    }

    productIds.add(product.productId);
    skus.add(product.sku);
  }
}

export function createInMemoryProductReferenceProvider(
  products: readonly ProductReferenceRecord[]
): ProductReferenceProvider {
  validateUniqueProductReferences(products);

  const records = products.map(cloneProductReference);
  const productsById = new Map(
    records.map((product) => [
      product.productId,
      product
    ])
  );
  const productsBySku = new Map(
    records.map((product) => [
      product.sku,
      product
    ])
  );

  return {
    listProducts() {
      return records.map(cloneProductReference);
    },
    findByProductId(productId) {
      const product =
        productsById.get(productId);

      return product
        ? cloneProductReference(product)
        : null;
    },
    findBySku(sku) {
      const product = productsBySku.get(sku);

      return product
        ? cloneProductReference(product)
        : null;
    }
  };
}
