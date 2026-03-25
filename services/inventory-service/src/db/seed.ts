import { db } from "./index";
import { branches, inventory } from "./schema";

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3001";

const branchSeed = [
  {
    code: "KB-JKT-S",
    name: "Kebayoran Baru",
    city: "Jakarta Selatan",
    address: "Jl. Sultan Hasanuddin No. 12, Jakarta Selatan",
  },
  {
    code: "KG-JKT-U",
    name: "Kelapa Gading",
    city: "Jakarta Utara",
    address: "Jl. Boulevard Raya No. 45, Jakarta Utara",
  },
  {
    code: "DGO-BDG",
    name: "Dago",
    city: "Bandung",
    address: "Jl. Ir. H. Juanda No. 88, Bandung",
  },
];

const inventorySeedTemplate = [
  {
    modelName: "Summilux-M 35mm f/1.4 ASPH.",
    branchCode: "KB-JKT-S",
    totalQuantity: 18,
    availableQuantity: 18,
  },
  {
    modelName: "Summilux-M 35mm f/1.4 ASPH.",
    branchCode: "KG-JKT-U",
    totalQuantity: 12,
    availableQuantity: 12,
  },
  {
    modelName: "Art 24-70mm f/2.8 DG DN",
    branchCode: "KB-JKT-S",
    totalQuantity: 20,
    availableQuantity: 20,
  },
  {
    modelName: "Art 24-70mm f/2.8 DG DN",
    branchCode: "DGO-BDG",
    totalQuantity: 14,
    availableQuantity: 14,
  },
  {
    modelName: "NIKKOR Z 70-200mm f/2.8 VR S",
    branchCode: "KG-JKT-U",
    totalQuantity: 16,
    availableQuantity: 16,
  },
  {
    modelName: "NIKKOR Z 70-200mm f/2.8 VR S",
    branchCode: "DGO-BDG",
    totalQuantity: 10,
    availableQuantity: 10,
  },
];

interface CatalogLens {
  id: string;
  modelName: string;
}

async function fetchLenses(): Promise<CatalogLens[]> {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${CATALOG_SERVICE_URL}/api/lenses`).catch(
      () => null,
    );

    if (response?.ok) {
      return (await response.json()) as CatalogLens[];
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Catalog service was not ready in time for inventory seeding.");
}

async function seed() {
  const existingInventory = await db.select().from(inventory).limit(1);

  if (existingInventory.length > 0) {
    console.log("Inventory already seeded, skipping.");
    process.exit(0);
  }

  console.log("Fetching catalog lenses for inventory seed...");
  const catalogLenses = await fetchLenses();
  const lensIdByModel = new Map(
    catalogLenses.map((lens) => [lens.modelName, lens.id]),
  );

  const inventoryRows = inventorySeedTemplate.map((item) => {
    const lensId = lensIdByModel.get(item.modelName);

    if (!lensId) {
      throw new Error(`Lens not found in catalog seed: ${item.modelName}`);
    }

    return {
      lensId,
      branchCode: item.branchCode,
      totalQuantity: item.totalQuantity,
      availableQuantity: item.availableQuantity,
    };
  });

  console.log("Seeding inventory branches...");
  await db.insert(branches).values(branchSeed).onConflictDoNothing();

  console.log("Seeding inventory stock...");
  await db.insert(inventory).values(inventoryRows).onConflictDoNothing();

  console.log(`Seeded ${inventoryRows.length} inventory rows.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
