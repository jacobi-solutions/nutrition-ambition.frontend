import { ComponentMatch, LogMealToolResponse, MessageRoleTypes } from "../services/nutrition-ambition-api.service";

export interface DisplayMessage {
    id?: string;
    text: string;
    isUser: boolean;
    isContextNote?: boolean;
    timestamp: Date;
    role?: MessageRoleTypes;
  
    // keep full payload from backend - single meal (legacy)
    logMealToolResponse?: LogMealToolResponse | null;
    
    // support for multiple meals
    logMealToolResponses?: LogMealToolResponse[] | null;
  
    // optional convenience fields
    mealName?: string | null;
    
    // phrase editing state
    isEditingPhrase?: boolean;
    editingPhrase?: string;
    newPhrase?: string;
  }