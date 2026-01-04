# WebSocket Gateway Documentation

## Overview

The WebSocket Gateway provides real-time communication for interview sessions, handling audio streaming, proctoring events, progress tracking, and live updates between candidates and recruiters.

## Architecture

### Module Structure
```
websockets/
├── websockets.module.ts
├── gateways/
│   └── interview.gateway.ts          // Main WebSocket gateway
├── services/
│   └── interview-session.manager.ts  // Session state management
├── interfaces/
│   └── session.interface.ts          // Type definitions
└── dto/
    └── session.dto.ts               // Event DTOs
```

## WebSocket Namespace

**Namespace:** `/interview`

**Connection URL:** `ws://localhost:3001/interview`

## Authentication

### Candidates
- Use interview `joinToken` or `inviteToken` in connection
- Passed via `auth.token` in handshake

### Recruiters
- Use JWT access token
- Passed via `auth.token` or `Authorization` header
- Protected by `WsJwtGuard`

## Connection

### Client Connection
```typescript
const socket = io('http://localhost:3001/interview', {
  auth: {
    token: 'join-token-or-jwt',
  },
  query: {
    userType: 'candidate' | 'recruiter',
  },
});
```

### Connection Events

**connected** (Server → Client)
```json
{
  "message": "Connected successfully",
  "userId": "user-id",
  "userType": "candidate",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**error** (Server → Client)
```json
{
  "message": "Error description"
}
```

## Candidate Events

### Join Interview
**Event:** `join-interview`

**Payload:**
```json
{
  "interviewId": "uuid"
}
```

**Response:** `interview-ready`
```json
{
  "sessionId": "session-id",
  "template": {
    "id": "uuid",
    "title": "Interview Template",
    "totalDuration": 39
  },
  "estimatedDuration": 39,
  "status": "ONGOING"
}
```

### Start Interview
**Event:** `start-interview`

**Payload:**
```json
{
  "sessionId": "session-id"
}
```

**Response:** `question`
```json
{
  "questionId": "uuid",
  "text": "Tell me about your experience...",
  "audioUrl": "https://storage.../audio.wav",
  "type": "BEHAVIORAL",
  "order": 1
}
```

### Send Audio Chunk
**Event:** `audio-chunk`

**Payload:**
```json
{
  "audioData": "base64-encoded-audio"
}
```

**Response:** `transcription` (real-time)
```json
{
  "text": "I have 5 years of experience...",
  "isFinal": false,
  "confidence": 0.95
}
```

### Response Complete
**Event:** `response-complete`

**Payload:**
```json
{
  "transcription": "Final transcribed text",
  "audioUrl": "https://storage.../response.wav"
}
```

**Response:** `question` (next question) or `interview-complete`

### Proctor Event
**Event:** `proctor-event`

**Payload:**
```json
{
  "type": "face-detection",
  "severity": "medium",
  "data": {
    "facesDetected": 2,
    "confidence": 0.85
  },
  "message": "Multiple faces detected"
}
```

### Heartbeat
**Event:** `heartbeat`

**Response:** `heartbeat-ack`
```json
{
  "timestamp": 1704067200000
}
```

## Recruiter Events

### Observe Interview
**Event:** `observe-interview`

**Payload:**
```json
{
  "interviewId": "uuid"
}
```

**Response:** `observation-started`
```json
{
  "interview": {
    "id": "uuid",
    "candidateName": "John Doe",
    "status": "ONGOING"
  },
  "session": {
    "id": "session-id",
    "isActive": true,
    "progress": {...}
  },
  "isLive": true
}
```

## System Events (Server → Client)

### Candidate Joined
**Event:** `candidate-joined` (to recruiters)

```json
{
  "candidateName": "John Doe",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Interview Started
**Event:** `interview-started` (to recruiters)

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "firstQuestion": "Tell me about yourself..."
}
```

### Live Transcript
**Event:** `live-transcript` (to recruiters)

```json
{
  "text": "Candidate response text...",
  "isFinal": true,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Progress Update
**Event:** `progress-update` (to recruiters)

```json
{
  "progress": {
    "currentAssessment": 1,
    "totalAssessments": 3,
    "currentQuestion": 2,
    "totalQuestions": 8
  },
  "score": 85,
  "evaluation": "Strong response...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Question Asked
**Event:** `question-asked` (to recruiters)

```json
{
  "questionId": "uuid",
  "text": "Next question text...",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Proctor Alert
**Event:** `proctor-alert` (to recruiters)

```json
{
  "type": "tab-switch",
  "message": "Candidate switched tabs",
  "severity": "high",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Trust Score Update
**Event:** `trust-score-update` (to recruiters)

```json
{
  "trustScore": 95,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Interview Interrupted
**Event:** `interview-interrupted` (to recruiters)

```json
{
  "reason": "disconnect",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Interview Completed
**Event:** `interview-completed` (to recruiters)

```json
{
  "summary": {
    "overallScore": 78,
    "recommendation": "hire",
    "strengths": [...],
    "weaknesses": [...]
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Session Management

### Session Lifecycle

1. **Created** - When candidate joins interview
2. **Active** - When interview starts
3. **Paused** - If candidate disconnects
4. **Completed** - When interview finishes
5. **Expired** - After 24 hours

### Session State

```typescript
{
  id: string;
  interviewId: string;
  aiSessionId?: string;
  candidateSocketId: string;
  recruiterSocketIds: string[];
  isActive: boolean;
  currentQuestionId: string | null;
  currentQuestion: string | null;
  progress: Progress;
  trustScore: number;
  startedAt?: Date;
  completedAt?: Date;
}
```

## Real-time Features

### Audio Streaming
- Real-time audio chunks sent via `audio-chunk` event
- Transcribed by AssemblyAI WebSocket
- Partial and final transcriptions streamed back

### Live Transcript
- Real-time transcription visible to recruiters
- Updates as candidate speaks
- Final transcript saved to database

### Progress Tracking
- Real-time progress updates
- Score updates after each response
- Assessment and question progress

### Proctoring
- Face detection events
- Tab switch detection
- Fullscreen exit detection
- Suspicious activity alerts
- Trust score calculation

## Error Handling

### Connection Errors
- Invalid token → Disconnect with error
- Session not found → Error message
- Interview not available → Error message

### Runtime Errors
- STT session failure → Fallback to text-only
- TTS generation failure → Continue without audio
- AI processing error → Retry or error message

## Reconnection Logic

### Client-Side
```typescript
socket.on('disconnect', () => {
  // Attempt to reconnect
  socket.connect();
});

socket.on('connect', () => {
  // Rejoin interview if needed
  if (sessionId) {
    socket.emit('join-interview', { interviewId });
  }
});
```

### Server-Side
- Sessions persist for 24 hours
- Can reconnect to existing session
- State maintained during reconnection

## Heartbeat Mechanism

### Purpose
- Keep connection alive
- Detect dead connections
- Monitor connection health

### Implementation
- Client sends `heartbeat` every 30 seconds
- Server responds with `heartbeat-ack`
- Missing heartbeats indicate connection issues

## Room Management

### Rooms
- `interview:{interviewId}` - All participants for an interview
- Used for broadcasting to recruiters
- Candidate and recruiters in same room

### Benefits
- Efficient message broadcasting
- Easy participant management
- Automatic cleanup on disconnect

## Integration Points

### With AI Module
- Uses `InterviewOrchestratorService` for question generation
- Processes responses through AI evaluation
- Generates interview summaries

### With Speech Module
- Uses `SpeechToTextService` for real-time transcription
- Uses `TextToSpeechService` for question audio
- Uses `AudioProcessorService` for audio storage

### With Interviews Module
- Saves responses to database
- Updates interview status
- Tracks proctoring data

## Best Practices

1. **Error Handling:**
   - Always handle connection errors
   - Implement reconnection logic
   - Show user-friendly error messages

2. **Performance:**
   - Send audio chunks in optimal size (250ms)
   - Throttle proctor events
   - Use heartbeat to detect issues

3. **Security:**
   - Validate tokens on connection
   - Verify permissions for each event
   - Don't expose sensitive data

4. **User Experience:**
   - Show connection status
   - Display live transcript
   - Update progress in real-time
   - Alert on proctoring issues

## Testing

### Client Connection Example
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001/interview', {
  auth: {
    token: 'your-token-here',
  },
  query: {
    userType: 'candidate',
  },
});

socket.on('connected', (data) => {
  console.log('Connected:', data);
});

socket.on('interview-ready', (data) => {
  console.log('Interview ready:', data);
});

socket.emit('join-interview', {
  interviewId: 'interview-id',
});
```

## Production Considerations

1. **Redis Integration:**
   - Replace in-memory session storage with Redis
   - Enable horizontal scaling
   - Persist sessions across restarts

2. **Load Balancing:**
   - Use sticky sessions
   - Configure WebSocket support in load balancer

3. **Monitoring:**
   - Track connection counts
   - Monitor message rates
   - Alert on errors

4. **Rate Limiting:**
   - Limit events per connection
   - Prevent abuse
   - Throttle audio chunks

