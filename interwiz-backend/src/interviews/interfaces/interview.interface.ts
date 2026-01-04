export interface ScoreBreakdown {
  [assessmentId: string]: {
    score: number;
    maxScore: number;
    percentage: number;
    responses: number;
  };
}

export interface FaceDetection {
  timestamp: Date;
  facesDetected: number;
  confidence: number;
}

export interface ProctorData {
  faceDetections: FaceDetection[];
  tabSwitches: number;
  fullscreenExits: number;
  suspiciousActivity: string[];
}

