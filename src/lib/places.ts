import type { Place, PropertyType } from "@/lib/place-types";
import { getAuthedContext } from "@/lib/db";

type PlaceRow = {
  id: string;
  name: string;
  commune: string | null;
  postcode: string | null;
  property_type: string | null;
  created_at: string | Date;
  onboarded_at: string | Date | null;
};

function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    commune: row.commune,
    postcode: row.postcode,
    propertyType: row.property_type as PropertyType | null,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    onboardedAt: toIsoOrNull(row.onboarded_at),
  };
}

export async function getPlaces(): Promise<Place[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT id, name, commune, postcode, property_type, created_at, onboarded_at
    FROM places
    ORDER BY created_at ASC
  `) as PlaceRow[];
  return rows.map(toPlace);
}

export async function getPlace(id: string): Promise<Place | null> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT id, name, commune, postcode, property_type, created_at, onboarded_at
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
  const { sql, accountId } = await getAuthedContext();
  const rows = (await sql`
    INSERT INTO places (account_id, name, commune, postcode, property_type)
    VALUES (${accountId}, ${input.name}, ${input.commune}, ${input.postcode}, ${input.propertyType})
    RETURNING id, name, commune, postcode, property_type, created_at, onboarded_at
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
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    UPDATE places
    SET name = ${input.name}, commune = ${input.commune}, postcode = ${input.postcode},
        property_type = ${input.propertyType}
    WHERE id = ${id}
    RETURNING id, name, commune, postcode, property_type, created_at, onboarded_at
  `) as PlaceRow[];
  return toPlace(rows[0]);
}

// Q01 of the onboarding questionnaire sets property_type directly, without going
// through the full place-edit form (name/commune/postcode are untouched).
export async function setPlacePropertyType(id: string, propertyType: PropertyType): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`UPDATE places SET property_type = ${propertyType} WHERE id = ${id}`;
}

export async function markPlaceOnboarded(id: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`UPDATE places SET onboarded_at = now() WHERE id = ${id}`;
}
