"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  extractInvoiceAppliances,
  confirmInvoiceImport,
  type InvoiceExtractionState,
} from "@/app/actions";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/appliance-types";
import type { EquipmentType } from "@/lib/equipment-types";
import type { ExtractedApplianceCandidate } from "@/lib/invoice-extraction";

const initialState: InvoiceExtractionState = {};

type Row = ExtractedApplianceCandidate & { clientId: string; checked: boolean };

const CARD_CLASS =
  "flex flex-col gap-4 rounded-[20px] bg-surface p-5 sm:p-6";
const INPUT_CLASS =
  "rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-line-strong px-4 py-2 font-medium text-ink hover:bg-surface-2";

function SubmitUploadButton({ mode }: { mode: "real" | "demo" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={BUTTON_CLASS}>
      {pending ? "Analyse…" : mode === "demo" ? "Voir un exemple (démonstration)" : "Analyser la facture"}
    </button>
  );
}

function equipmentLabel(equipmentTypes: Pick<EquipmentType, "id" | "category" | "label">[], id: string): string {
  return equipmentTypes.find((t) => t.id === id)?.label ?? id;
}

export function InvoiceImportFlow({
  placeId,
  mode,
  equipmentTypes,
  onImported,
}: {
  placeId: string;
  mode: "real" | "demo";
  equipmentTypes: Pick<EquipmentType, "id" | "category" | "label">[];
  onImported?: (result: { importedEquipmentTypeIds: string[] }) => void;
}) {
  const [state, formAction] = useActionState(extractInvoiceAppliances, initialState);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  // Enter the confirmation phase once extraction succeeds, mirroring ApplianceForm's
  // "derive state during render" pattern rather than an effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.rows) {
      setRows(state.rows.map((r, i) => ({ ...r, clientId: `row-${i}`, checked: true })));
      setIsDemoResult(Boolean(state.demo));
    }
  }

  function updateRow(clientId: string, patch: Partial<Row>) {
    setRows((prev) => (prev ? prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)) : prev));
  }

  async function handleConfirm() {
    if (!rows) return;
    const checked = rows.filter((r) => r.checked);
    if (checked.length === 0) return;
    setConfirming(true);
    setConfirmError(null);
    const result = await confirmInvoiceImport(
      placeId,
      checked.map((r) => ({
        equipmentTypeId: r.equipmentTypeId,
        brand: r.brand,
        model: r.model,
        purchaseDate: r.purchaseDate,
        warrantyEnd: r.warrantyEnd,
      }))
    );
    setConfirming(false);
    if ("error" in result) {
      setConfirmError(result.error);
      return;
    }
    setAddedCount(checked.length);
    onImported?.(result);
  }

  if (addedCount !== null) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-ink">
          {addedCount} appareil{addedCount > 1 ? "s" : ""} ajouté{addedCount > 1 ? "s" : ""} ou complété
          {addedCount > 1 ? "s" : ""}.
        </p>
      </div>
    );
  }

  if (rows) {
    return (
      <div className={CARD_CLASS}>
        {isDemoResult && (
          <p className="rounded-lg border border-warn-border bg-warn-soft px-3 py-2 text-[13px] text-warn">
            Exemple de démonstration : ces données ne proviennent pas d&apos;une facture réelle.
          </p>
        )}
        <h2 className="text-lg font-medium text-ink">
          Nous avons trouvé {rows.length} appareil{rows.length > 1 ? "s" : ""}
        </h2>
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div
              key={row.clientId}
              className="flex flex-col gap-2 rounded-lg border border-line p-3"
            >
              <label className="flex items-start gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => updateRow(row.clientId, { checked: e.target.checked })}
                  className="mt-0.5"
                />
                {equipmentLabel(equipmentTypes, row.equipmentTypeId)}
              </label>
              <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-ink-2">Type d&apos;appareil</label>
                  <select
                    value={row.equipmentTypeId}
                    onChange={(e) => updateRow(row.clientId, { equipmentTypeId: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    {CATEGORIES.map((category: Category) => (
                      <optgroup key={category} label={CATEGORY_LABELS[category]}>
                        {equipmentTypes
                          .filter((t) => t.category === category)
                          .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-ink-2">Marque</label>
                  <input
                    type="text"
                    value={row.brand ?? ""}
                    onChange={(e) => updateRow(row.clientId, { brand: e.target.value || null })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-ink-2">Modèle</label>
                  <input
                    type="text"
                    value={row.model ?? ""}
                    onChange={(e) => updateRow(row.clientId, { model: e.target.value || null })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-ink-2">Date d&apos;achat</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={row.purchaseDate ?? ""}
                    onChange={(e) => updateRow(row.clientId, { purchaseDate: e.target.value || null })}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-ink-2">Fin de garantie</label>
                  <input
                    type="date"
                    value={row.warrantyEnd ?? ""}
                    onChange={(e) => updateRow(row.clientId, { warrantyEnd: e.target.value || null })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {confirmError && <p className="text-sm text-late">{confirmError}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={confirming || rows.every((r) => !r.checked)}
            onClick={handleConfirm}
            className={BUTTON_CLASS}
          >
            {confirming ? "Ajout…" : "Ajouter les appareils cochés"}
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS}
            onClick={() => {
              setRows(null);
              setConfirmError(null);
            }}
          >
            Recommencer
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className={CARD_CLASS}>
      <h2 className="text-lg font-medium text-ink">Importer une facture</h2>
      {mode === "demo" ? (
        <p className="text-sm text-ink-2">
          Compte admin : ce parcours est en mode démonstration, avec un résultat d&apos;exemple fixe (la lecture des
          factures n&apos;est pas encore connectée).
        </p>
      ) : (
        <p className="text-sm text-ink-2">
          Déposez une facture (PDF ou photo) : nous listons les appareils qu&apos;elle contient. Le fichier n&apos;est
          jamais conservé.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium text-ink">
          Facture {mode === "demo" && <span className="font-normal text-ink-2">(facultatif en démonstration)</span>}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,image/*"
          required={mode === "real"}
          className="text-sm text-ink"
        />
      </div>
      {state.error && <p className="text-sm text-late">{state.error}</p>}
      <SubmitUploadButton mode={mode} />
    </form>
  );
}
