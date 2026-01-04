# Authentication System Documentation

## Overview

The InterWiz authentication system provides a complete, secure authentication solution with:
- User registration with email verification
- JWT-based authentication with access and refresh tokens
- Password reset functionality
- Role-based access control
- Company email validation
- Strong password requirements

## Features

### 1. User Registration
- **Endpoint:** `POST /api/auth/register`
- **Validation:**
  - Email must be a company email (rejects @gmail.com, @yahoo.com, etc.)
  - Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
  - First/Last name: min 2 chars, max 50 chars
- **Response:** User object + tokens + verification token (dev mode only)
- **Status:** 201 Created

### 2. User Login
- **Endpoint:** `POST /api/auth/login`
- **Validation:** Email and password required
- **Security:** Requires email verification before login
- **Response:** User object + access token + refresh token
- **Status:** 200 OK

### 3. Email Verification
- **Endpoint:** `POST /api/auth/verify-email`
- **Purpose:** Verify user email address
- **Token Expiration:** 24 hours
- **Response:** Success message
- **Status:** 200 OK

### 4. Refresh Token
- **Endpoint:** `POST /api/auth/refresh`
- **Purpose:** Get new access token using refresh token
- **Token Expiration:** 30 days
- **Response:** User object + new tokens
- **Status:** 200 OK

### 5. Forgot Password
- **Endpoint:** `POST /api/auth/forgot-password`
- **Purpose:** Request password reset
- **Token Expiration:** 1 hour
- **Response:** Success message (doesn't reveal if email exists)
- **Status:** 200 OK

### 6. Reset Password
- **Endpoint:** `POST /api/auth/reset-password`
- **Purpose:** Reset password using reset token
- **Validation:** Same password rules as registration
- **Response:** Success message
- **Status:** 200 OK

### 7. Get Profile
- **Endpoint:** `GET /api/auth/me`
- **Auth:** Required (JWT)
- **Response:** Current user profile
- **Status:** 200 OK

## Security Features

### Password Security
- Bcrypt hashing with 10 salt rounds
- Strong password requirements enforced
- Password never returned in responses

### Token Security
- Access tokens: 7 days expiration
- Refresh tokens: 30 days expiration, stored in database
- Tokens include user ID and email in payload
- Refresh tokens are single-use (deleted after use)

### Email Verification
- Required before login
- Token expires after 24 hours
- Prevents unauthorized account creation

### Company Email Validation
- Rejects common personal email domains:
  - gmail.com, yahoo.com, hotmail.com, outlook.com, icloud.com, etc.
- Ensures only company emails can register

## Guards

### JwtAuthGuard
- Validates JWT access token
- Attaches user to request object
- Used for protected routes

### LocalAuthGuard
- Validates email/password credentials
- Used for login endpoint

### RolesGuard
- Checks user roles
- Used with `@Roles()` decorator
- Example: `@Roles('ADMIN', 'RECRUITER')`

## Decorators

### @CurrentUser()
- Extracts user from request
- Usage: `@CurrentUser() user: User`

### @Roles(...roles)
- Specifies required roles for endpoint
- Usage: `@Roles('ADMIN', 'RECRUITER')`

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Please verify your email before logging in",
  "error": "Forbidden"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "error": "Conflict"
}
```

## Environment Variables

Required in `.env`:
```env
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRATION=30d
```

## Database Schema

### User Model
- `emailVerified`: Boolean (default: false)
- `emailVerifyToken`: String (unique, nullable)
- `emailVerifyExpires`: DateTime (nullable)
- `passwordResetToken`: String (unique, nullable)
- `passwordResetExpires`: DateTime (nullable)
- `interviewLimit`: Int (default: 10)

### RefreshToken Model
- `token`: String (unique)
- `userId`: String (foreign key)
- `expiresAt`: DateTime

## Testing

Use the `test-auth-complete.http` file for testing all endpoints with VS Code REST Client extension.

## Next Steps

1. **Email Service Integration:**
   - Replace TODO comments with actual email sending
   - Use services like SendGrid, AWS SES, or Nodemailer

2. **Rate Limiting:**
   - Add rate limiting to prevent brute force attacks
   - Use `@nestjs/throttler`

3. **2FA (Optional):**
   - Add two-factor authentication for enhanced security

4. **Session Management:**
   - Track active sessions
   - Allow users to revoke tokens

