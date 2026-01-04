// Example WebSocket client for testing
// Run with: node test-websocket-client.js

const io = require('socket.io-client');

// Configuration
const SERVER_URL = 'http://localhost:3001';
const NAMESPACE = '/interview';
const TOKEN = 'your-token-here'; // Replace with actual token
const USER_TYPE = 'candidate'; // or 'recruiter'
const INTERVIEW_ID = 'interview-id-here'; // Replace with actual interview ID

// Create connection
const socket = io(`${SERVER_URL}${NAMESPACE}`, {
  auth: {
    token: TOKEN,
  },
  query: {
    userType: USER_TYPE,
  },
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
});

socket.on('connected', (data) => {
  console.log('✅ Server confirmed connection:', data);
  
  // Join interview if candidate
  if (USER_TYPE === 'candidate') {
    socket.emit('join-interview', {
      interviewId: INTERVIEW_ID,
    });
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Interview events
socket.on('interview-ready', (data) => {
  console.log('📋 Interview ready:', data);
  
  // Start interview
  if (data.sessionId) {
    socket.emit('start-interview', {
      sessionId: data.sessionId,
    });
  }
});

socket.on('question', (data) => {
  console.log('❓ Question received:', data);
  console.log('Question:', data.text);
  
  // Simulate response after 5 seconds
  setTimeout(() => {
    socket.emit('response-complete', {
      transcription: 'This is a simulated response to the question.',
      audioUrl: 'https://example.com/audio.wav',
    });
  }, 5000);
});

socket.on('transcription', (data) => {
  if (data.isFinal) {
    console.log('📝 Final transcription:', data.text);
  } else {
    console.log('📝 Partial transcription:', data.text);
  }
});

socket.on('interview-complete', (data) => {
  console.log('✅ Interview completed:', data);
  socket.disconnect();
});

// Recruiter events
socket.on('observation-started', (data) => {
  console.log('👀 Observing interview:', data);
});

socket.on('live-transcript', (data) => {
  console.log('📝 Live transcript:', data.text);
});

socket.on('progress-update', (data) => {
  console.log('📊 Progress update:', data.progress);
  console.log('Score:', data.score);
});

socket.on('proctor-alert', (data) => {
  console.warn('⚠️ Proctor alert:', data);
});

socket.on('interview-completed', (data) => {
  console.log('✅ Interview completed (observer):', data);
});

// Heartbeat
setInterval(() => {
  socket.emit('heartbeat');
}, 30000); // Every 30 seconds

socket.on('heartbeat-ack', (data) => {
  console.log('💓 Heartbeat acknowledged:', data.timestamp);
});

// Proctor event example
socket.on('connect', () => {
  // Simulate proctor event after 10 seconds
  setTimeout(() => {
    socket.emit('proctor-event', {
      type: 'face-detection',
      severity: 'low',
      data: {
        facesDetected: 1,
        confidence: 0.95,
      },
      message: 'Face detected',
    });
  }, 10000);
});

// Handle errors gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

