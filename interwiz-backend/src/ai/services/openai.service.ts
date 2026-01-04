import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage, ChatOptions, JSONSchema } from '../interfaces/chat-message.interface';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Chat completion with retry logic
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: options?.model || 'gpt-4-turbo-preview',
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return content;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `OpenAI API call failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    this.logger.error(`OpenAI API call failed after ${maxRetries} attempts`);
    throw new ServiceUnavailableException(
      'AI service temporarily unavailable. Please try again later.',
    );
  }

  /**
   * Streaming chat completion
   */
  async *streamChat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: options?.model || 'gpt-4-turbo-preview',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      this.logger.error(`OpenAI streaming error: ${error.message}`);
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Generate structured JSON response
   */
  async generateWithJSON<T>(
    messages: ChatMessage[],
    schema: JSONSchema,
  ): Promise<T> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            description: 'Structured response',
            schema: schema as any,
            strict: true,
          },
        },
        temperature: 0.3, // Lower temperature for more consistent JSON
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        this.logger.error(`Failed to parse JSON response: ${content}`);
        throw new Error('Invalid JSON response from AI');
      }
    } catch (error: any) {
      this.logger.error(`OpenAI JSON generation error: ${error.message}`);
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Estimate token count (rough estimate)
   */
  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost
   */
  estimateCost(tokens: number, model: string = 'gpt-4-turbo-preview'): number {
    // Cost per 1K tokens (as of 2024)
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    };

    const modelCost = costs[model] || costs['gpt-4-turbo-preview'];
    // Assume 70% input, 30% output
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return (
      (inputTokens / 1000) * modelCost.input +
      (outputTokens / 1000) * modelCost.output
    );
  }

  /**
   * Evaluate candidate response (for interview engine)
   */
  async evaluateResponse(
    question: any,
    responseText: string,
  ): Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    needsFollowUp: boolean;
  }> {
    try {
      const prompt = `You are an expert interviewer evaluating a candidate's response.

Question: ${question.text}
Type: ${question.type}
Expected Key Points: ${question.scoringCriteria?.keyPoints?.join(', ') || 'N/A'}

Candidate's Response: ${responseText}

Evaluate this response on a scale of 0-100 based on:
1. Relevance to the question
2. Clarity and structure
3. Depth of answer
4. Coverage of expected key points

Provide your evaluation in JSON format:
{
  "score": <number 0-100>,
  "feedback": "<detailed feedback>",
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "needsFollowUp": <boolean>
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert interviewer. Provide fair, constructive evaluations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      this.logger.log(`Evaluation complete: Score ${result.score}`);
      return {
        score: result.score || 50,
        feedback: result.feedback || 'No feedback provided',
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        needsFollowUp: result.needsFollowUp || false,
      };
    } catch (error: any) {
      this.logger.error('Evaluation error:', error.message);
      throw new Error('Failed to evaluate response');
    }
  }

  /**
   * Generate follow-up question
   */
  async generateFollowUp(
    originalQuestion: string,
    responseText: string,
  ): Promise<string> {
    try {
      const prompt = `Original Question: ${originalQuestion}
Candidate's Response: ${responseText}

Generate a natural follow-up question to probe deeper into their answer. Keep it conversational and specific to what they said.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a skilled interviewer asking thoughtful follow-up questions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      return completion.choices[0].message.content || '';
    } catch (error: any) {
      this.logger.error('Follow-up generation error:', error.message);
      throw new Error('Failed to generate follow-up');
    }
  }

  /**
   * Generate final evaluation summary
   */
  async generateFinalEvaluation(
    responses: any[],
    jobTitle: string,
  ): Promise<{ evaluation: string; recommendation: string }> {
    try {
      const responseSummary = responses
        .map(
          (r, i) =>
            `Q${i + 1}: ${r.questionText}\nAnswer: ${r.responseText}\nScore: ${r.score}/100\n`,
        )
        .join('\n');

      const prompt = `Job Position: ${jobTitle}

Interview Responses:
${responseSummary}

Based on these responses, provide:
1. A comprehensive evaluation summary (2-3 paragraphs)
2. A hiring recommendation (HIRE, NO_HIRE, or MAYBE)

Format as JSON:
{
  "evaluation": "<detailed evaluation>",
  "recommendation": "<HIRE|NO_HIRE|MAYBE>"
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert hiring manager providing final interview evaluations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        evaluation: result.evaluation || 'No evaluation provided',
        recommendation: result.recommendation || 'MAYBE',
      };
    } catch (error: any) {
      this.logger.error('Final evaluation error:', error.message);
      throw new Error('Failed to generate final evaluation');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

