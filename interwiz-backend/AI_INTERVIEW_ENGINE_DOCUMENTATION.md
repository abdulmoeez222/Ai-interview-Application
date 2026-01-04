# AI Interview Engine Documentation

## Overview

The AI Interview Engine orchestrates conversational interviews using GPT-4, handling question generation, response evaluation, and adaptive follow-ups in real-time.

## Architecture

### Module Structure
```
ai/
├── ai.module.ts
├── ai.controller.ts
├── services/
│   ├── openai.service.ts              // OpenAI API wrapper
│   ├── interview-orchestrator.service.ts  // Main interview logic
│   ├── question-generator.service.ts      // Generate questions
│   ├── response-evaluator.service.ts       // Evaluate responses
│   └── conversation-manager.service.ts    // Manage conversation context
├── dto/
│   └── process-response.dto.ts
└── interfaces/
    ├── chat-message.interface.ts
    └── interview-state.interface.ts
```

## Services

### 1. OpenAIService
Base wrapper for OpenAI API interactions.

**Methods:**
- `chat(messages, options)` - Standard chat completion with retry logic
- `streamChat(messages, options)` - Streaming chat completion
- `generateWithJSON(messages, schema)` - Structured JSON responses
- `estimateTokens(text)` - Token estimation
- `estimateCost(tokens, model)` - Cost calculation

**Features:**
- Automatic retry with exponential backoff
- Error handling and logging
- Token and cost tracking
- Support for multiple models

### 2. QuestionGeneratorService
Generates and adapts interview questions.

**Methods:**
- `generateOpeningMessage(candidateName, jobTitle)` - Welcome message
- `adaptQuestionToContext(question, candidateInfo, jobDescription)` - Contextualize questions
- `generateFollowUp(originalQuestion, response, scoringCriteria)` - Follow-up questions
- `generateTransitionMessage(currentAssessment, nextAssessment)` - Assessment transitions

**Personality:**
- Warm and encouraging
- Professional but conversational
- Patient and empathetic

### 3. ResponseEvaluatorService
Evaluates candidate responses using AI.

**Methods:**
- `evaluateResponse(question, response)` - Full evaluation with scoring
- `needsFollowUp(evaluation, followUpsAsked, responseLength)` - Determine if follow-up needed
- `generateEvaluationText(evaluation)` - Format evaluation summary

**Evaluation Criteria:**
- Technical accuracy
- Problem-solving approach
- Communication clarity
- Depth of knowledge
- Real-world applicability

**Output:**
```typescript
{
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendation: 'hire' | 'no-hire' | 'maybe';
  reasoning: string;
}
```

### 4. ConversationManagerService
Manages interview session state and conversation history.

**Methods:**
- `createSession(interview)` - Initialize new session
- `getContext(sessionId)` - Get current context
- `updateContext(context)` - Save context
- `addMessage(sessionId, role, content)` - Add to conversation history
- `getCurrentQuestion(context)` - Get current question
- `moveToNextQuestion(sessionId)` - Advance to next question
- `getProgress(context)` - Get interview progress

**Storage:**
- In-memory Map (can be replaced with Redis)
- 24-hour session expiration
- Automatic cleanup of expired sessions

### 5. InterviewOrchestratorService
Main orchestrator that coordinates all services.

**Methods:**
- `startInterview(interviewId)` - Initialize interview session
- `processResponse(sessionId, responseText)` - Process candidate response
- `completeInterview(sessionId)` - Generate final summary

**Flow:**
1. Start → Generate opening → Get first question
2. Process response → Evaluate → Decide follow-up or next question
3. Complete → Calculate scores → Generate summary

## API Endpoints

### Start Interview
- **Endpoint:** `POST /api/ai/interview/:interviewId/start`
- **Description:** Initialize AI interview session
- **Response:** InterviewSession with opening message and first question

### Process Response
- **Endpoint:** `POST /api/ai/interview/sessions/:sessionId/respond`
- **Body:** `{ responseText: string }`
- **Description:** Submit candidate response and get next question
- **Response:** InterviewTurn with evaluation and next question

### Get Context
- **Endpoint:** `GET /api/ai/interview/sessions/:sessionId/context`
- **Description:** Get current session context and progress
- **Response:** ConversationContext

### Complete Interview
- **Endpoint:** `POST /api/ai/interview/sessions/:sessionId/complete`
- **Description:** Complete interview and generate summary
- **Response:** InterviewSummary with scores and insights

## Interview Flow

### 1. Initialization
```
Interview Created → Start AI Session → Generate Opening → Get First Question
```

### 2. Question-Response Loop
```
Ask Question → Receive Response → Evaluate → 
  ├─ Needs Follow-up? → Ask Follow-up → Receive Response → Evaluate
  └─ No Follow-up → Save Response → Move to Next Question
```

### 3. Assessment Transitions
```
Complete Assessment → Generate Transition Message → Start Next Assessment
```

### 4. Completion
```
All Questions Answered → Calculate Scores → Generate Summary → Save to DB
```

## Follow-up Logic

Follow-ups are asked when:
- Score < 50 and no follow-ups asked yet
- Response is too short (< 50 characters)
- Evaluation indicates vague/unclear response
- Maximum 2 follow-ups per question

## Scoring

### Individual Response Scoring
- AI evaluates each response (0-100)
- Based on scoring criteria from question
- Considers key points coverage
- Provides strengths and weaknesses

### Overall Score Calculation
- Average of all response scores
- Weighted by assessment weightages (from template)
- Score breakdown by assessment

### Final Recommendation
- Generated from all evaluations
- Considers overall performance
- Provides actionable insights

## Prompt Engineering

### System Prompts

**Interviewer (Ava):**
```
You are Ava, a professional AI interviewer for InterWiz.
- Warm and encouraging
- Professional but conversational
- Patient and empathetic
- Clear in communication
```

**Evaluator:**
```
You are an expert technical interviewer with 15+ years of experience.
- Evaluate fairly and objectively
- Consider technical accuracy, problem-solving, communication
- Be constructive but honest
- Score 70+ indicates strong performance
```

## Error Handling

- **OpenAI API Errors:** Automatic retry with exponential backoff (3 attempts)
- **Service Unavailable:** Graceful fallback with error messages
- **Session Expired:** Clear error message, session cleanup
- **Invalid State:** Validation errors with helpful messages

## Cost Optimization

### Model Selection
- **Interview Conduct:** `gpt-4-turbo-preview` (balanced)
- **Evaluation:** `gpt-4-turbo-preview` (needs reasoning)
- **Simple Tasks:** Could use `gpt-3.5-turbo` (future optimization)

### Token Management
- Token estimation for cost tracking
- Max tokens limits per request
- Temperature tuning (lower for evaluation, higher for conversation)

### Cost Estimation
```typescript
// Rough estimates (as of 2024)
gpt-4-turbo-preview: $0.01/1K input, $0.03/1K output
gpt-4: $0.03/1K input, $0.06/1K output
gpt-3.5-turbo: $0.0005/1K input, $0.0015/1K output
```

## Session Management

### Session Lifecycle
1. Created when interview starts
2. Stored in memory (or Redis)
3. Updated with each interaction
4. Expires after 24 hours
5. Cleaned up automatically

### Context Structure
```typescript
{
  sessionId: string;
  interviewId: string;
  template: Template;
  currentAssessmentIndex: number;
  currentQuestionIndex: number;
  conversationHistory: ChatMessage[];
  candidateInfo: { name, email };
  responses: { [questionId]: Response };
}
```

## Integration Points

### With Interviews Module
- Reads interview and template data
- Saves responses to InterviewResponse model
- Updates interview scores and evaluation

### With Templates Module
- Uses template assessments and questions
- Applies assessment weightages for scoring
- Follows question order and structure

## Future Enhancements

1. **Redis Integration:** Replace in-memory storage with Redis
2. **Streaming Responses:** Real-time question generation
3. **Multi-language Support:** Interview in different languages
4. **Voice Integration:** Speech-to-text and text-to-speech
5. **Advanced Analytics:** Response time analysis, sentiment tracking
6. **Custom Prompts:** Allow recruiters to customize AI personality
7. **Cost Tracking:** Per-interview cost tracking and reporting

## Testing

Use `test-ai-interview.http` for testing all endpoints.

## Environment Variables

Required:
```env
OPENAI_API_KEY=sk-...
```

Optional:
```env
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=2000
```

## Best Practices

1. **Error Handling:** Always handle OpenAI API failures gracefully
2. **Token Limits:** Set appropriate max_tokens to control costs
3. **Temperature:** Use lower temperature (0.3-0.5) for evaluation, higher (0.7-0.9) for conversation
4. **Session Cleanup:** Regularly clean up expired sessions
5. **Cost Monitoring:** Track token usage and costs
6. **Prompt Refinement:** Continuously improve prompts based on results

