"use client";

import { useState } from "react";
import Link from "next/link";
import { applyApplianceChecklist } from "@/app/actions";
import { APPLIANCE_CHECKLIST_ITEMS } from "@/lib/appliance-checklist";
import { MAINTENANCE_LEVEL_LABELS, estimateMaintenanceMinutesForAllLevels, type MaintenanceLevel } from "@/lib/maintenance-levels";
import { MaintenanceLevelOptions } from "@/components/MaintenanceLevelOptions";
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_DANGER, CARD_CLASS, Icon } from "@/components/ui";

type ExistingAppliance = {
  id: string;
  equipmentTypeId: string | null;
  label: string;
  warningName: string;
  interventionCount: number;
  locked: boolean;
};

const LEVEL_CHOICES: readonly MaintenanceLevel[] = ["essential", "recommended"];
const OPTION_CLASS =
  "flex min-h-11 items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-accent cursor-pointer";

// French: 0 and 1 take the singular ("0 appareil supprimé").
function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n <= 1 ? singular : plural}`;
}

// Spec, Maintenance Levels: the questionnaire's appliance checklist, opened later from
// the place page. Every existing appliance starts ticked; unticking one asks at once
// whether to delete it (confirm strikes it through, cancel leaves it ticked), and
// nothing is written before the recap's final confirmation.
export function ApplianceChecklistFlow({
  placeId,
  existing,
  resuming,
}: {
  placeId: string;
  existing: ExistingAppliance[];
  resuming: boolean;
}) {
  const existingTypeIds = new Set(existing.map((a) => a.equipmentTypeId).filter(Boolean));
  // An item whose appliances are all already there is shown through those appliances'
  // own lines instead, so it can never be added twice.
  const newItems = APPLIANCE_CHECKLIST_ITEMS.filter((item) => item.equipmentTypeIds.some((id) => !existingTypeIds.has(id)));

  const [step, setStep] = useState<"list" | "level" | "recap">("list");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [pendingUntick, setPendingUntick] = useState<string | null>(null);
  const [level, setLevel] = useState<MaintenanceLevel>("essential");
  const [confirming, setConfirming] = useState(false);

  const addedItems = newItems.filter((item) => ticked.has(item.label));
  const deleted = existing.filter((a) => struck.has(a.id));
  const keptTypeIds = existing.filter((a) => !struck.has(a.id)).flatMap((a) => (a.equipmentTypeId ? [a.equipmentTypeId] : []));
  const addEquipmentTypeIds = addedItems.flatMap((item) => item.equipmentTypeIds).filter((id) => !existingTypeIds.has(id));

  function toggleNew(label: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function toggleExisting(id: string) {
    if (struck.has(id)) {
      setStruck((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    setPendingUntick(id);
  }

  if (step === "level") {
    const estimates = estimateMaintenanceMinutesForAllLevels([...keptTypeIds, ...addEquipmentTypeIds]);
    return (
      <div className={CARD_CLASS}>
        <BackButton onClick={() => setStep("list")} />
        <h2 className="text-lg font-medium text-ink">Quel suivi voulez-vous pour l&apos;entretien de vos appareils ?</h2>
        <MaintenanceLevelOptions value={level} onChange={setLevel} estimates={estimates} levels={LEVEL_CHOICES} />
        <p className="text-[13px] text-ink-2">Vos obligations légales restent suivies dans tous les cas.</p>
        <button type="button" className={BUTTON_PRIMARY} onClick={() => setStep("recap")}>
          Suivant
        </button>
      </div>
    );
  }

  if (step === "recap") {
    const nothingChanges = addedItems.length === 0 && deleted.length === 0 && !resuming;
    return (
      <div className={CARD_CLASS}>
        <BackButton onClick={() => setStep(resuming ? "level" : "list")} />
        <h2 className="text-lg font-medium text-ink">
          {countLabel(addedItems.length, "appareil ajouté", "appareils ajoutés")},{" "}
          {countLabel(deleted.length, "appareil supprimé", "appareils supprimés")}
        </h2>
        {resuming && <p className="text-sm text-ink">Niveau d&apos;entretien : {MAINTENANCE_LEVEL_LABELS[level]}</p>}
        {addedItems.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {addedItems.map((item) => (
              <li key={item.label}>+ {item.label}</li>
            ))}
          </ul>
        )}
        {deleted.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-late">
            {deleted.map((a) => (
              <li key={a.id}>
                − {a.label}
                {a.interventionCount > 0 &&
                  ` (${countLabel(a.interventionCount, "intervention enregistrée", "interventions enregistrées")})`}
              </li>
            ))}
          </ul>
        )}
        {deleted.length > 0 && (
          <p className="text-[13px] text-ink-2">
            Les appareils supprimés le seront avec leurs obligations et leur historique.
          </p>
        )}
        {nothingChanges ? (
          <Link href={`/places/${placeId}`} className={BUTTON_PRIMARY}>
            Retour au lieu
          </Link>
        ) : (
          <button
            type="button"
            className={deleted.length > 0 ? BUTTON_DANGER : BUTTON_PRIMARY}
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              await applyApplianceChecklist({
                placeId,
                addEquipmentTypeIds,
                deleteApplianceIds: deleted.map((a) => a.id),
                maintenanceLevel: resuming ? level : undefined,
              });
            }}
          >
            {confirming ? "Enregistrement…" : "Confirmer"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <h2 className="text-lg font-medium text-ink">Quels appareils avez-vous ?</h2>
      {existing.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink-2">Déjà enregistrés</p>
          {existing.map((a) => {
            const isStruck = struck.has(a.id);
            return (
              <div key={a.id} className="flex flex-col gap-2">
                <label className={`${OPTION_CLASS} ${a.locked ? "cursor-default" : ""}`}>
                  <input
                    type="checkbox"
                    checked={!isStruck}
                    disabled={a.locked || pendingUntick !== null}
                    onChange={() => toggleExisting(a.id)}
                    className="mt-0.5"
                  />
                  <span className={isStruck ? "text-ink-2 line-through" : ""}>
                    {a.label}
                    {a.locked && <span className="mt-0.5 block text-[13px] text-ink-2">Obligatoire dans tout logement</span>}
                  </span>
                </label>
                {pendingUntick === a.id && (
                  <div role="alertdialog" className="flex flex-col gap-3 rounded-lg bg-late-soft p-3 text-sm text-ink">
                    <p>
                      Décocher {a.warningName} le supprimera, avec ses obligations et son historique (
                      {countLabel(a.interventionCount, "intervention enregistrée", "interventions enregistrées")}).
                      Supprimer ?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BUTTON_DANGER}
                        onClick={() => {
                          setStruck((prev) => new Set(prev).add(a.id));
                          setPendingUntick(null);
                        }}
                      >
                        Supprimer
                      </button>
                      <button type="button" className={BUTTON_OUTLINE} onClick={() => setPendingUntick(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {existing.length > 0 && <p className="text-[13px] font-semibold text-ink-2">À ajouter</p>}
        {newItems.map((item) => (
          <label key={item.label} className={OPTION_CLASS}>
            <input
              type="checkbox"
              checked={ticked.has(item.label)}
              disabled={pendingUntick !== null}
              onChange={() => toggleNew(item.label)}
              className="mt-0.5"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className={BUTTON_PRIMARY}
        disabled={pendingUntick !== null}
        onClick={() => setStep(resuming ? "level" : "recap")}
      >
        Suivant
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold text-accent" onClick={onClick}>
      <Icon name="back" size={20} strokeWidth={2} />
      Précédent
    </button>
  );
}
