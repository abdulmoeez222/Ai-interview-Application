# Templates Module Documentation

## Overview

The Templates module provides complete CRUD operations for interview templates with advanced filtering, search, and cloning capabilities.

## API Endpoints

### 1. Get All Templates
- **Endpoint:** `GET /api/templates`
- **Auth:** Required (JWT)
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 6, options: 6, 12, 24, 48, 100)
  - `search` (string) - Searches title and description
  - `type` (SCREENING | IN_DEPTH)
  - `domain` (Domain enum)
  - `createdBy` (string) - 'all' or userId
  - `tags` (string[]) - Array of tags
  - `sortBy` ('latest' | 'oldest' | 'duration')
  - `isPublic` (boolean)
- **Response:** Paginated list of templates

### 2. Get Single Template
- **Endpoint:** `GET /api/templates/:id`
- **Auth:** Required (JWT)
- **Response:** Full template details with assessments

### 3. Create Template
- **Endpoint:** `POST /api/templates`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** CreateTemplateDto
- **Response:** Created template

### 4. Update Template
- **Endpoint:** `PUT /api/templates/:id`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** UpdateTemplateDto
- **Response:** Updated template

### 5. Delete Template
- **Endpoint:** `DELETE /api/templates/:id`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** 204 No Content (soft delete)

### 6. Clone Template
- **Endpoint:** `POST /api/templates/:id/clone`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** Cloned template

## Domain Enum

```typescript
enum Domain {
  CUSTOMER_SUPPORT_AND_SALES
  ENGINEERING
  MARKETING
  PRODUCT
  DESIGN
  DATA_SCIENCE
  OPERATIONS
  HUMAN_RESOURCES
  FINANCE
  LEGAL
  OTHER
}
```

## Template Type Enum

```typescript
enum TemplateType {
  SCREENING
  IN_DEPTH
}
```

## DTOs

### CreateTemplateDto
```typescript
{
  title: string; // required, 3-200 chars
  description: string; // required, max 400 chars
  domain: Domain; // required
  jobTitle: string; // required, max 100 chars
  jobDescription?: string; // optional, max 5000 chars
  jobDescriptionUrl?: string; // optional, valid URL
  type?: TemplateType; // default: SCREENING
  tags?: string[]; // max 3 tags
  assessments: CreateTemplateAssessmentDto[]; // required, min 1
}

interface CreateTemplateAssessmentDto {
  assessmentId: string; // UUID, required
  weightage: number; // 0-100, required
  order: number; // min 1, required
}
```

### UpdateTemplateDto
- All fields optional
- Same structure as CreateTemplateDto
- Can update `isPublic` boolean

### FilterTemplateDto
- All query parameters as optional fields
- Type-safe with validation

## Business Logic

### Validation Rules

1. **Title Uniqueness:** Title must be unique per user
2. **Job Description:** Either `jobDescription` or `jobDescriptionUrl` required
3. **Assessments:** Minimum 1 assessment required
4. **Weightages:** Must sum to exactly 100%
5. **Duration:** Cannot exceed 60 minutes
6. **Tags:** Maximum 3 tags allowed
7. **Description:** Maximum 400 characters

### Duration Calculation

- Automatically calculated from assessment durations
- Sum of all assessment durations
- Validated on create/update (max 60 minutes)

### Cloning

- Creates new template with "Clone_" prefix
- Copies all template data and assessments
- Maintains reference to original template
- Assigned to current user

### Permissions

- Users can only edit/delete their own templates
- Public templates visible to all authenticated users
- Admins can edit any template (future enhancement)

### Soft Delete

- Templates are soft deleted (deletedAt field)
- Deleted templates excluded from queries
- Can be restored if needed (future enhancement)

## Response Formats

### Template List Response
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Customer Support Representative",
      "description": "This interview template evaluates...",
      "domain": "CUSTOMER_SUPPORT_AND_SALES",
      "type": "SCREENING",
      "totalDuration": 39,
      "assessmentCount": 3,
      "skillCount": 2,
      "tags": ["customer-service", "support"],
      "isPublic": true,
      "createdBy": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 6,
    "total": 24,
    "totalPages": 4
  }
}
```

### Single Template Response
```json
{
  "id": "uuid",
  "title": "Customer Support Representative",
  "description": "Full description...",
  "domain": "CUSTOMER_SUPPORT_AND_SALES",
  "jobTitle": "Customer Support Representative",
  "jobDescription": "Overview: The Customer Support Representative...",
  "jobDescriptionUrl": "https://example.com/job.pdf",
  "type": "SCREENING",
  "totalDuration": 39,
  "tags": ["support", "customer-service"],
  "assessments": [
    {
      "id": "uuid",
      "name": "Role-Specific Screening Assessment",
      "type": "ROLE_SPECIFIC",
      "duration": 18,
      "weightage": 40,
      "scoreImpact": 40,
      "order": 1,
      "skillsEvaluated": ["Communication", "Problem Solving"]
    }
  ],
  "clonedFrom": null,
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
  "message": "Assessment weightages must sum to 100%",
  "error": "Bad Request"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "You do not have permission to update this template",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

## Database Schema

### Template Model
- `id`: UUID (primary key)
- `title`: String
- `description`: Text
- `jobTitle`: String
- `jobDescription`: Text (optional)
- `jobDescriptionUrl`: String (optional)
- `domain`: Domain enum
- `type`: TemplateType enum
- `tags`: String array
- `isPublic`: Boolean
- `totalDuration`: Float
- `deletedAt`: DateTime (soft delete)
- `clonedFromId`: UUID (optional, reference to original)
- `userId`: UUID (foreign key to User)

### Assessment Model
- `id`: UUID (primary key)
- `name`: String
- `type`: AssessmentType enum
- `duration`: Float
- `skillsEvaluated`: String array
- `description`: Text (optional)
- `isSystem`: Boolean

### TemplateAssessment Model (Junction)
- `id`: UUID (primary key)
- `templateId`: UUID (foreign key)
- `assessmentId`: UUID (foreign key)
- `weightage`: Float (0-100)
- `scoreImpact`: Float (0-100)
- `order`: Int

## Testing

Use the `test-templates.http` file for testing all endpoints with VS Code REST Client extension.

## Next Steps

1. **Assessment Management:**
   - Create endpoints for managing assessments
   - System vs custom assessments

2. **Template Sharing:**
   - Enhanced public template features
   - Template marketplace

3. **Analytics:**
   - Track template usage
   - Popular templates

4. **Versioning:**
   - Template version history
   - Rollback capabilities

