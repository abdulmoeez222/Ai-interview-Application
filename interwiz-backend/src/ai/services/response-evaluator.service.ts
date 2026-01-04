import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { Question, EvaluationResult } from '../interfaces/interview-state.interface';

@Injectable()
export class ResponseEvaluatorService {
  private readonly EVALUATOR_SYSTEM_PROMPT = `You are an expert technical interviewer with 15+ years of experience.
You evaluate candidates fairly, objectively, and thoroughly.

Your evaluation criteria:
1. Technical accuracy
2. Problem-solving approach
3. Communication clarity
4. Depth of knowledge
5. Real-world applicability

Be constructive but honest. A score of 70+ indicates strong performance.`;

  private readonly evaluationSchema = {
    type: 'object',
    properties: {
      score: {
        type: 'number',
        description: 'Score from 0-100',
        minimum: 0,
        maximum: 100,
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of strengths in the response',
      },
      weaknesses: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of weaknesses or areas for improvement',
      },
      recommendation: {
        type: 'string',
        enum: ['hire', 'no-hire', 'maybe'],
        description: 'Overall recommendation based on this response',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the evaluation',
      },
    },
    required: ['score', 'strengths', 'weaknesses', 'recommendation', 'reasoning'],
  };

  constructor(private openaiService: OpenAIService) {}

  /**
   * Evaluate candidate response
   */
  async evaluateResponse(
    question: Question,
    response: string,
  ): Promise<EvaluationResult> {
    const systemPrompt = `You are an expert interviewer evaluating a candidate's response.

Question: ${question.text}
Question Type: ${question.type}
Scoring Criteria:
${question.scoringCriteria.rubric}

Key Points to Look For:
${question.scoringCriteria.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Evaluate the candidate's response on a scale of 0-100.
Consider:
- How well they addressed the key points
- Depth and quality of their answer
- Clarity of communication
- Relevance to the question

Provide a fair, objective evaluation.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `Candidate's Response:\n\n${response}`,
      },
    ];

    try {
      const evaluation = await this.openaiService.generateWithJSON<EvaluationResult>(
        messages,
        this.evaluationSchema,
      );

      // Validate score is in range
      if (evaluation.score < 0 || evaluation.score > 100) {
        evaluation.score = Math.max(0, Math.min(100, evaluation.score));
      }

      return evaluation;
    } catch (error) {
      // Fallback evaluation if AI fails
      return {
        score: 50,
        strengths: ['Response provided'],
        weaknesses: ['Unable to fully evaluate'],
        recommendation: 'maybe',
        reasoning: 'Evaluation service temporarily unavailable',
      };
    }
  }

  /**
   * Determine if follow-up is needed
   */
  async needsFollowUp(
    evaluation: EvaluationResult,
    followUpsAlreadyAsked: number,
    responseLength: number,
  ): Promise<boolean> {
    // Max 2 follow-ups per question
    if (followUpsAlreadyAsked >= 2) {
      return false;
    }

    // Ask follow-up if score is low
    if (evaluation.score < 50 && followUpsAlreadyAsked < 1) {
      return true;
    }

    // Ask follow-up if response is too short (might be vague)
    if (responseLength < 50 && followUpsAlreadyAsked < 1) {
      return true;
    }

    // Ask follow-up if weaknesses indicate need for clarification
    if (
      evaluation.weaknesses.some((w) =>
        w.toLowerCase().includes('unclear') ||
        w.toLowerCase().includes('vague') ||
        w.toLowerCase().includes('specific'),
      ) &&
      followUpsAlreadyAsked < 1
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate evaluation summary text
   */
  generateEvaluationText(evaluation: EvaluationResult): string {
    const parts: string[] = [];

    if (evaluation.strengths.length > 0) {
      parts.push(`Strengths: ${evaluation.strengths.join(', ')}`);
    }

    if (evaluation.weaknesses.length > 0) {
      parts.push(`Areas for improvement: ${evaluation.weaknesses.join(', ')}`);
    }

    parts.push(`Score: ${evaluation.score}/100`);
    parts.push(`Reasoning: ${evaluation.reasoning}`);

    return parts.join('\n');
  }
}

