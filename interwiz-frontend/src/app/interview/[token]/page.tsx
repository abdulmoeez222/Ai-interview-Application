'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Loader2, 
  CheckCircle,
  XCircle,
  Play,
  Pause,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { interviewPublicAPI } from '@/lib/interview-public-api';

type InterviewState = 'loading' | 'ready' | 'playing-question' | 'listening' | 'processing' | 'complete' | 'error';

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<InterviewState>('loading');
  const [interviewId, setInterviewId] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [transcription, setTranscription] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // Fetch interview details
  const { data: interview, isLoading } = useQuery({
    queryKey: ['interview', token],
    queryFn: () => interviewPublicAPI.getInterview(token),
    retry: false,
  });

  // Start interview mutation
  const startMutation = useMutation({
    mutationFn: () => interviewPublicAPI.startInterview(interviewId),
    onSuccess: (data) => {
      setCurrentQuestion(data.currentQuestion);
      setProgress(data.progress);
      setState('ready');
      if (data.currentQuestion.audioUrl) {
        playQuestionAudio(data.currentQuestion.audioUrl);
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to start interview';
      toast.error(message);
      setState('error');
    },
  });

  // Submit response mutation
  const submitMutation = useMutation({
    mutationFn: (audioBlob: Blob) =>
      interviewPublicAPI.submitResponse(interviewId, {
        audioBlob,
        transcription,
      }),
    onSuccess: (data) => {
      if (data.isComplete) {
        setState('complete');
        interviewPublicAPI.completeInterview(interviewId);
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setProgress(data.progress);
        setTranscription('');
        resetRecording();
        setState('ready');
        if (data.nextQuestion.audioUrl) {
          playQuestionAudio(data.nextQuestion.audioUrl);
        }
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to submit response';
      toast.error(message);
      setState('ready');
    },
  });

  useEffect(() => {
    if (interview) {
      setInterviewId(interview.id);
      
      if (interview.status === 'COMPLETED') {
        setState('complete');
      } else if (interview.status === 'CANCELLED') {
        setState('error');
      } else {
        setState('ready');
      }
    }
  }, [interview]);

  const playQuestionAudio = (audioUrl: string) => {
    setState('playing-question');
    setIsPlayingAudio(true);

    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play()
        .then(() => {
          audioRef.current!.onended = () => {
            setIsPlayingAudio(false);
            setState('ready');
          };
        })
        .catch((error) => {
          console.error('Audio playback error:', error);
          setIsPlayingAudio(false);
          setState('ready');
        });
    }
  };

  const handleStartInterview = () => {
    startMutation.mutate();
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
      setState('listening');
    } catch (error) {
      toast.error('Could not access microphone. Please allow microphone access.');
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setState('processing');
  };

  const handleSubmitResponse = () => {
    if (audioBlob) {
      submitMutation.mutate(audioBlob);
    }
  };

  const handleRetryRecording = () => {
    resetRecording();
    setState('ready');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <XCircle className="mr-2 h-5 w-5" />
              Interview Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This interview link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'complete') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <CheckCircle className="mr-2 h-5 w-5" />
              Interview Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Thank you for completing the interview, {interview.candidateName}!
            </p>
            <p className="text-sm text-muted-foreground">
              Your responses have been submitted successfully. The recruiter will review your interview and get back to you soon.
            </p>
            <Alert>
              <AlertDescription>
                You can now close this window.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <XCircle className="mr-2 h-5 w-5" />
              Interview Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This interview has been cancelled or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
          <span className="text-2xl font-bold text-primary-foreground">IW</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">AI Interview</h1>
        <p className="text-muted-foreground">
          {interview.template?.title || 'Interview'} - {interview.template?.jobTitle || 'Position'}
        </p>
      </div>

      {/* Progress */}
      {currentQuestion && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Question {progress.current} of {progress.total}
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <Progress 
              value={(progress.current / progress.total) * 100} 
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {!currentQuestion ? 'Ready to Begin?' : 'Current Question'}
          </CardTitle>
          <CardDescription>
            {!currentQuestion 
              ? `Hello ${interview.candidateName}, this interview will be conducted by our AI assistant. Click "Start Interview" when you're ready.`
              : 'Listen to the question, then click the microphone to record your answer'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Start Interview */}
          {!currentQuestion && state === 'ready' && (
            <div className="text-center py-8">
              <Button
                size="lg"
                onClick={handleStartInterview}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start Interview
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Question Display */}
          {currentQuestion && (
            <>
              <div className="bg-muted p-6 rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <Badge variant="secondary">{currentQuestion.type}</Badge>
                  {isPlayingAudio && (
                    <div className="flex items-center text-primary">
                      <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                      <span className="text-sm">Playing...</span>
                    </div>
                  )}
                </div>
                <p className="text-lg font-medium">{currentQuestion.text}</p>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center space-y-4 py-8">
                {state === 'ready' && !audioBlob && (
                  <>
                    <Button
                      size="lg"
                      onClick={handleStartRecording}
                      disabled={isPlayingAudio}
                      className="w-32 h-32 rounded-full"
                    >
                      <Mic className="h-12 w-12" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {isPlayingAudio ? 'Wait for question to finish...' : 'Click to start recording'}
                    </p>
                  </>
                )}

                {state === 'listening' && (
                  <>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleStopRecording}
                      className="w-32 h-32 rounded-full animate-pulse"
                    >
                      <MicOff className="h-12 w-12" />
                    </Button>
                    <p className="text-sm font-medium text-red-600">
                      Recording... Click to stop
                    </p>
                  </>
                )}

                {state === 'processing' && audioBlob && (
                  <>
                    <div className="flex flex-col items-center space-y-4">
                      <CheckCircle className="h-12 w-12 text-green-600" />
                      <p className="text-sm font-medium">Recording captured!</p>
                      
                      {/* Audio Playback */}
                      <audio 
                        controls 
                        src={URL.createObjectURL(audioBlob)}
                        className="w-full max-w-md"
                      />

                      <div className="flex gap-4">
                        <Button
                          variant="outline"
                          onClick={handleRetryRecording}
                        >
                          Re-record
                        </Button>
                        <Button
                          onClick={handleSubmitResponse}
                          disabled={submitMutation.isPending}
                        >
                          {submitMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Submit Answer'
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Live Transcription (if available) */}
              {transcription && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Transcription:
                  </p>
                  <p className="text-sm text-blue-800">{transcription}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Make sure you're in a quiet environment</li>
            <li>• Allow microphone access when prompted</li>
            <li>• Listen carefully to each question before answering</li>
            <li>• Speak clearly and take your time</li>
            <li>• You can re-record your answer if needed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

