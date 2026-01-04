import { Injectable } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { Question } from '../interfaces/interview-state.interface';

@Injectable()
export class QuestionGeneratorService {
  private readonly INTERVIEWER_SYSTEM_PROMPT = `You are Ava, a professional AI interviewer for InterWiz.

Your personality:
- Warm and encouraging
- Professional but conversational
- Patient and empathetic
- Clear in communication

Guidelines:
- Ask ONE question at a time
- Keep questions concise (1-2 sentences)
- Listen actively and acknowledge responses
- Make candidates feel comfortable
- Maintain professional tone throughout`;

  constructor(private openaiService: OpenAIService) {}

  /**
   * Generate opening message
   */
  async generateOpeningMessage(
    candidateName: string,
    jobTitle: string,
  ): Promise<string> {
    const prompt = `Generate a warm opening message for ${candidateName} applying for ${jobTitle}.

Requirements:
- Keep it professional, welcoming, and brief (2-3 sentences)
- Explain that this is an AI-conducted interview
- Let them know they can take their time
- Make them feel comfortable

Start with: "Hello ${candidateName}! Welcome to your interview for the ${jobTitle} position."`;

    const messages = [
      { role: 'system' as const, content: this.INTERVIEWER_SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ];

    return this.openaiService.chat(messages, {
      temperature: 0.8,
      maxTokens: 150,
    });
  }

  /**
   * Adapt question to context
   */
  async adaptQuestionToContext(
    baseQuestion: Question,
    candidateInfo: { name: string; email: string },
    jobDescription?: string,
  ): Promise<string> {
    if (!jobDescription) {
      return baseQuestion.text;
    }

    const prompt = `Adapt this interview question to be more relevant to the specific role:

Original Question: ${baseQuestion.text}
Job Description: ${jobDescription.substring(0, 500)}

Requirements:
- Keep the core intent of the question
- Make it more specific to the role if possible
- Keep it concise (1-2 sentences)
- Maintain professional tone

Return ONLY the adapted question, nothing else.`;

    const messages = [
      { role: 'system' as const, content: this.INTERVIEWER_SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ];

    try {
      return await this.openaiService.chat(messages, {
        temperature: 0.7,
        maxTokens: 200,
      });
    } catch (error) {
      // Fallback to original question if adaptation fails
      return baseQuestion.text;
    }
  }

  /**
   * Generate follow-up question
   */
  async generateFollowUp(
    originalQuestion: string,
    candidateResponse: string,
    scoringCriteria: Question['scoringCriteria'],
  ): Promise<string> {
    const systemPrompt = `You are conducting an interview. The candidate just answered a question. 

Generate ONE relevant follow-up question to:
1. Clarify their answer if it was vague
2. Dig deeper into their experience
3. Assess these criteria: ${scoringCriteria.keyPoints.join(', ')}

Guidelines:
- Keep it natural and conversational
- Be brief (1 sentence)
- Don't repeat the original question
- Focus on getting more specific information

Return ONLY the follow-up question, nothing else.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'assistant' as const,
        content: `Question: ${originalQuestion}`,
      },
      {
        role: 'user' as const,
        content: `Candidate's Response: ${candidateResponse}`,
      },
      {
        role: 'system' as const,
        content: 'Generate follow-up question:',
      },
    ];

    return this.openaiService.chat(messages, {
      temperature: 0.8,
      maxTokens: 100,
    });
  }

  /**
   * Generate transition message between assessments
   */
  async generateTransitionMessage(
    currentAssessment: string,
    nextAssessment: string,
  ): Promise<string> {
    const prompt = `Generate a brief transition message (1 sentence) moving from ${currentAssessment} to ${nextAssessment} assessment.

Keep it natural and encouraging. Example: "Great! Now let's move on to discuss your technical skills."`;

    const messages = [
      { role: 'system' as const, content: this.INTERVIEWER_SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ];

    return this.openaiService.chat(messages, {
      temperature: 0.7,
      maxTokens: 50,
    });
  }
}

