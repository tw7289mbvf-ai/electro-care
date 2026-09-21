import { promises as fs } from "fs";
import path from "path";
import type { Appliance, Category } from "@/lib/appliance-types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "appliances.json");

async function readAppliances(): Promise<Appliance[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Appliance[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeAppliances(appliances: Appliance[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(appliances, null, 2), "utf-8");
}

export async function getAppliances(): Promise<Appliance[]> {
  const appliances = await readAppliances();
  return appliances.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addAppliance(input: {
  name: string;
  brand: string;
  model: string;
  category: Category;
  purchaseDate: string;
}): Promise<Appliance> {
  const appliances = await readAppliances();
  const appliance: Appliance = {
    id: crypto.randomUUID(),
    name: input.name,
    brand: input.brand,
    model: input.model,
    category: input.category,
    purchaseDate: input.purchaseDate,
    createdAt: new Date().toISOString(),
  };
  appliances.push(appliance);
  await writeAppliances(appliances);
  return appliance;
}

export async function deleteAppliance(id: string): Promise<void> {
  const appliances = await readAppliances();
  await writeAppliances(appliances.filter((a) => a.id !== id));
}
