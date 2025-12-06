import { ComponentMatch, MealSelection, MessageRoleTypes } from "../services/nutrition-ambition-api.service";

export interface DisplayMessage {
    id?: string;
    text: string;
    isUser: boolean;
    isContextNote?: boolean;
    timestamp: Date;
    role?: MessageRoleTypes;

    // keep full payload from backend
    mealSelection?: MealSelection | null;

    // optional convenience fields
    mealName?: string | null;

    // phrase editing state
    isEditingPhrase?: boolean;
    editingPhrase?: string;
    newPhrase?: string;

    // streaming state
    isStreaming?: boolean;
    isPartial?: boolean;
    processingStage?: string;
    mealSelectionIsPending?: boolean;  // Stage 0 - analyzing food entry

    // retry tracking
    retryCount?: number;
    createdDateUtc?: Date;
    lastUpdatedDateUtc?: Date;

    // manual food entry flag
    autoOpenQuickAdd?: boolean;

    // action buttons flag for restricted access messages
    hasActionButtons?: boolean;
  }
