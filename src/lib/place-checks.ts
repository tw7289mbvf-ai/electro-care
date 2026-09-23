import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type PlaceCheck = {
  id: string;
  placeId: string;
  questionId: string;
  questionLabel: string;
  help: string | null;
  createdAt: string;
};

type PlaceCheckRow = {
  id: string;
  place_id: string;
  question_id: string;
  question_label: string;
  help: string | null;
  created_at: string | Date;
};

function toPlaceCheck(row: PlaceCheckRow): PlaceCheck {
  return {
    id: row.id,
    placeId: row.place_id,
    questionId: row.question_id,
    questionLabel: row.question_label,
    help: row.help,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

export async function getPlaceChecks(placeId: string): Promise<PlaceCheck[]> {
  const rows = (await sql`
    SELECT id, place_id, question_id, question_label, help, created_at
    FROM place_checks
    WHERE place_id = ${placeId}
    ORDER BY created_at ASC
  `) as PlaceCheckRow[];
  return rows.map(toPlaceCheck);
}

export async function addPlaceCheck(input: {
  placeId: string;
  questionId: string;
  questionLabel: string;
  help: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO place_checks (place_id, question_id, question_label, help)
    VALUES (${input.placeId}, ${input.questionId}, ${input.questionLabel}, ${input.help})
    ON CONFLICT (place_id, question_id) DO NOTHING
  `;
}
