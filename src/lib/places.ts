import { neon } from "@neondatabase/serverless";
import type { Place, PropertyType } from "@/lib/place-types";

const sql = neon(process.env.DATABASE_URL!);

type PlaceRow = {
  id: string;
  name: string;
  commune: string | null;
  postcode: string | null;
  property_type: string | null;
  created_at: string | Date;
};

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    commune: row.commune,
    postcode: row.postcode,
    propertyType: row.property_type as PropertyType | null,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

export async function getPlaces(): Promise<Place[]> {
  const rows = (await sql`
    SELECT id, name, commune, postcode, property_type, created_at
    FROM places
    ORDER BY created_at ASC
  `) as PlaceRow[];
  return rows.map(toPlace);
}

export async function getPlace(id: string): Promise<Place | null> {
  const rows = (await sql`
    SELECT id, name, commune, postcode, property_type, created_at
    FROM places
    WHERE id = ${id}
  `) as PlaceRow[];
  return rows[0] ? toPlace(rows[0]) : null;
}

export async function addPlace(input: {
  name: string;
  commune: string | null;
  postcode: string | null;
  propertyType: PropertyType | null;
}): Promise<Place> {
  const rows = (await sql`
    INSERT INTO places (name, commune, postcode, property_type)
    VALUES (${input.name}, ${input.commune}, ${input.postcode}, ${input.propertyType})
    RETURNING id, name, commune, postcode, property_type, created_at
  `) as PlaceRow[];
  return toPlace(rows[0]);
}

export async function updatePlace(
  id: string,
  input: {
    name: string;
    commune: string | null;
    postcode: string | null;
    propertyType: PropertyType | null;
  }
): Promise<Place> {
  const rows = (await sql`
    UPDATE places
    SET name = ${input.name}, commune = ${input.commune}, postcode = ${input.postcode},
        property_type = ${input.propertyType}
    WHERE id = ${id}
    RETURNING id, name, commune, postcode, property_type, created_at
  `) as PlaceRow[];
  return toPlace(rows[0]);
}
