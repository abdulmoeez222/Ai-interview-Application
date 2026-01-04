# Scheduling Module Documentation

## Overview

The Scheduling module handles interview scheduling, calendar integration (Google Calendar, Outlook), timezone management, and automated email reminders.

## Architecture

### Module Structure
```
scheduling/
├── scheduling.module.ts
├── scheduling.controller.ts
├── scheduling.service.ts
├── services/
│   ├── google-calendar.service.ts    // Google Calendar integration
│   ├── outlook-calendar.service.ts    // Outlook Calendar integration
│   ├── timezone.service.ts            // Timezone conversion
│   └── reminder.service.ts            // Email reminders
├── dto/
│   ├── availability.dto.ts
│   └── schedule-interview.dto.ts
└── interfaces/
    └── availability.interface.ts
```

## Services

### 1. SchedulingService
Main service for scheduling operations.

**Methods:**
- `createSchedule(interviewId, dto)` - Create availability slots
- `selectSlot(scheduleId, dto)` - Candidate selects time slot
- `getAvailableSlots(scheduleId, timezone)` - Get slots in candidate timezone
- `reschedule(scheduleId, dto)` - Reschedule interview
- `cancel(scheduleId)` - Cancel scheduled interview
- `getScheduleByInterviewId(interviewId)` - Get schedule for interview

**Features:**
- Slot validation (no overlaps, no past dates)
- Timezone conversion
- Calendar event creation
- Reminder scheduling

### 2. GoogleCalendarService
Google Calendar OAuth and event management.

**Methods:**
- `getAuthUrl(userId)` - Get OAuth authorization URL
- `getTokens(code)` - Exchange auth code for tokens
- `createEvent(userId, event)` - Create calendar event
- `updateEvent(userId, eventId, updates)` - Update event
- `deleteEvent(userId, eventId)` - Delete event
- `isConnected(userId)` - Check if calendar is connected

### 3. OutlookCalendarService
Microsoft Outlook Calendar integration.

**Methods:**
- `getAuthUrl(userId)` - Get OAuth authorization URL
- `getTokens(code)` - Exchange auth code for tokens
- `createEvent(userId, event)` - Create calendar event
- `updateEvent(userId, eventId, updates)` - Update event
- `deleteEvent(userId, eventId)` - Delete event
- `isConnected(userId)` - Check if calendar is connected

### 4. TimezoneService
Timezone conversion and management.

**Methods:**
- `convertTimezone(date, fromTz, toTz)` - Convert between timezones
- `getCurrentTime(timezone)` - Get current time in timezone
- `format(date, timezone, format)` - Format date in timezone
- `getAllTimezones()` - Get all supported timezones
- `isValidTimezone(timezone)` - Validate timezone
- `getTimezoneOffset(timezone, date)` - Get offset in minutes

### 5. ReminderService
Automated email reminders.

**Methods:**
- `scheduleReminder(reminder)` - Schedule reminder
- `cancelReminders(interviewId)` - Cancel all reminders
- `sendReminder(data)` - Send reminder email

**Reminder Types:**
- `24_HOURS` - 24 hours before interview
- `1_HOUR` - 1 hour before interview

## API Endpoints

### Availability Management

#### Create Availability Slots
- **Endpoint:** `POST /api/scheduling/interviews/:interviewId/availability`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** `CreateAvailabilityDto`
- **Response:** Schedule object

#### Get Available Slots
- **Endpoint:** `GET /api/scheduling/schedules/:scheduleId/available-slots?timezone=...`
- **Auth:** Not required (public for candidates)
- **Response:** Array of availability slots in requested timezone

### Scheduling

#### Select Time Slot
- **Endpoint:** `POST /api/scheduling/schedules/:scheduleId/select-slot`
- **Auth:** Not required (public for candidates)
- **Body:** `SelectSlotDto`
- **Response:** Updated schedule

#### Get Schedule
- **Endpoint:** `GET /api/scheduling/interviews/:interviewId/schedule`
- **Auth:** Required (JWT)
- **Response:** Schedule object

#### Reschedule Interview
- **Endpoint:** `PUT /api/scheduling/schedules/:scheduleId/reschedule`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** `RescheduleDto`
- **Response:** Updated schedule

#### Cancel Schedule
- **Endpoint:** `DELETE /api/scheduling/schedules/:scheduleId`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** 204 No Content

### Calendar Integration

#### Get Google Calendar Auth URL
- **Endpoint:** `GET /api/scheduling/calendar/google/auth-url`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** `{ authUrl: string }`

#### Connect Google Calendar
- **Endpoint:** `POST /api/scheduling/calendar/google/connect`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** `{ code: string }`
- **Response:** Connection status

#### Get Outlook Calendar Auth URL
- **Endpoint:** `GET /api/scheduling/calendar/outlook/auth-url`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Response:** `{ authUrl: string }`

#### Connect Outlook Calendar
- **Endpoint:** `POST /api/scheduling/calendar/outlook/connect`
- **Auth:** Required (JWT)
- **Roles:** RECRUITER, ADMIN
- **Body:** `{ code: string }`
- **Response:** Connection status

### Utilities

#### Get All Timezones
- **Endpoint:** `GET /api/scheduling/timezones`
- **Auth:** Required (JWT)
- **Response:** `{ timezones: string[] }`

## Scheduling Flow

### 1. Recruiter Creates Availability
```
Recruiter → Create Interview → Set Availability Slots → Schedule Created
```

### 2. Candidate Selects Slot
```
Candidate → View Available Slots → Select Slot → Calendar Event Created → Reminders Scheduled
```

### 3. Automated Reminders
```
24 Hours Before → Send Reminder Email
1 Hour Before → Send Reminder Email
```

### 4. Calendar Integration
```
Slot Selected → Create Calendar Event → Add to Google/Outlook → Send Invites
```

## Calendar Event Details

### Event Information
- **Title:** `Interview: {Template Title}`
- **Description:** Includes candidate name, job title, join link
- **Attendees:** Recruiter and candidate emails
- **Duration:** Based on template total duration
- **Reminders:** Email 60 min before, popup 10 min before

### Join Link
- Format: `{FRONTEND_URL}/interview/{joinToken}`
- Accessible by candidate
- Opens interview interface

## Timezone Handling

### Conversion Logic
- Recruiter sets availability in their timezone
- Candidate views slots in their timezone
- Selected slot stored in candidate's timezone
- Calendar events use recruiter's timezone

### Supported Timezones
- All IANA timezone names
- Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`
- UTC as default

## Reminder System

### Reminder Types

**24 Hours Before:**
- Subject: "Interview Tomorrow"
- Sent to: Candidate and Recruiter
- Content: Interview details, join link

**1 Hour Before:**
- Subject: "Interview Starting Soon"
- Sent to: Candidate and Recruiter
- Content: Quick reminder, join link

### Reminder Content
- Interview title and position
- Scheduled time (formatted in recipient's timezone)
- Join link
- Contact information

## Validation Rules

### Availability Slots
- At least 1 slot required
- No overlapping slots
- Start time must be before end time
- Cannot create slots in the past
- Minimum 15 minutes duration

### Slot Selection
- Must be within availability window
- Cannot select past times
- Validated against all availability slots

## Error Handling

### Common Errors

**Invalid Timezone:**
```json
{
  "statusCode": 400,
  "message": "Invalid timezone: INVALID_TZ",
  "error": "Bad Request"
}
```

**Overlapping Slots:**
```json
{
  "statusCode": 400,
  "message": "Availability slots cannot overlap",
  "error": "Bad Request"
}
```

**Slot Not Available:**
```json
{
  "statusCode": 400,
  "message": "Selected slot is not available",
  "error": "Bad Request"
}
```

## Environment Variables

```env
# Google Calendar
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/scheduling/calendar/google/callback

# Outlook Calendar
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/scheduling/calendar/outlook/callback
```

## OAuth Flow

### Google Calendar
1. Recruiter clicks "Connect Google Calendar"
2. Redirected to Google OAuth
3. Grants permissions
4. Redirected back with code
5. Exchange code for tokens
6. Store tokens in database
7. Calendar connected

### Outlook Calendar
1. Recruiter clicks "Connect Outlook"
2. Redirected to Microsoft OAuth
3. Grants permissions
4. Redirected back with code
5. Exchange code for tokens
6. Store tokens in database
7. Calendar connected

## Database Schema

### Schedule Model
- `id`: UUID (primary key)
- `interviewId`: UUID (unique, foreign key)
- `availabilitySlots`: JSON (array of slots)
- `selectedSlot`: JSON (selected slot)
- `timezone`: String (recruiter timezone)
- `candidateTimezone`: String (candidate timezone)
- `status`: ScheduleStatus enum
- `calendarEventId`: String (Google/Outlook event ID)
- `calendarProvider`: CalendarProvider enum

### ScheduleStatus
- `PENDING` - Availability set, no selection
- `CONFIRMED` - Slot selected
- `CANCELLED` - Cancelled
- `RESCHEDULED` - Rescheduled

## Integration Points

### With Interviews Module
- Updates interview status to SCHEDULED
- Sets scheduledAt timestamp
- Updates timezone

### With Calendar Services
- Creates events on slot selection
- Updates events on reschedule
- Deletes events on cancellation

### With Reminder Service
- Schedules reminders on confirmation
- Cancels reminders on cancellation/reschedule

## Best Practices

1. **Timezone Management:**
   - Always specify timezone explicitly
   - Convert times when displaying to users
   - Store times in UTC internally

2. **Calendar Integration:**
   - Handle calendar failures gracefully
   - Allow interviews without calendar
   - Store event IDs for updates/deletion

3. **Reminders:**
   - Schedule reminders immediately after confirmation
   - Cancel reminders on cancellation
   - Use HTML emails for better formatting

4. **Validation:**
   - Validate all time inputs
   - Check for past dates
   - Prevent overlapping slots

## Future Enhancements

1. **Recurring Availability:**
   - Set weekly availability patterns
   - Auto-generate slots

2. **Buffer Time:**
   - Add buffer between interviews
   - Prevent back-to-back scheduling

3. **Calendar Sync:**
   - Sync existing calendar events
   - Check for conflicts
   - Auto-adjust availability

4. **SMS Reminders:**
   - Add SMS reminder option
   - Twilio integration

5. **Timezone Detection:**
   - Auto-detect candidate timezone
   - Suggest optimal times

