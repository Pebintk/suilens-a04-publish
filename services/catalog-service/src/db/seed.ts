import { db } from "./index";
import { lenses } from "./schema";

const seedLenses = [
  {
    modelName: 'Summilux-M 35mm f/1.4 ASPH.',
    manufacturerName: 'Leica',
    minFocalLength: 35,
    maxFocalLength: 35,
    maxAperture: '1.4',
    mountType: 'Leica M',
    dayPrice: '450000.00',
    weekendPrice: '750000.00',
    description: "A legendary 35mm lens renowned for its rendering and character.",
  },
  {
    modelName: "Art 24-70mm f/2.8 DG DN",
    manufacturerName: "Sigma",
    minFocalLength: 24,
    maxFocalLength: 70,
    maxAperture: "2.8",
    mountType: "Sony E",
    dayPrice: "200000.00",
    weekendPrice: "350000.00",
    description: "Professional-grade standard zoom for mirrorless systems.",
  },
  {
    modelName: "NIKKOR Z 70-200mm f/2.8 VR S",
    manufacturerName: "Nikon",
    minFocalLength: 70,
    maxFocalLength: 200,
    maxAperture: "2.8",
    mountType: "Nikon Z",
    dayPrice: "350000.00",
    weekendPrice: "600000.00",
    description: "Nikon flagship telephoto zoom for the Z system.",
  },
];

async function seed() {
  const existingLens = await db.select().from(lenses).limit(1);

  if (existingLens.length > 0) {
    console.log("Catalog already seeded, skipping.");
    process.exit(0);
  }

  console.log("Seeding catalog lenses...");
  await db.insert(lenses).values(seedLenses);
  console.log(`Seeded ${seedLenses.length} lenses.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
