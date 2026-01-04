# Assessments Module Documentation

## Overview

The Assessments module provides complete CRUD operations for interview assessments with question management, scoring criteria, and usage tracking.

## API Endpoints

### CRUD Operations

#### 1. Get All Assessments
- **Endpoint:** `GET /api/assessments`
- **Auth:** Required (JWT)
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 50)
  - `search` (string) - Searches name and description
  - `type` (AssessmentType enum)
  - `skill` (string) - Filter by skill
  - `difficulty` (EASY | MEDIUM | HARD)
  - `isPublic` (boolean)
- **Response:** Paginated list of assessments

#### 2. Get Assessment Types
- **Endpoint:** `GET /api/assessments/types`
- **Auth:** Required (JWT)
- **Response:** Array of assessment type strings

#### 3. Get Assessments by Skill
- **Endpoint:** `GET /api/assessments/by-skill/:skill`
- **Auth:** Required (JWT)
- **Response:** Array of assessments that evaluate the skill

#### 4. Get Single Assessment
- **Endpoint:** `GET /api/assessments/:id`
- **Auth:** Required (JWT)
- **Response:** Full assessment details with questions

#### 5. Create Assessment
- **Endpoint:** `POST /api/assessments`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** CreateAssessmentDto
- **Response:** Created assessment

#### 6. Update Assessment
- **Endpoint:** `PUT /api/assessments/:id`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** UpdateAssessmentDto
- **Response:** Updated assessment

#### 7. Delete Assessment
- **Endpoint:** `DELETE /api/assessments/:id`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** 204 No Content
- **Note:** Soft delete if used in templates, hard delete otherwise

### Question Management

#### 8. Add Question
- **Endpoint:** `POST /api/assessments/:id/questions`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** CreateQuestionDto
- **Response:** Created question

#### 9. Update Question
- **Endpoint:** `PUT /api/assessments/:id/questions/:questionId`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** Partial<Question>
- **Response:** Updated question

#### 10. Delete Question
- **Endpoint:** `DELETE /api/assessments/:id/questions/:questionId`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** 204 No Content
- **Note:** Cannot delete if assessment would have less than 3 questions

#### 11. Reorder Questions
- **Endpoint:** `POST /api/assessments/:id/questions/reorder`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** `{ questionIds: string[] }`
- **Response:** 200 OK

## Assessment Types

```typescript
enum AssessmentType {
  ROLE_SPECIFIC
  CUSTOM
  BASIC
  PROFESSIONAL
  ANALYTICAL
  LIVE_CODING
  BEHAVIORAL
  TECHNICAL
  CULTURAL_FIT
}
```

## Question Types

```typescript
enum QuestionType {
  OPEN_ENDED
  BEHAVIORAL
  TECHNICAL
  SITUATIONAL
  CODING
}
```

## Difficulty Levels

```typescript
enum Difficulty {
  EASY
  MEDIUM
  HARD
}
```

## DTOs

### CreateAssessmentDto
```typescript
{
  name: string; // required, max 200 chars
  type: AssessmentType; // required
  description: string; // required, max 500 chars
  duration: number; // optional, 1-60 minutes (auto-calculated if not provided)
  questions: CreateQuestionDto[]; // required, min 3
  skillsEvaluated: string[]; // required, 1-10 skills
  difficulty: Difficulty; // required
  isPublic?: boolean; // optional, default: false
}
```

### CreateQuestionDto
```typescript
{
  text: string; // required
  type: QuestionType; // required
  expectedAnswer?: string; // optional
  followUpPrompts?: string[]; // optional
  scoringCriteria: ScoringCriteriaDto; // required
  timeLimit?: number; // optional, min 30 seconds
  order: number; // required, min 1
}
```

### ScoringCriteriaDto
```typescript
{
  rubric: string; // required
  keyPoints: string[]; // required, min 2
  maxScore: number; // required, 0-100
  weight: number; // required, 0-1
}
```

## Business Logic

### Validation Rules

1. **Questions:**
   - Minimum 3 questions per assessment
   - Question orders must be sequential (1, 2, 3, ...)
   - No duplicate question IDs
   - Question weights must sum to 1.0

2. **Duration:**
   - Auto-calculated from question time limits
   - Includes 30-second buffer between questions
   - Warning if > 20 minutes
   - Error if > 30 minutes

3. **Scoring Criteria:**
   - Each question must have scoring criteria
   - At least 2 key points required
   - Rubric must be clear and measurable

4. **Skills:**
   - 1-10 skills per assessment
   - Skills stored as string array

### Duration Calculation

- Sum of all question time limits
- Add 30 seconds buffer between each question
- Convert to minutes (rounded to 1 decimal place)
- Default time limit: 120 seconds (2 minutes) if not specified

### Permissions

- Only creators can edit their assessments
- Admins can edit any assessment (future enhancement)
- Public assessments visible to all authenticated users
- Private assessments only visible to creator

### Usage Tracking

- Tracks how many templates use each assessment
- Shown in response as `usageCount`
- Prevents hard delete if used in templates
- Soft delete if used, hard delete if not used

### Question Management

- Questions stored as JSON array in Assessment model
- Each question has unique ID (UUID)
- Questions can be added, updated, deleted, reordered
- Minimum 3 questions must remain after deletion

## Response Formats

### Assessment List Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Role-Specific Screening Assessment",
      "type": "ROLE_SPECIFIC",
      "description": "Evaluates role-specific competencies...",
      "duration": 18,
      "difficulty": "MEDIUM",
      "skillsEvaluated": ["Communication", "Problem Solving"],
      "usageCount": 12,
      "isPublic": true,
      "questionCount": 5,
      "createdBy": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-02T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### Single Assessment Response
```json
{
  "id": "uuid",
  "name": "Role-Specific Screening Assessment",
  "type": "ROLE_SPECIFIC",
  "description": "Evaluates role-specific competencies...",
  "duration": 18,
  "difficulty": "MEDIUM",
  "skillsEvaluated": ["Communication", "Problem Solving"],
  "usageCount": 12,
  "isPublic": true,
  "questions": [
    {
      "id": "q1",
      "text": "Tell me about a time when you had to deal with a difficult customer.",
      "type": "BEHAVIORAL",
      "expectedAnswer": "Should demonstrate empathy...",
      "followUpPrompts": ["What was the outcome?"],
      "scoringCriteria": {
        "rubric": "Evaluate empathy, problem-solving approach, outcome",
        "keyPoints": [
          "Shows empathy",
          "Describes clear problem-solving steps",
          "Mentions positive outcome"
        ],
        "maxScore": 100,
        "weight": 0.3
      },
      "timeLimit": 180,
      "order": 1
    }
  ],
  "createdBy": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-02T00:00:00Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Question weights must sum to 1.0. Current sum: 0.8",
  "error": "Bad Request"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "You do not have permission to update this assessment",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Assessment not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Cannot delete assessment that is used in templates",
  "error": "Conflict"
}
```

## Database Schema

### Assessment Model
- `id`: UUID (primary key)
- `name`: String
- `type`: AssessmentType enum
- `duration`: Float (minutes)
- `skillsEvaluated`: String array
- `description`: Text (optional)
- `difficulty`: Difficulty enum
- `questions`: JSON (array of Question objects)
- `isSystem`: Boolean (system vs custom)
- `isPublic`: Boolean
- `deletedAt`: DateTime (soft delete)
- `userId`: UUID (foreign key to User)

### Question Structure (JSON)
```typescript
{
  id: string; // UUID
  text: string;
  type: QuestionType;
  expectedAnswer?: string;
  followUpPrompts?: string[];
  scoringCriteria: {
    rubric: string;
    keyPoints: string[];
    maxScore: number;
    weight: number;
  };
  timeLimit?: number; // seconds
  order: number;
}
```

## Testing

Use the `test-assessments.http` file for testing all endpoints with VS Code REST Client extension.

## Next Steps

1. **Question Templates:**
   - Pre-built question templates by type
   - Question library for common roles

2. **AI Integration:**
   - Auto-generate questions based on job description
   - AI-powered scoring criteria suggestions

3. **Analytics:**
   - Track question effectiveness
   - Most common questions by role

4. **Versioning:**
   - Assessment version history
   - Rollback capabilities

