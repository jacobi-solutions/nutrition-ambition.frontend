import { ComponentMatch, LogMealToolResponse, MessageRoleTypes } from "../services/nutrition-ambition-api.service";

export interface DisplayMessage {
    id?: string;
    text: string;
    isUser: boolean;
    isContextNote?: boolean;
    timestamp: Date;
    role?: MessageRoleTypes;
  
    // keep full payload from backend
    logMealToolResponse?: LogMealToolResponse | null;
  
    // optional convenience fields
    foodOptions?: Record<string, ComponentMatch[]> | null;
    mealName?: string | null;
  }