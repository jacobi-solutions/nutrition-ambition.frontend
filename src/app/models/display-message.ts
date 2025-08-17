import { LogMealToolResponse, MessageRoleTypes, SelectableFoodMatch } from "../services/nutrition-ambition-api.service";

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
    foodOptions?: Record<string, SelectableFoodMatch[]> | null;
    mealName?: string | null;
  }