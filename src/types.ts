export interface QuestionKey {
  number: number;
  correctAnswer: string; // "A", "B", "C", "D", "T", "F"
  points: number;
  sectionId?: string;
}

export interface Section {
  id: string;
  name: string;
  type: "mcq" | "tf" | "matching"; // MCQ, True/False, or Matching (6 options)
  questions: QuestionKey[];
}

export interface GradedAnswer {
  number: number;
  studentAnswer: string; // student's shaded choice or ""
  correctAnswer: string; // correct key
  isCorrect: boolean;
  points: number;
  pointsAwarded: number;
  sectionId?: string;
}

export interface StudentResult {
  fileName?: string;
  fileDataUrl?: string;
  fileMimeType?: string;
  studentName: string;
  studentId: string;
  totalQuestions: number;
  correctCount: number;
  totalPoints: number;
  scorePoints: number;
  percentage: number;
  gradedAnswers: GradedAnswer[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  fileDataUrl: string; // base64 or object URL
  mimeType: string;
  status: "pending" | "processing" | "success" | "error";
  errorMsg?: string;
  rotation?: number;
  fineTilt?: number;
  contrast?: boolean;
  brightness?: number;
  mcqStartY?: number;
  mcqEndY?: number;
  tfStartY?: number;
  tfEndY?: number;
}
