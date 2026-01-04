# Speech Integration Module Documentation

## Overview

The Speech Integration module provides real-time voice interactions during AI interviews using AssemblyAI (Speech-to-Text) and ElevenLabs (Text-to-Speech).

## Architecture

### Module Structure
```
speech/
├── speech.module.ts
├── speech.controller.ts
├── services/
│   ├── speech-to-text.service.ts    // AssemblyAI integration
│   ├── text-to-speech.service.ts     // ElevenLabs integration
│   ├── audio-processor.service.ts    // Audio file handling
│   └── voice-manager.service.ts      // Voice selection
├── gateways/
│   └── interview-audio.gateway.ts    // WebSocket for real-time
├── dto/
│   └── text-to-speech.dto.ts
└── interfaces/
    └── speech.interface.ts
```

## Services

### 1. SpeechToTextService (AssemblyAI)

**Methods:**
- `createRealtimeSession()` - Create WebSocket session for real-time transcription
- `sendAudioChunk(ws, audioChunk)` - Send audio chunk for transcription
- `onTranscriptionResult(ws, callback)` - Listen for transcription results
- `transcribeFile(audioUrl)` - Transcribe pre-recorded audio file
- `uploadAudio(audioBuffer)` - Upload audio to AssemblyAI
- `closeSession(ws)` - Close WebSocket session

**Features:**
- Real-time transcription via WebSocket
- File-based transcription for recordings
- Speaker detection (multiple speakers)
- Confidence scores
- Word-level timestamps

### 2. TextToSpeechService (ElevenLabs)

**Methods:**
- `textToSpeech(text, voiceId, options)` - Convert text to speech (returns Buffer)
- `streamTextToSpeech(text, voiceId)` - Streaming TTS for real-time playback
- `getVoices()` - Get all available voices
- `getVoiceSettings(voiceId)` - Get voice configuration
- `estimateCost(text)` - Estimate TTS cost

**Voice Profiles:**
- **Professional** - Clear, professional tone (default)
- **Friendly** - Warm, encouraging tone
- **Energetic** - Enthusiastic, upbeat tone

**Features:**
- Multiple voice options
- Customizable voice settings (stability, similarity, style)
- Cost estimation
- Streaming support

### 3. AudioProcessorService

**Methods:**
- `normalizeAudio(inputBuffer)` - Convert to WAV, 16kHz, mono
- `chunkAudio(audioBuffer, chunkSizeMs)` - Split audio into chunks
- `uploadAudio(audioBuffer, interviewId, type)` - Upload to storage (S3 or local)
- `getAudioDuration(audioBuffer)` - Get audio duration
- `validateAudioFormat(audioBuffer)` - Validate audio format

**Storage:**
- AWS S3 (if configured)
- Local file system (fallback)

### 4. VoiceManagerService

**Methods:**
- `getVoiceProfile(profileName)` - Get voice profile by name
- `getAllProfiles()` - Get all available profiles
- `getProfileForJobRole(domain)` - Get appropriate voice for job domain
- `getProfileById(voiceId)` - Get profile by voice ID

**Voice Selection Logic:**
- Engineering → Professional
- Customer Support → Friendly
- Sales → Energetic
- Marketing → Friendly
- Default → Professional

## API Endpoints

### HTTP Endpoints

#### Text to Speech
- **Endpoint:** `POST /api/speech/text-to-speech`
- **Body:** `{ text: string, voiceProfile?: string }`
- **Response:** `{ audioUrl: string }`

#### Speech to Text
- **Endpoint:** `POST /api/speech/speech-to-text`
- **Content-Type:** `multipart/form-data`
- **Body:** Audio file (form field: `audio`)
- **Response:** `{ transcription: string, confidence: number }`

#### Get Voices
- **Endpoint:** `GET /api/speech/voices`
- **Response:** Array of voice profiles

#### Estimate Cost
- **Endpoint:** `GET /api/speech/estimate-cost?text=...`
- **Response:** `{ characters: number, estimatedCost: number }`

### WebSocket Events

**Namespace:** `/interview-audio`

#### Client → Server

**start-speech-session**
```json
{
  "sessionId": "string",
  "voiceProfile": "professional" // optional
}
```

**audio-chunk**
```json
{
  "sessionId": "string",
  "audioData": "base64-encoded-audio"
}
```

**end-speech-session**
```json
{
  "sessionId": "string"
}
```

**speak-text**
```json
{
  "text": "string",
  "voiceProfile": "professional" // optional
}
```

#### Server → Client

**session-ready**
```json
{
  "sampleRate": 16000,
  "sessionId": "string"
}
```

**transcription**
```json
{
  "text": "string",
  "confidence": 0.95,
  "isFinal": true
}
```

**audio-ready**
```json
{
  "audioData": "base64-encoded-audio",
  "format": "wav"
}
```

**error**
```json
{
  "message": "Error description"
}
```

**session-ended**
```json
{
  "sessionId": "string"
}
```

## Usage Examples

### Real-time Interview Flow

1. **Start Session:**
```typescript
socket.emit('start-speech-session', {
  sessionId: 'interview-123',
  voiceProfile: 'professional'
});
```

2. **Send Audio Chunks:**
```typescript
// Capture audio from microphone
const audioChunk = captureAudioChunk();
const base64Audio = audioChunk.toString('base64');

socket.emit('audio-chunk', {
  sessionId: 'interview-123',
  audioData: base64Audio
});
```

3. **Receive Transcriptions:**
```typescript
socket.on('transcription', (data) => {
  if (data.isFinal) {
    // Use final transcription
    console.log('Final:', data.text);
  } else {
    // Show partial transcription
    console.log('Partial:', data.text);
  }
});
```

4. **Generate AI Speech:**
```typescript
socket.emit('speak-text', {
  text: 'What is your experience with React?',
  voiceProfile: 'professional'
});

socket.on('audio-ready', (data) => {
  // Play audio from base64
  playAudio(data.audioData);
});
```

### File-based Transcription

```typescript
// Upload audio file
const formData = new FormData();
formData.append('audio', audioFile);

const response = await fetch('/api/speech/speech-to-text', {
  method: 'POST',
  body: formData
});

const { transcription, confidence } = await response.json();
```

## Environment Variables

```env
# AssemblyAI
ASSEMBLYAI_API_KEY=your_assemblyai_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key

# AWS S3 (optional, for audio storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=interwiz-audio
```

## Dependencies

### Required Packages
```bash
npm install --save \
  @nestjs/websockets \
  @nestjs/platform-socket.io \
  socket.io \
  ws \
  axios \
  @aws-sdk/client-s3 \
  multer
```

### System Requirements
- **ffmpeg** (for audio processing)
  - Ubuntu: `apt-get install ffmpeg`
  - Mac: `brew install ffmpeg`
  - Windows: Download from https://ffmpeg.org

### Type Definitions
```bash
npm install --save-dev \
  @types/ws \
  @types/multer \
  @types/fluent-ffmpeg
```

## Cost Estimation

### AssemblyAI (STT)
- Real-time: ~$0.05 per minute
- File transcription: ~$0.00025 per second

### ElevenLabs (TTS)
- ~$0.30 per 1000 characters
- Example: 1000 character question ≈ $0.30

### Example Interview Cost
- 30-minute interview
- ~10 questions (200 chars each) = 2000 chars
- STT: 30 min × $0.05 = $1.50
- TTS: 2000 chars × $0.0003 = $0.60
- **Total: ~$2.10 per interview**

## Audio Format Requirements

### Input (for STT)
- Format: WAV, MP3, M4A, FLAC
- Sample Rate: 16kHz (auto-converted)
- Channels: Mono (auto-converted)
- Bit Depth: 16-bit

### Output (from TTS)
- Format: WAV
- Sample Rate: 22050 Hz
- Channels: Mono
- Bit Depth: 16-bit

## Error Handling

### Common Errors

**API Key Not Configured:**
```json
{
  "message": "AssemblyAI API key not configured"
}
```

**Audio Upload Failed:**
```json
{
  "message": "Audio upload failed"
}
```

**Transcription Failed:**
```json
{
  "message": "Transcription failed"
}
```

**Session Not Found:**
```json
{
  "message": "Session not found"
}
```

## Integration with AI Interview Engine

The Speech module integrates seamlessly with the AI Interview Engine:

1. **Question Generation** → TTS → Audio playback
2. **Candidate Response** → STT → Text → AI Evaluation
3. **Follow-up Questions** → TTS → Audio playback
4. **Final Summary** → TTS → Audio playback

## Best Practices

1. **Audio Quality:**
   - Use good quality microphone
   - Minimize background noise
   - Test audio levels before interview

2. **Cost Optimization:**
   - Cache frequently used TTS audio
   - Use appropriate voice profiles
   - Monitor usage and costs

3. **Error Handling:**
   - Always handle WebSocket disconnections
   - Provide fallback to text-only mode
   - Log errors for debugging

4. **Performance:**
   - Stream audio in chunks (250ms)
   - Use WebSocket for real-time
   - Cache voice profiles

## Future Enhancements

1. **Audio Quality Enhancement:**
   - Noise reduction
   - Echo cancellation
   - Volume normalization

2. **Advanced Features:**
   - Emotion detection from voice
   - Speaking pace analysis
   - Pause detection

3. **Multi-language Support:**
   - Language detection
   - Multi-language TTS
   - Translation integration

4. **Analytics:**
   - Speaking time analysis
   - Response time tracking
   - Voice quality metrics

