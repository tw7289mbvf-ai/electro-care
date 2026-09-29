export type ExtractedApplianceCandidate = {
  equipmentTypeId: string;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
};

// Single entry point for reading an invoice (docs' "Import from Invoices (planned)"):
// takes the file, returns the appliances found on it. Ready to receive the Anthropic
// API later, deliberately not connected yet — no key, no external call. The file is
// only ever held in memory for the duration of this call: it is never stored or
// transmitted anywhere.
export async function extractAppliancesFromInvoice(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the interface the Anthropic API will fill in
  file: File
): Promise<ExtractedApplianceCandidate[]> {
  throw new Error("L'extraction de factures n'est pas encore connectée.");
}

// Fixed, admin-only demonstration result (spec's test case: a Boulanger invoice
// listing six appliances with their exact references). No personal data.
export const DEMO_INVOICE_APPLIANCES: ExtractedApplianceCandidate[] = [
  {
    equipmentTypeId: "CUIS-01",
    brand: "Samsung",
    model: "NV7B45502AK",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
  {
    equipmentTypeId: "FROID-01",
    brand: "Samsung",
    model: "BRB26600FWW",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
  {
    equipmentTypeId: "LAV-01",
    brand: "Samsung",
    model: "WW11BGA046AE",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
  {
    equipmentTypeId: "LAV-03",
    brand: "Electrolux",
    model: "EEG48300L",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
  {
    equipmentTypeId: "LAV-02",
    brand: "Electrolux",
    model: "EW7H4963SP",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
  {
    equipmentTypeId: "CUIS-05",
    brand: "Samsung",
    model: "MS22T8254AB/E5",
    purchaseDate: "2023-02-07",
    warrantyEnd: "2025-02-07",
  },
];

export type InvoiceImportMode = "real" | "demo" | "disabled";

// The extraction function above isn't connected, so INVOICE_IMPORT_ENABLED stays off
// in every environment for now: every entry point shows "bientôt disponible" to an
// ordinary account. The admin account can still exercise the full parcours, always
// against the fixed example above (never real extraction), to verify the UX ahead of
// the API being wired in.
export function getInvoiceImportMode(isAdmin: boolean): InvoiceImportMode {
  if (process.env.INVOICE_IMPORT_ENABLED === "true") return "real";
  return isAdmin ? "demo" : "disabled";
}
