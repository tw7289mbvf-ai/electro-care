import { findOrCreateApplianceByType } from "@/lib/appliances";
import { setApplianceObligation } from "@/lib/appliance-obligations";
import { addPlaceCheck } from "@/lib/place-checks";
import { setPlacePropertyType } from "@/lib/places";
import { getEquipmentType } from "@/lib/equipment-types";
import { getTrackedLegalTasks } from "@/lib/maintenance-tasks";
import { getTodayInFrance } from "@/lib/obligations";
import type { PropertyType } from "@/lib/place-types";

export type QuestionnaireStepEffects = {
  placeId: string;
  setPropertyType?: PropertyType;
  createEquipmentTypeIds: string[];
  dateAnswers: {
    equipmentTypeId: string;
    taskId: string;
    field: "last_service_date" | "known_due_date";
    // Exactly one of these is set: a precise date, or (last_service_date only,
    // REGLE-01) a graded answer with no exact date.
    date?: string;
    confidence?: "recent" | "old" | "never";
  }[];
  unknownChecks: { questionId: string; questionLabel: string; help: string | null }[];
};

// Applied per questionnaire step (one main question plus its follow-up, if any). Every
// piece here is idempotent to re-run: find-or-create never duplicates an appliance,
// setApplianceObligation upserts, addPlaceCheck upserts on (place_id, question_id).
export async function applyQuestionnaireStepEffects(effects: QuestionnaireStepEffects): Promise<void> {
  if (effects.setPropertyType) {
    await setPlacePropertyType(effects.placeId, effects.setPropertyType);
  }

  for (const equipmentTypeId of effects.createEquipmentTypeIds) {
    const type = getEquipmentType(equipmentTypeId);
    if (!type) continue;
    const { appliance, created } = await findOrCreateApplianceByType({
      placeId: effects.placeId,
      equipmentTypeId,
      category: type.category,
    });
    // Tasks due more often than yearly (e.g. a monthly smoke detector test) aren't
    // worth asking "when did you last do this" — assume compliance starts today.
    // Only for a genuinely new appliance: reusing an existing one must not reset its
    // tracked history.
    if (created) {
      for (const task of getTrackedLegalTasks(equipmentTypeId)) {
        if (task.frequency.months < 12) {
          await setApplianceObligation({
            applianceId: appliance.id,
            maintenanceTaskId: task.id,
            lastServiceDate: getTodayInFrance(),
          });
        }
      }
    }
  }

  for (const dateAnswer of effects.dateAnswers) {
    const type = getEquipmentType(dateAnswer.equipmentTypeId);
    if (!type) continue;
    const { appliance } = await findOrCreateApplianceByType({
      placeId: effects.placeId,
      equipmentTypeId: dateAnswer.equipmentTypeId,
      category: type.category,
    });
    if (dateAnswer.field === "last_service_date") {
      await setApplianceObligation({
        applianceId: appliance.id,
        maintenanceTaskId: dateAnswer.taskId,
        lastServiceDate: dateAnswer.date ?? null,
        serviceConfidence: dateAnswer.confidence ?? null,
      });
    } else {
      await setApplianceObligation({
        applianceId: appliance.id,
        maintenanceTaskId: dateAnswer.taskId,
        knownDueDate: dateAnswer.date,
      });
    }
  }

  for (const check of effects.unknownChecks) {
    await addPlaceCheck({
      placeId: effects.placeId,
      questionId: check.questionId,
      questionLabel: check.questionLabel,
      help: check.help,
    });
  }
}
