import { QuestionType } from '../dto/create-question.dto';

export interface ScoringCriteria {
  rubric: string;
  keyPoints: string[];
  maxScore: number;
  weight: number;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  expectedAnswer?: string;
  followUpPrompts?: string[];
  scoringCriteria: ScoringCriteria;
  timeLimit?: number;
  order: number;
}

