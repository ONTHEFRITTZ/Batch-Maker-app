export type Step = {
  id: string;
  recipeName: string;
  componentType: string;
  stage: string;
  order: number;
  title: string;
  instructions: string;
  ingredients: string[];
  targetTemp?: string;
  targetWeight?: string;
  suggestedTime?: number;
  timerSuggested: boolean;
  visualCues?: string;
  confirmationRequired: boolean;
};
