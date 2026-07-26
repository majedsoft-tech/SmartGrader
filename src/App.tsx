import React, { useState, useRef, useEffect } from "react";
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Play, 
  Users, 
  BarChart3, 
  Edit3, 
  Printer, 
  ChevronRight, 
  FileText, 
  Settings, 
  HelpCircle, 
  AlertCircle, 
  RefreshCw, 
  Award,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Search,
  Check,
  X,
  GraduationCap,
  Eye,
  ExternalLink,
  Download,
  ShieldCheck,
  Sliders,
  RotateCw,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Section, QuestionKey, StudentResult, UploadedFile } from "./types";
import { SAMPLE_SECTIONS, SAMPLE_STUDENT_RESULTS, SAMPLE_EXAM_NAME } from "./data/samples";
import BubbleSheetGenerator from "./components/BubbleSheetGenerator";
import PdfPreviewer from "./components/PdfPreviewer";

export default function App() {
  // Navigation & Wizard steps: 'key' | 'students' | 'results'
  const [currentStep, setCurrentStep] = useState<"key" | "students" | "results">("key");

  // State for Answer Key (Step 1)
  const [examName, setExamName] = useState<string>("نموذج إجابة مقرر العلوم والفيزياء");
  const [sections, setSections] = useState<Section[]>([]);
  const [isAnalyzingKey, setIsAnalyzingKey] = useState<boolean>(false);
  const [keyUploadStage, setKeyUploadStage] = useState<string>("");
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [keyFileName, setKeyFileName] = useState<string>("");
  const [keyFileError, setKeyFileError] = useState<string>("");
  const [keyFileBase64, setKeyFileBase64] = useState<string>("");
  const [keyFileMimeType, setKeyFileMimeType] = useState<string>("");
  const [keyFileBlobUrl, setKeyFileBlobUrl] = useState<string>("");

  // State for Student Papers (Step 2)
  const [studentFiles, setStudentFiles] = useState<UploadedFile[]>([]);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<number>(0);
  const [currentGradingFile, setCurrentGradingFile] = useState<string>("");

  // Graded Results (Step 3)
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"list" | "compare">("list");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Print bubble sheet generator modal
  const [showSheetGenerator, setShowSheetGenerator] = useState<boolean>(false);
  const [showEmptyTemplateModal, setShowEmptyTemplateModal] = useState<boolean>(false);

  // Demo / Simulation mode
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // API Key validation indicator (soft banner)
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // New interactive OMR sheet design states
  const [keyViewMode, setKeyViewMode] = useState<"interactive_sheet" | "list">("interactive_sheet");
  const [activeModelForm, setActiveModelForm] = useState<"A" | "B" | "C" | "D">("A");
  const [studentStatus, setStudentStatus] = useState<"present" | "absent" | "cheated">("present");
  const [auditedStudentIds, setAuditedStudentIds] = useState<string[]>([]);

  // Keep track of the active student's blob URL for secure and clean PDF/image preview
  const [activeFileBlobUrl, setActiveFileBlobUrl] = useState<string>("");
  const studentBlobUrlsRef = useRef<string[]>([]);

  // --- Smart OMR Calibration state variables ---
  const [keyRotation, setKeyRotation] = useState<number>(0); // 0, 90, 180, 270
  const [keyFineTilt, setKeyFineTilt] = useState<number>(0); // -10 to 10 degrees (0.5 steps)
  const [keyContrast, setKeyContrast] = useState<boolean>(true); // default true for clean OMR
  const [keyBrightness, setKeyBrightness] = useState<number>(1.0); // 0.5 to 1.5
  const [keyMcqStartY, setKeyMcqStartY] = useState<number>(20); // MCQ start Y percentage
  const [keyMcqEndY, setKeyMcqEndY] = useState<number>(76); // MCQ end Y percentage
  const [keyTfStartY, setKeyTfStartY] = useState<number>(72); // TF start Y percentage
  const [keyTfEndY, setKeyTfEndY] = useState<number>(100); // TF end Y percentage
  const [processedKeyBase64, setProcessedKeyBase64] = useState<string>("");
  const [processedKeyBlobUrl, setProcessedKeyBlobUrl] = useState<string>("");
  const [isProcessingKeyCanvas, setIsProcessingKeyCanvas] = useState<boolean>(false);
  const [showProcessedView, setShowProcessedView] = useState<boolean>(true); // default true to show cleaned-up OMR image
  const [showCropGuides, setShowCropGuides] = useState<boolean>(true); // default true for maximum user utility

  // Individual student calibration states
  const [calibratingStudentFileId, setCalibratingStudentFileId] = useState<string | null>(null);
  const [studentRotation, setStudentRotation] = useState<number>(0);
  const [studentFineTilt, setStudentFineTilt] = useState<number>(0);
  const [studentContrast, setStudentContrast] = useState<boolean>(true);
  const [studentBrightness, setStudentBrightness] = useState<number>(1.0);
  const [studentMcqStartY, setStudentMcqStartY] = useState<number>(20);
  const [studentMcqEndY, setStudentMcqEndY] = useState<number>(76);
  const [studentTfStartY, setStudentTfStartY] = useState<number>(72);
  const [studentTfEndY, setStudentTfEndY] = useState<number>(100);
  const [processedStudentBase64, setProcessedStudentBase64] = useState<string>("");
  const [processedStudentBlobUrl, setProcessedStudentBlobUrl] = useState<string>("");
  const [isProcessingStudentCanvas, setIsProcessingStudentCanvas] = useState<boolean>(false);
  const [showStudentProcessedView, setShowStudentProcessedView] = useState<boolean>(true);
  const [showStudentCropGuides, setShowStudentCropGuides] = useState<boolean>(true);

  // Process image with rotation, fine tilt, contrast enhancement, and brightness adjustment
  const processImageWithCanvas = (
    base64Data: string,
    mimeType: string,
    rotation: number,
    fineTilt: number,
    contrast: boolean,
    brightness: number
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!mimeType.startsWith("image/")) {
        resolve(base64Data);
        return;
      }

      const img = new Image();
      img.src = `data:${mimeType};base64,${base64Data}`;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(base64Data);
            return;
          }

          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          // Downscale high-resolution images to a maximum dimension of 1000px
          // to reduce base64 size, network overhead, and API processing times.
          const MAX_DIMENSION = 1000;
          let scale = 1;
          if (Math.max(origW, origH) > MAX_DIMENSION) {
            scale = MAX_DIMENSION / Math.max(origW, origH);
          }
          const scaledW = origW * scale;
          const scaledH = origH * scale;

          // Compute dimensions for 90 or 270 degree rotation
          const isSwapped = rotation === 90 || rotation === 270;
          const canvasW = isSwapped ? scaledH : scaledW;
          const canvasH = isSwapped ? scaledW : scaledH;

          canvas.width = canvasW;
          canvas.height = canvasH;

          // Apply translations and rotation
          ctx.translate(canvasW / 2, canvasH / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          
          if (fineTilt !== 0) {
            ctx.rotate((fineTilt * Math.PI) / 180);
          }

          // Draw the original image centered and scaled
          ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);

          // Reset transformations
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Apply visual filters for OMR optimization
          // Filters make unshaded paper bright white and shaded pencil marks very black
          let filterStr = "";
          if (contrast) {
            filterStr += "grayscale(100%) contrast(1.6) brightness(1.05) ";
          } else if (brightness !== 1.0) {
            filterStr += `brightness(${brightness}) `;
          }

          // Force export format to image/jpeg for high compression and small size
          const exportMimeType = "image/jpeg";
          const exportQuality = 0.75;

          if (filterStr.trim() !== "") {
            const filterCanvas = document.createElement("canvas");
            filterCanvas.width = canvasW;
            filterCanvas.height = canvasH;
            const filterCtx = filterCanvas.getContext("2d");
            if (filterCtx) {
              filterCtx.filter = filterStr;
              filterCtx.drawImage(canvas, 0, 0);
              const dataUrl = filterCanvas.toDataURL(exportMimeType, exportQuality);
              const commaIdx = dataUrl.indexOf(",");
              resolve(commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl);
              return;
            }
          }

          const dataUrl = canvas.toDataURL(exportMimeType, exportQuality);
          const commaIdx = dataUrl.indexOf(",");
          resolve(commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl);
        } catch (err) {
          console.error("Error in canvas pre-processing:", err);
          resolve(base64Data);
        }
      };
      img.onerror = () => {
        resolve(base64Data);
      };
    });
  };

  const resetKeyCalibration = () => {
    setKeyRotation(0);
    setKeyFineTilt(0);
    setKeyContrast(true);
    setKeyBrightness(1.0);
    setKeyMcqStartY(20);
    setKeyMcqEndY(76);
    setKeyTfStartY(72);
    setKeyTfEndY(100);
  };

  const openStudentCalibration = (fileId: string) => {
    const fileObj = studentFiles.find(f => f.id === fileId);
    if (!fileObj) return;

    setCalibratingStudentFileId(fileId);
    setStudentRotation(fileObj.rotation ?? keyRotation ?? 0);
    setStudentFineTilt(fileObj.fineTilt ?? keyFineTilt ?? 0);
    setStudentContrast(fileObj.contrast ?? keyContrast ?? true);
    setStudentBrightness(fileObj.brightness ?? keyBrightness ?? 1.0);
    setStudentMcqStartY(fileObj.mcqStartY ?? keyMcqStartY ?? 20);
    setStudentMcqEndY(fileObj.mcqEndY ?? keyMcqEndY ?? 76);
    setStudentTfStartY(fileObj.tfStartY ?? keyTfStartY ?? 72);
    setStudentTfEndY(fileObj.tfEndY ?? keyTfEndY ?? 100);
    setProcessedStudentBase64("");
    setProcessedStudentBlobUrl("");
    setShowStudentProcessedView(true);
    setShowStudentCropGuides(true);
  };

  const saveStudentCalibration = () => {
    if (!calibratingStudentFileId) return;

    setStudentFiles(prev => prev.map(f => {
      if (f.id !== calibratingStudentFileId) return f;
      return {
        ...f,
        rotation: studentRotation,
        fineTilt: studentFineTilt,
        contrast: studentContrast,
        brightness: studentBrightness,
        mcqStartY: studentMcqStartY,
        mcqEndY: studentMcqEndY,
        tfStartY: studentTfStartY,
        tfEndY: studentTfEndY,
        status: "pending" as const,
        errorMsg: undefined
      };
    }));

    if (processedStudentBlobUrl) {
      try {
        URL.revokeObjectURL(processedStudentBlobUrl);
      } catch (e) {}
    }
    setCalibratingStudentFileId(null);
  };

  useEffect(() => {
    return () => {
      // Clean up all created student blob URLs on unmount
      studentBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, []);

  // Trigger key image canvas pre-processing when any parameter changes
  useEffect(() => {
    if (!keyFileBase64 || !keyFileMimeType) return;

    let isCurrent = true;
    setIsProcessingKeyCanvas(true);

    const runProc = async () => {
      try {
        const procBase64 = await processImageWithCanvas(
          keyFileBase64,
          keyFileMimeType,
          keyRotation,
          keyFineTilt,
          keyContrast,
          keyBrightness
        );

        if (isCurrent) {
          setProcessedKeyBase64(procBase64);
          
          const byteCharacters = atob(procBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: keyFileMimeType });
          const url = URL.createObjectURL(blob);

          setProcessedKeyBlobUrl(prev => {
            if (prev) {
              try {
                URL.revokeObjectURL(prev);
              } catch (e) {}
            }
            return url;
          });
        }
      } catch (err) {
        console.error("Error processing key image canvas:", err);
      } finally {
        if (isCurrent) {
          setIsProcessingKeyCanvas(false);
        }
      }
    };

    const timeout = setTimeout(runProc, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [keyFileBase64, keyRotation, keyFineTilt, keyContrast, keyBrightness, keyFileMimeType]);

  // Trigger student image canvas pre-processing when student calibration changes
  useEffect(() => {
    if (!calibratingStudentFileId) return;
    const fileObj = studentFiles.find(f => f.id === calibratingStudentFileId);
    if (!fileObj || !fileObj.fileDataUrl || !fileObj.mimeType) return;

    let isCurrent = true;
    setIsProcessingStudentCanvas(true);

    const runProc = async () => {
      try {
        const procBase64 = await processImageWithCanvas(
          fileObj.fileDataUrl,
          fileObj.mimeType,
          studentRotation,
          studentFineTilt,
          studentContrast,
          studentBrightness
        );

        if (isCurrent) {
          setProcessedStudentBase64(procBase64);
          
          const byteCharacters = atob(procBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: fileObj.mimeType });
          const url = URL.createObjectURL(blob);

          setProcessedStudentBlobUrl(prev => {
            if (prev) {
              try {
                URL.revokeObjectURL(prev);
              } catch (e) {}
            }
            return url;
          });
        }
      } catch (err) {
        console.error("Error processing student image canvas:", err);
      } finally {
        if (isCurrent) {
          setIsProcessingStudentCanvas(false);
        }
      }
    };

    const timeout = setTimeout(runProc, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [calibratingStudentFileId, studentRotation, studentFineTilt, studentContrast, studentBrightness, studentFiles]);

  useEffect(() => {
    if (selectedStudentIndex !== null && results[selectedStudentIndex]) {
      const student = results[selectedStudentIndex];
      if (student.fileDataUrl && student.fileMimeType) {
        try {
          // Decode base64 to binary data
          const byteCharacters = atob(student.fileDataUrl);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: student.fileMimeType });
          const url = URL.createObjectURL(blob);
          
          studentBlobUrlsRef.current.push(url);
          setActiveFileBlobUrl(url);
        } catch (e) {
          console.error("Error creating blob URL:", e);
          setActiveFileBlobUrl("");
        }
      } else {
        setActiveFileBlobUrl("");
      }
    } else {
      setActiveFileBlobUrl("");
    }
  }, [selectedStudentIndex, results]);

  // Load sample demo on startup to give a premium pre-loaded experience
  useEffect(() => {
    loadDemoTemplate();

    // Check if GEMINI_API_KEY is configured on the backend
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        setHasApiKey(!!data.hasApiKey);
        if (!data.hasApiKey) {
          setApiError("تنبيه: لم يتم العثور على مفتاح 'GEMINI_API_KEY' في ملف الإعدادات الخاص بك. يمكنك متابعة استخدام التطبيق وتصحيح الأوراق عبر 'وضع المحاكاة التجريبي السريع' ببيانات افتراضية واقعية، ولكن للبدء في تصحيح أوراق حقيقية عبر الذكاء الاصطناعي، يرجى إدخال المفتاح في قسم الإعدادات (Settings > Secrets).");
        }
      })
      .catch(err => {
        console.error("Error checking configuration:", err);
      });
  }, []);

  const loadDemoTemplate = () => {
    // Clear all correctAnswer fields so the model starts without shading/answers
    const clearedSections = JSON.parse(JSON.stringify(SAMPLE_SECTIONS)).map((sec: any) => ({
      ...sec,
      questions: sec.questions.map((q: any) => ({
        ...q,
        correctAnswer: ""
      }))
    }));
    setSections(clearedSections);
    setExamName(SAMPLE_EXAM_NAME);
    setIsDemoMode(true);
    setApiError(null);
    setKeyFile(null);
    setKeyFileName("");
    setKeyFileError("");
    setKeyFileBase64("");
    setKeyFileMimeType("");
    if (keyFileBlobUrl) {
      try {
        URL.revokeObjectURL(keyFileBlobUrl);
      } catch (e) {
        console.error(e);
      }
    }
    setKeyFileBlobUrl("");
    setStudentFiles([]);
    setResults([]);
    setSelectedStudentIndex(null);
    setAuditedStudentIds([]);
  };

  const resetTemplateAndFiles = () => {
    setSections([]);
    setExamName("");
    setIsDemoMode(false);
    setApiError(null);
    setKeyFile(null);
    setKeyFileName("");
    setKeyFileError("");
    setKeyFileBase64("");
    setKeyFileMimeType("");
    if (keyFileBlobUrl) {
      try {
        URL.revokeObjectURL(keyFileBlobUrl);
      } catch (err) {
        console.error(err);
      }
    }
    setKeyFileBlobUrl("");
    setStudentFiles([]);
    setResults([]);
    setSelectedStudentIndex(null);
    setAuditedStudentIds([]);
  };

  const getEmptyOfficialMoeTemplate = (): Section[] => {
    // MCQ Section: Q1 to Q60
    const mcqQuestions = Array.from({ length: 60 }, (_, i) => ({
      number: i + 1,
      correctAnswer: "", // completely unshaded by default
      points: 1,
      sectionId: "sec_mcq"
    }));

    // True/False Section: Q1 to Q30
    const tfQuestions = Array.from({ length: 30 }, (_, i) => ({
      number: i + 1,
      correctAnswer: "", // completely unshaded by default
      points: 1,
      sectionId: "sec_tf"
    }));

    // Matching Section: Q1 to Q10
    const matchingQuestions = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      correctAnswer: "", // completely unshaded by default
      points: 1,
      sectionId: "sec_matching"
    }));

    return [
      {
        id: "sec_mcq",
        name: "السؤال الأول: الاختيار من متعدد",
        type: "mcq",
        questions: mcqQuestions
      },
      {
        id: "sec_tf",
        name: "السؤال الثاني: الصواب والخطأ",
        type: "tf",
        questions: tfQuestions
      },
      {
        id: "sec_matching",
        name: "السؤال الثالث: المزاوجة",
        type: "matching",
        questions: matchingQuestions
      }
    ];
  };

  const loadOfficialMoeTemplate = () => {
    // MCQ Section: Q1 to Q60
    const mcqQuestions = Array.from({ length: 60 }, (_, i) => ({
      number: i + 1,
      correctAnswer: ["A", "B", "C", "D"][i % 4], // prefilled alternating answer key
      points: 1,
      sectionId: "sec_mcq"
    }));

    // True/False Section: Q1 to Q30 (each starting from 1!)
    const tfQuestions = Array.from({ length: 30 }, (_, i) => ({
      number: i + 1,
      correctAnswer: i % 2 === 0 ? "T" : "F", // prefilled alternating صح / خطأ
      points: 1,
      sectionId: "sec_tf"
    }));

    // Matching Section: Q1 to Q10 (each starting from 1!)
    const matchingQuestions = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      correctAnswer: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"][i % 10], // prefilled alternating A-J
      points: 1,
      sectionId: "sec_matching"
    }));

    const officialSections: Section[] = [
      {
        id: "sec_mcq",
        name: "السؤال الأول: الاختيار من متعدد",
        type: "mcq",
        questions: mcqQuestions
      },
      {
        id: "sec_tf",
        name: "السؤال الثاني: الصواب والخطأ",
        type: "tf",
        questions: tfQuestions
      },
      {
        id: "sec_matching",
        name: "السؤال الثالث: المزاوجة",
        type: "matching",
        questions: matchingQuestions
      }
    ];

    setSections(officialSections);
    setExamName("نموذج اختبار علم البيئة النهائي - مدرسة ام الحمام الثانوية");
    setIsDemoMode(true);
    setApiError(null);
    setKeyFile(null);
    setKeyFileName("");
    setKeyFileError("");
    setKeyFileBase64("");
    setKeyFileMimeType("");
    if (keyFileBlobUrl) {
      try {
        URL.revokeObjectURL(keyFileBlobUrl);
      } catch (e) {
        console.error(e);
      }
    }
    setKeyFileBlobUrl("");
    setStudentFiles([]);
    setResults([]);
    setSelectedStudentIndex(null);
    setAuditedStudentIds([]);
  };

  // Robust helper to shade a bubble in the interactive sheet
  const toggleBubbleShading = (sectionType: "mcq" | "tf" | "matching", questionNum: number, answerCode: string) => {
    const sectionId = sectionType === "mcq" ? "sec_mcq" : (sectionType === "tf" ? "sec_tf" : "sec_matching");
    
    setSections(prev => {
      const secExists = prev.some(s => s.id === sectionId);
      let updatedSections = [...prev];
      
      if (!secExists) {
        const newSec: Section = {
          id: sectionId,
          name: sectionType === "mcq" ? "السؤال الأول: الاختيار من متعدد" : (sectionType === "tf" ? "السؤال الثاني: الصواب والخطأ" : "السؤال الثالث: المزاوجة"),
          type: sectionType,
          questions: []
        };
        updatedSections.push(newSec);
      }

      return updatedSections.map(sec => {
        if (sec.id !== sectionId) return sec;
        
        const qExists = sec.questions.some(q => q.number === questionNum);
        if (qExists) {
          return {
            ...sec,
            questions: sec.questions.map(q => {
              if (q.number === questionNum) {
                const newAns = q.correctAnswer === answerCode ? "" : answerCode;
                return { ...q, correctAnswer: newAns };
              }
              return q;
            })
          };
        } else {
          const newQ: QuestionKey = {
            number: questionNum,
            correctAnswer: answerCode,
            points: 1,
            sectionId: sectionId
          };
          return {
            ...sec,
            questions: [...sec.questions, newQ].sort((a, b) => a.number - b.number)
          };
        }
      });
    });
  };

  const generateSimulatedResults = (flatAnswerKey: any[]): StudentResult[] => {
    const names = [
      "احمد اسامه نصرالدين ابراهيم",
      "محمد خالد العتيبي",
      "عبدالرحمن صالح الحربي",
      "سارة عبدالعزيز الشمري"
    ];
    const ids = ["11001", "4421102", "4420853", "4420918"];
    const files = ["student_ahmed.pdf", "student_mohammed.png", "student_abdulrahman.png", "student_sarah.pdf"];

    return names.map((name, index) => {
      const successRate = 0.7 + Math.random() * 0.25;
      
      const gradedAnswers = flatAnswerKey.map(q => {
        const isCorrect = Math.random() < successRate;
        let studentAnswer = q.correctAnswer;
        
        if (!isCorrect) {
          if (q.correctAnswer === "T") studentAnswer = "F";
          else if (q.correctAnswer === "F") studentAnswer = "T";
          else {
            const options = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
            const maxOptIndex = q.type === "mcq" ? 3 : (q.type === "tf" ? 1 : 9); // MCQ: 4 options, TF: 2 options, Matching: 10 options
            const availableOptions = options.slice(0, maxOptIndex + 1).filter(o => o !== q.correctAnswer);
            studentAnswer = availableOptions[Math.floor(Math.random() * availableOptions.length)] || "";
          }
        }

        // 3% chance of leaving blank
        if (Math.random() < 0.03) {
          studentAnswer = "";
        }

        const finalIsCorrect = studentAnswer === q.correctAnswer;
        const pointsAwarded = finalIsCorrect ? q.points : 0;

        return {
          number: q.number,
          studentAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect: finalIsCorrect,
          points: q.points,
          pointsAwarded,
          sectionId: q.sectionId
        };
      });

      const totalPoints = flatAnswerKey.reduce((acc, q) => acc + q.points, 0);
      const scorePoints = gradedAnswers.reduce((acc, q) => acc + q.pointsAwarded, 0);
      const percentage = totalPoints > 0 ? Math.round((scorePoints / totalPoints) * 100) : 0;
      const correctCount = gradedAnswers.filter(q => q.isCorrect).length;

      return {
        fileName: files[index],
        studentName: name,
        studentId: ids[index],
        totalQuestions: flatAnswerKey.length,
        correctCount,
        totalPoints,
        scorePoints,
        percentage,
        gradedAnswers
      };
    });
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(",");
        const base64 = result.substring(commaIndex + 1);
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Crop a specific vertical range of a base64 image using HTML5 Canvas
  const cropImage = (
    base64Data: string,
    mimeType: string,
    startYPercent: number,
    endYPercent: number
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!mimeType.startsWith("image/")) {
        resolve("");
        return;
      }

      const img = new Image();
      img.src = `data:${mimeType};base64,${base64Data}`;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }

          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          const startY = Math.floor(originalHeight * (startYPercent / 100));
          const endY = Math.floor(originalHeight * (endYPercent / 100));
          const height = endY - startY;

          canvas.width = originalWidth;
          canvas.height = height;

          ctx.drawImage(
            img,
            0, startY, originalWidth, height, // Source rectangle
            0, 0, originalWidth, height      // Destination rectangle
          );

          // Force export format to image/jpeg with high compression to keep slice sizes extremely small
          const exportMime = "image/jpeg";
          const croppedDataUrl = canvas.toDataURL(exportMime, 0.70);
          const commaIdx = croppedDataUrl.indexOf(",");
          const croppedBase64 = commaIdx !== -1 ? croppedDataUrl.substring(commaIdx + 1) : croppedDataUrl;
          resolve(croppedBase64);
        } catch (err) {
          console.error("Error cropping image slice:", err);
          resolve("");
        }
      };
      img.onerror = () => {
        resolve("");
      };
    });
  };

  // Upload & Analyze Answer Key (Template)
  const handleKeyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (keyFileBlobUrl) {
      try {
        URL.revokeObjectURL(keyFileBlobUrl);
      } catch (err) {
        console.error(err);
      }
    }

    const blobUrl = URL.createObjectURL(file);
    setKeyFileBlobUrl(blobUrl);

    setKeyFile(file);
    setKeyFileName(file.name);
    setKeyFileError("");
    setIsAnalyzingKey(true);
    setKeyUploadStage("جاري بدء قراءة وتحليل ملف نموذج الإجابة...");
    setApiError(null);
    setIsDemoMode(false);
    setSections([]); // Clear default prefilled sections immediately to prevent showing wrong default template on error
    setStudentFiles([]);
    setResults([]);
    setSelectedStudentIndex(null);
    setAuditedStudentIds([]);

    try {
      setKeyUploadStage("جاري معالجة وتحسين وضوح صورة نموذج الإجابة...");
      const { base64, mimeType } = await fileToBase64(file);
      
      let processedBase64 = base64;
      if (mimeType.startsWith("image/")) {
        try {
          // Pre-process using the same downscaling and high compression logic as student sheets
          processedBase64 = await processImageWithCanvas(base64, mimeType, 0, 0, true, 1.0);
        } catch (procErr) {
          console.error("Failed to pre-process template key with canvas:", procErr);
        }
      }

      setKeyFileBase64(processedBase64);
      setKeyFileMimeType(mimeType);

      // Slicing Protocol for high-accuracy key analysis
      let mcqSlice = "";
      let tfMatchingSlice = "";
      if (mimeType.startsWith("image/")) {
        setKeyUploadStage("جاري قص أجزاء نموذج الأسئلة لزيادة دقة التصحيح الآلي...");
        try {
          mcqSlice = await cropImage(processedBase64, mimeType, 20, 76);
          tfMatchingSlice = await cropImage(processedBase64, mimeType, 72, 100);
        } catch (cropErr) {
          console.error("Failed to generate slices for template key, using original", cropErr);
        }
      }

      setKeyUploadStage("جاري إرسال البيانات للذكاء الاصطناعي للتحليل (يستغرق 10-25 ثانية)...");
      const response = await fetch("/api/analyze-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          file: processedBase64, 
          mimeType,
          mcqSlice,
          tfMatchingSlice
        }),
      });

      let data: any;
      setKeyUploadStage("جاري استقبال الإجابات المقروءة من خادم الذكاء الاصطناعي...");
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textErr = await response.text();
        throw new Error(`استجابة غير صالحة من الخادم (كود ${response.status}): ${textErr.slice(0, 150)}`);
      }

      if (response.ok && data.sections) {
        setKeyUploadStage("جاري بناء وتحديث نموذج الإجابة التفاعلي...");
        let totalShaded = 0;
        data.sections.forEach((sec: any) => {
          if (sec.questions) {
            sec.questions.forEach((q: any) => {
              if (q.correctAnswer && q.correctAnswer.toString().trim() !== "") {
                totalShaded++;
              }
            });
          }
        });

        let standardizedSections: Section[] = [];
        if (totalShaded === 0) {
          standardizedSections = getEmptyOfficialMoeTemplate();
          setShowEmptyTemplateModal(true);
        } else {
          standardizedSections = data.sections.map((sec: any) => {
            let id = sec.id;
            if (sec.type === "mcq") id = "sec_mcq";
            else if (sec.type === "tf") id = "sec_tf";
            else if (sec.type === "matching") id = "sec_matching";
            
            const questions = (sec.questions || []).map((q: any) => {
              let normAns = "";
              if (q.correctAnswer) {
                const val = q.correctAnswer.toString().trim().toUpperCase();
                if (val === "صح" || val === "ص" || val === "T" || val === "TRUE" || val === "Y" || val === "YES") {
                  normAns = "T";
                } else if (val === "خطأ" || val === "خ" || val === "F" || val === "FALSE" || val === "N" || val === "NO") {
                  normAns = "F";
                } else if (val === "أ") {
                  normAns = "A";
                } else if (val === "ب") {
                  normAns = "B";
                } else if (val === "ج") {
                  normAns = "C";
                } else if (val === "د") {
                  normAns = "D";
                } else if (val === "هـ" || val === "ه") {
                  normAns = "E";
                } else if (val === "و") {
                  normAns = "F";
                } else if (val === "ز") {
                  normAns = "G";
                } else if (val === "ح") {
                  normAns = "H";
                } else if (val === "ط") {
                  normAns = "I";
                } else if (val === "ي") {
                  normAns = "J";
                } else {
                  normAns = val;
                }
              }

              return {
                ...q,
                number: q.number,
                correctAnswer: normAns,
                points: typeof q.points === "number" ? q.points : 1,
                sectionId: id
              };
            });

            return { ...sec, id, questions };
          });
        }
        setSections(standardizedSections);
        if (data.examName) setExamName(data.examName);
        setIsDemoMode(false);
      } else {
        throw new Error(data.error || "فشل تحليل ورقة الإجابة.");
      }
    } catch (err: any) {
      console.error(err);
      setKeyFileError(err.message || "حدث خطأ أثناء الاتصال بالخادم الذكي.");
      setApiError("لم نتمكن من الوصول لخدمة الذكاء الاصطناعي لتصحيح ورقتك تلقائياً. تأكد من إعداد مفتاح GEMINI_API_KEY في قسم الأسرار (Secrets)، أو يمكنك متابعة التصحيح عبر الوضع التجريبي المحاكي!");
    } finally {
      setIsAnalyzingKey(false);
      setKeyUploadStage("");
      try {
        e.target.value = "";
      } catch (err) {
        console.error("Could not reset file input value:", err);
      }
    }
  };

  // Re-run OMR analysis on the Answer Key using calibrated canvas image & custom slice percentages
  const reAnalyzeKeyWithCalibration = async () => {
    if (!keyFileBase64 || !keyFileMimeType) {
      setKeyFileError("الرجاء تحميل ورقة إجابة أولاً.");
      return;
    }

    setIsAnalyzingKey(true);
    setKeyUploadStage("جاري تجميع الصورة المعدلة ومعايرتها...");
    setKeyFileError("");
    setApiError(null);

    try {
      const activeBase64 = processedKeyBase64 || keyFileBase64;
      
      let mcqSlice = "";
      let tfMatchingSlice = "";
      if (keyFileMimeType.startsWith("image/")) {
        setKeyUploadStage("جاري إعادة قص أجزاء نموذج الأسئلة المعاير...");
        try {
          mcqSlice = await cropImage(activeBase64, keyFileMimeType, keyMcqStartY, keyMcqEndY);
          tfMatchingSlice = await cropImage(activeBase64, keyFileMimeType, keyTfStartY, keyTfEndY);
        } catch (cropErr) {
          console.error("Failed to generate custom calibrated slices for answer key template", cropErr);
        }
      }

      setKeyUploadStage("جاري إرسال التحديث والمطابقة مجدداً بالذكاء الاصطناعي (يستغرق 10-25 ثانية)...");
      const response = await fetch("/api/analyze-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          file: activeBase64, 
          mimeType: keyFileMimeType,
          mcqSlice,
          tfMatchingSlice
        }),
      });

      let data: any;
      setKeyUploadStage("جاري استقبال الإجابات المقروءة المعايرة...");
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textErr = await response.text();
        throw new Error(`استجابة غير صالحة من الخادم (كود ${response.status}): ${textErr.slice(0, 150)}`);
      }

      if (response.ok && data.sections) {
        setKeyUploadStage("جاري تحديث هيكل ورقة الإجابة والمعايرة في الواجهة...");
        let totalShaded = 0;
        data.sections.forEach((sec: any) => {
          if (sec.questions) {
            sec.questions.forEach((q: any) => {
              if (q.correctAnswer && q.correctAnswer.toString().trim() !== "") {
                totalShaded++;
              }
            });
          }
        });

        let standardizedSections: Section[] = [];
        if (totalShaded === 0) {
          standardizedSections = getEmptyOfficialMoeTemplate();
          setShowEmptyTemplateModal(true);
        } else {
          standardizedSections = data.sections.map((sec: any) => {
            let id = sec.id;
            if (sec.type === "mcq") id = "sec_mcq";
            else if (sec.type === "tf") id = "sec_tf";
            else if (sec.type === "matching") id = "sec_matching";
            
            const questions = (sec.questions || []).map((q: any) => {
              let normAns = "";
              if (q.correctAnswer) {
                const val = q.correctAnswer.toString().trim().toUpperCase();
                if (val === "صح" || val === "ص" || val === "T" || val === "TRUE" || val === "Y" || val === "YES") {
                  normAns = "T";
                } else if (val === "خطأ" || val === "خ" || val === "F" || val === "FALSE" || val === "N" || val === "NO") {
                  normAns = "F";
                } else if (val === "أ") {
                  normAns = "A";
                } else if (val === "ب") {
                  normAns = "B";
                } else if (val === "ج") {
                  normAns = "C";
                } else if (val === "د") {
                  normAns = "D";
                } else if (val === "هـ" || val === "ه") {
                  normAns = "E";
                } else if (val === "و") {
                  normAns = "F";
                } else if (val === "ز") {
                  normAns = "G";
                } else if (val === "ح") {
                  normAns = "H";
                } else if (val === "ط") {
                  normAns = "I";
                } else if (val === "ي") {
                  normAns = "J";
                } else {
                  normAns = val;
                }
              }

              return {
                ...q,
                number: q.number,
                correctAnswer: normAns,
                points: typeof q.points === "number" ? q.points : 1,
                sectionId: id
              };
            });

            return { ...sec, id, questions };
          });
        }
        setSections(standardizedSections);
        if (data.examName) setExamName(data.examName);
        setIsDemoMode(false);
      } else {
        throw new Error(data.error || "فشل تحليل ورقة الإجابة المعدلة.");
      }
    } catch (err: any) {
      console.error(err);
      setKeyFileError(err.message || "حدث خطأ أثناء معالجة وإعادة تصحيح ورقة نموذج الإجابة.");
    } finally {
      setIsAnalyzingKey(false);
      setKeyUploadStage("");
    }
  };

  // Toggle active/inactive state of a question (Ignore question feature)
  const toggleQuestionActive = (sectionId: string, questionNumber: number) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      
      // If question exists, remove it. If it doesn't, add it.
      const exists = sec.questions.some(q => q.number === questionNumber);
      if (exists) {
        return {
          ...sec,
          questions: sec.questions.filter(q => q.number !== questionNumber)
        };
      } else {
        // Find maximum number or default
        const newQuestion: QuestionKey = {
          number: questionNumber,
          correctAnswer: sec.type === "tf" ? "T" : "A",
          points: 1
        };
        // Insert and sort
        const updated = [...sec.questions, newQuestion].sort((a, b) => a.number - b.number);
        return { ...sec, questions: updated };
      }
    }));
  };

  // Modify correct answer for a question in the answer key editor
  const handleAnswerKeyChange = (sectionId: string, questionNumber: number, answer: string) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.map(q => {
          if (q.number === questionNumber) {
            return { ...q, correctAnswer: answer };
          }
          return q;
        })
      };
    }));
  };

  // Modify point weighting for a question in the answer key editor
  const handlePointsChange = (sectionId: string, questionNumber: number, points: number) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.map(q => {
          if (q.number === questionNumber) {
            return { ...q, points: Math.max(0, points) };
          }
          return q;
        })
      };
    }));
  };

  // Modify point weighting for ALL questions within a section
  const handleSectionPointsChange = (sectionId: string, points: number) => {
    setSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.map(q => ({
          ...q,
          points: Math.max(0, points)
        }))
      };
    }));
  };

  // Add new section to Answer Key
  const addNewSection = (type: "mcq" | "tf" | "matching") => {
    const id = `sec_${Date.now()}`;
    const name = 
      type === "mcq" ? "قسم اختيار من متعدد جديد" : 
      type === "tf" ? "قسم صح أم خطأ جديد" : 
      "قسم المزاوجة والربط (6 اختيارات) جديد";
    
    // Find highest question number currently used to start next questions
    let maxNum = 0;
    sections.forEach(s => {
      s.questions.forEach(q => {
        if (q.number > maxNum) maxNum = q.number;
      });
    });

    const newSec: Section = {
      id,
      name,
      type,
      questions: [
        { number: maxNum + 1, correctAnswer: type === "tf" ? "T" : "A", points: 1 }
      ]
    };

    setSections([...sections, newSec]);
  };

  // Delete section from answer key
  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  // Add a specific question slot manually to a section
  const addQuestionToSection = (sectionId: string) => {
    setSections(prev => {
      // Find overall maximum question number across all sections
      let overallMax = 0;
      prev.forEach(s => {
        s.questions.forEach(q => {
          if (q.number > overallMax) overallMax = q.number;
        });
      });
      const nextNum = overallMax + 1;

      return prev.map(sec => {
        if (sec.id !== sectionId) return sec;

        const newQ: QuestionKey = {
          number: nextNum,
          correctAnswer: sec.type === "tf" ? "T" : "A",
          points: 1
        };

        return {
          ...sec,
          questions: [...sec.questions, newQ].sort((a, b) => a.number - b.number)
        };
      });
    });
  };

  // Upload student files
  const handleStudentFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files) as File[];
    const readPromises = filesArray.map((file) => {
      return new Promise<UploadedFile>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          if (reader.result) {
            const resultStr = reader.result as string;
            const commaIdx = resultStr.indexOf(",");
            const base64 = commaIdx !== -1 ? resultStr.substring(commaIdx + 1) : "";
            resolve({
              id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: file.name,
              size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              fileDataUrl: base64,
              mimeType: file.type,
              status: "pending" as const
            });
          } else {
            resolve({
              id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: file.name,
              size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              fileDataUrl: "",
              mimeType: file.type,
              status: "error" as const,
              errorMsg: "فشل في قراءة ملف الطالب"
            });
          }
        };
        reader.onerror = () => {
          resolve({
            id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            fileDataUrl: "",
            mimeType: file.type,
            status: "error" as const,
            errorMsg: "فشل في قراءة ملف الطالب"
          });
        };
      });
    });

    const loadedFiles = await Promise.all(readPromises);
    
    if (results.length > 0) {
      // Overwrite/Replace completely if they are uploading a new batch of papers after a previous grading run
      setStudentFiles(loadedFiles);
      setResults([]);
      setSelectedStudentIndex(null);
      setAuditedStudentIds([]);
    } else {
      // Append if they are still building the list before grading
      setStudentFiles(prev => [...prev, ...loadedFiles]);
    }

    setIsDemoMode(false); // Disable simulation since they are uploading real student papers

    try {
      e.target.value = "";
    } catch (err) {
      console.error(err);
    }
  };

  // Delete uploaded student file
  const deleteStudentFile = (id: string) => {
    setStudentFiles(studentFiles.filter(f => f.id !== id));
  };

  // Core OMR Correction Phase
  const startCorrection = async () => {
    if (studentFiles.length === 0 && !isDemoMode) {
      alert("الرجاء تحميل أوراق إجابات الطلاب أولاً أو تشغيل الوضع التجريبي!");
      return;
    }

    setIsGrading(true);
    setGradingProgress(0);
    setApiError(null);

    // Flatten all active questions for the OMR comparison key
    const flatAnswerKey = sections.flatMap(sec => 
      sec.questions.map(q => ({
        number: q.number,
        correctAnswer: q.correctAnswer,
        points: q.points,
        sectionId: sec.id,
        type: sec.type
      }))
    );

    if (flatAnswerKey.length === 0) {
      alert("الرجاء تعيين سؤال واحد على الأقل في نموذج الإجابة النموذجية!");
      setIsGrading(false);
      return;
    }

    // --- DEMO / SIMULATION MODE CORRECTION ---
    if (isDemoMode || studentFiles.length === 0) {
      // Simulate grading steps
      const mockFileNames = ["student_ahmed.pdf", "student_mohammed.png", "student_abdulrahman.png", "student_sarah.pdf"];
      const totalSteps = mockFileNames.length;
      for (let i = 0; i < totalSteps; i++) {
        setCurrentGradingFile(mockFileNames[i]);
        await new Promise(r => setTimeout(r, 800)); // nice animated delay
        setGradingProgress(Math.round(((i + 1) / totalSteps) * 100));
      }

      const customGradedResults = generateSimulatedResults(flatAnswerKey);

      setResults(customGradedResults);
      setIsGrading(false);
      setCurrentStep("results");
      return;
    }

    // --- REAL AI CORRECTION VIA EXPRESS ENDPOINT ---
    const gradedList: StudentResult[] = [];
    const filesToGrade = [...studentFiles];
    let completedCount = 0;

    // Concurrency limit of 5 parallel requests to prevent API rate limits or network choking
    const CONCURRENCY_LIMIT = 5;

    const gradeSingleFile = async (fileObj: typeof filesToGrade[0]) => {
      // Update status to processing
      setStudentFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: "processing" } : f));
      setCurrentGradingFile(fileObj.name);

      try {
        // Wait for file reader base64 string to populate if not ready
        let base64Data = fileObj.fileDataUrl;
        if (!base64Data) {
          // Fallback fetch/read
          await new Promise(r => setTimeout(r, 500));
          base64Data = fileObj.fileDataUrl;
        }

        if (!base64Data) {
          throw new Error("بيانات الملف غير مكتملة.");
        }

        // Visual Slicing Protocol with Custom Calibration for 100% Accuracy
        let headerSlice = "";
        let mcqSlice = "";
        let tfMatchingSlice = "";
        let activeBase64 = base64Data;

        if (fileObj.mimeType.startsWith("image/")) {
          try {
            const sRotation = fileObj.rotation ?? keyRotation ?? 0;
            const sFineTilt = fileObj.fineTilt ?? keyFineTilt ?? 0;
            const sContrast = fileObj.contrast ?? keyContrast ?? true;
            const sBrightness = fileObj.brightness ?? keyBrightness ?? 1.0;
            const sMcqStart = fileObj.mcqStartY ?? keyMcqStartY ?? 20;
            const sMcqEnd = fileObj.mcqEndY ?? keyMcqEndY ?? 76;
            const sTfStart = fileObj.tfStartY ?? keyTfStartY ?? 72;
            const sTfEnd = fileObj.tfEndY ?? 100;

            activeBase64 = await processImageWithCanvas(
              base64Data,
              fileObj.mimeType,
              sRotation,
              sFineTilt,
              sContrast,
              sBrightness
            );

            headerSlice = await cropImage(activeBase64, fileObj.mimeType, 0, 24);
            mcqSlice = await cropImage(activeBase64, fileObj.mimeType, sMcqStart, sMcqEnd);
            tfMatchingSlice = await cropImage(activeBase64, fileObj.mimeType, sTfStart, sTfEnd);
          } catch (cropErr) {
            console.error("Failed to generate slices for student sheet, using original only", cropErr);
            activeBase64 = base64Data;
          }
        }

        const response = await fetch("/api/grade-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: activeBase64,
            mimeType: fileObj.mimeType,
            answerKey: flatAnswerKey,
            headerSlice,
            mcqSlice,
            tfMatchingSlice
          }),
        });

        let data: any;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const textErr = await response.text();
          throw new Error(`استجابة غير صالحة من الخادم (كود ${response.status}): ${textErr.slice(0, 150)}`);
        }

        if (response.ok) {
          gradedList.push({
            ...data,
            fileName: fileObj.name,
            fileDataUrl: fileObj.fileDataUrl,
            fileMimeType: fileObj.mimeType
          });
          setStudentFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: "success" } : f));
        } else {
          throw new Error(data.error || "خطأ أثناء التصحيح.");
        }
      } catch (err: any) {
        console.error("Grading failed for file:", fileObj.name, err);
        setStudentFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: "error", errorMsg: err.message } : f));
      } finally {
        completedCount++;
        setGradingProgress(Math.round((completedCount / filesToGrade.length) * 100));
      }
    };

    // Run queue with concurrency control and staggering to prevent bursts
    const runGradingPool = async () => {
      const queue = [...filesToGrade];
      const activeWorkers: Promise<void>[] = [];

      while (queue.length > 0) {
        if (activeWorkers.length < CONCURRENCY_LIMIT) {
          const nextFile = queue.shift();
          if (nextFile) {
            const promise = gradeSingleFile(nextFile).then(() => {
              activeWorkers.splice(activeWorkers.indexOf(promise), 1);
            });
            activeWorkers.push(promise);
            // Stagger next requests by 150ms to prevent simultaneous socket bursts
            await new Promise(r => setTimeout(r, 150));
          }
        } else {
          await Promise.race(activeWorkers);
        }
      }
      await Promise.all(activeWorkers);
    };

    await runGradingPool();

    if (gradedList.length > 0) {
      // Sort results alphabetically by student name to make them easy to browse
      gradedList.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", "ar"));
      setResults(gradedList);
      setIsGrading(false);
      setCurrentStep("results");
    } else {
      setIsGrading(false);
      setApiError("عذراً، فشلت عملية التصحيح لجميع أوراق الطلاب المرفوعة. يرجى مراجعة رسائل الخطأ الظاهرة أسفل كل ملف أدناه، وتأكد من إعداد مفتاح GEMINI_API_KEY بشكل صحيح في قسم الإعدادات (Settings > Secrets).");
    }
  };

  // Manual Override: change a student's answer manually on the results view
  const handleStudentAnswerOverride = (studentIdx: number, questionNumber: number, sectionId: string, newAnswer: string) => {
    setResults(prev => prev.map((student, idx) => {
      if (idx !== studentIdx) return student;

      const updatedGradedAnswers = student.gradedAnswers.map(ans => {
        const matchesSection = ans.sectionId ? ans.sectionId === sectionId : true; // fallback
        if (ans.number !== questionNumber || !matchesSection) return ans;

        const isCorrect = newAnswer === ans.correctAnswer;
        const pointsAwarded = isCorrect ? ans.points : 0;

        return {
          ...ans,
          studentAnswer: newAnswer,
          isCorrect,
          pointsAwarded
        };
      });

      const totalPoints = updatedGradedAnswers.reduce((acc, q) => acc + q.points, 0);
      const scorePoints = updatedGradedAnswers.reduce((acc, q) => acc + q.pointsAwarded, 0);
      const percentage = totalPoints > 0 ? Math.round((scorePoints / totalPoints) * 100) : 0;
      const correctCount = updatedGradedAnswers.filter(q => q.isCorrect).length;

      return {
        ...student,
        correctCount,
        scorePoints,
        percentage,
        gradedAnswers: updatedGradedAnswers
      };
    }));
  };

  // Calculate Overall Statistics
  const getStats = () => {
    if (results.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0, passRate: 0 };
    
    const total = results.length;
    const scores = results.map(r => r.percentage);
    const average = Math.round(scores.reduce((acc, s) => acc + s, 0) / total);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    
    // Pass count (score >= 60%)
    const passed = results.filter(r => r.percentage >= 60).length;
    const passRate = Math.round((passed / total) * 100);

    return { total, average, highest, lowest, passRate };
  };

  // Analyze question correctness rate to show difficulty index per question
  const getQuestionAnalytics = () => {
    const flatAnswers = results.flatMap(r => r.gradedAnswers);
    const questionNumbers = Array.from(new Set(flatAnswers.map(a => a.number))).sort((a: number, b: number) => a - b);
    
    return questionNumbers.map(num => {
      const attempts = flatAnswers.filter(a => a.number === num);
      const correct = attempts.filter(a => a.isCorrect).length;
      const rate = attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0;
      return { number: num, correctRate: rate };
    });
  };

  const stats = getStats();
  const questionAnalytics = getQuestionAnalytics();

  // Filter students based on search
  const filteredResults = results.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentId.includes(searchQuery)
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-800 font-sans overflow-hidden" dir="rtl">
      
      {/* Upper Navigation/Header (High Density Theme) */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="text-md font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            نظام المصحح الذكي | <span className="text-indigo-600 font-mono text-sm">SmartGrader AI</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => setShowSheetGenerator(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-1.5 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            توليد أوراق إجابة للطباعة
          </button>

          <button
            onClick={loadDemoTemplate}
            className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${isDemoMode ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            تعبئة النموذج التجريبي
          </button>

          <span className="h-4 w-px bg-slate-200"></span>

          <span className="text-xs text-slate-500 font-medium">أ. أحمد العمودي</span>
          <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700">
            أع
          </div>
        </div>
      </header>

      {/* API Warning/Status Banner */}
      {apiError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-6 py-2.5 text-xs flex items-center gap-2 print:hidden shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="flex-1">{apiError}</p>
          <button 
            onClick={() => {
              setIsDemoMode(true);
              setApiError(null);
            }} 
            className="underline font-bold hover:text-amber-950 shrink-0"
          >
            تنشيط وضع المحاكاة السريعة التجريبية لتجربة فورية ممتعة
          </button>
        </div>
      )}

      {/* Workspace Area (High Density dual-sidebar) */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Right Sidebar - Steps (aside 56 width, RTL right side = border-l) */}
        <aside className="w-56 bg-white border-l border-slate-200 flex flex-col p-4 gap-2 shrink-0 print:hidden justify-between">
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">خطوات التصحيح</div>
            
            <button 
              onClick={() => setCurrentStep("key")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg font-medium text-xs text-right transition-colors ${
                currentStep === "key" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                currentStep === "key" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
              }`}>1</span>
              نموذج الإجابة
            </button>

            <button 
              onClick={() => {
                if (sections.length === 0) {
                  alert("الرجاء إعداد نموذج إجابة أولاً!");
                  return;
                }
                setCurrentStep("students");
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg font-medium text-xs text-right transition-colors ${
                currentStep === "students" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                currentStep === "students" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
              }`}>2</span>
              أوراق الطلاب
            </button>

            <button 
              onClick={() => {
                if (results.length === 0) {
                  alert("الرجاء بدء عملية التصحيح لاستعراض النتائج!");
                  return;
                }
                setCurrentStep("results");
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg font-medium text-xs text-right transition-colors ${
                currentStep === "results" 
                  ? "bg-indigo-50 text-indigo-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                currentStep === "results" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
              }`}>3</span>
              النتائج والإحصائيات
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3 text-center">
            <p className="text-[10px] text-slate-400">v2.4.0 الذكاء الاصطناعي نشط</p>
          </div>
        </aside>

        {/* Central Content Column */}
        <section className="flex-1 flex flex-col overflow-hidden">
          
          {/* Dynamic Step Header */}
          <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex flex-col">
              {currentStep === "key" && (
                <>
                  <h2 className="text-md font-extrabold text-slate-900">ضبط نموذج الإجابة (Model Key)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">تم التعرف على {sections.reduce((acc, s) => acc + s.questions.length, 0)} فقرة اختيار من متعدد. يرجى تظليل الأسئلة المطلوبة فقط.</p>
                </>
              )}
              {currentStep === "students" && (
                <>
                  <h2 className="text-md font-extrabold text-slate-900">أوراق الطلاب والرفع</h2>
                  <p className="text-xs text-slate-500 mt-0.5">قم برفع أوراق إجابة الطلاب الممسوحة ضوئياً وتصحيحها بضغطة زر واحدة.</p>
                </>
              )}
              {currentStep === "results" && (
                <>
                  <h2 className="text-md font-extrabold text-slate-900">النتائج والإحصائيات للدرجات</h2>
                  <p className="text-xs text-slate-500 mt-0.5">استعرض كشف الدرجات الكامل، أداء الطلاب، ومؤشر سهولة وصعوبة الأسئلة بدقة.</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {currentStep === "key" && (
                <>
                  <button
                    onClick={loadDemoTemplate}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                    title="تصفير وتجهيز نموذج تجريبي سريع بـ 20 فقرة غير مظللة"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-indigo-650" />
                    مسح النموذج
                  </button>
                  <button 
                    onClick={() => {
                      if (sections.length > 0) {
                        setCurrentStep("students");
                      } else {
                        alert("الرجاء إعداد نموذج إجابة أولاً!");
                      }
                    }} 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    حفظ النموذج
                  </button>
                </>
              )}
              {currentStep === "students" && (
                <>
                  <button 
                    onClick={() => setCurrentStep("key")} 
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    السابق: تعديل النموذج
                  </button>
                  <button 
                    onClick={startCorrection}
                    disabled={isGrading || (studentFiles.length === 0 && !isDemoMode)} 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    {isGrading ? "جاري التصحيح..." : "بدء التصحيح النهائي"}
                  </button>
                </>
              )}
              {currentStep === "results" && (
                <>
                  <button 
                    onClick={() => window.print()} 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    طباعة كشف الدرجات
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Step Main View Scroll Container */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 space-y-6">

            {/* ----------------- STEP 1: ANSWER KEY DESIGNER ----------------- */}
            {currentStep === "key" && (
              <div className="space-y-6">
                
                {/* Merged Guidance & File Upload Zone */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="relative border-2 border-dashed border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-emerald-50/50 hover:border-indigo-400 hover:bg-indigo-50/70 rounded-xl p-4 transition group flex flex-col md:flex-row items-center justify-between gap-4 text-right" dir="rtl">
                    <input 
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleKeyFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      disabled={isAnalyzingKey}
                    />
                    
                    {/* Guidance Section */}
                    <div className="flex items-start gap-2.5 flex-1 select-none">
                      <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-extrabold text-xs text-indigo-950 block">طريقتان لتجهيز نموذج الإجابة (مفتاح التصحيح):</span>
                        <div className="text-[11px] text-slate-600 leading-relaxed space-y-0.5">
                          <p>1️⃣ <strong className="text-slate-800">الرفع الآلي:</strong> اسحب وأسقط نموذج إجابة المعلم المظلل هنا للرفع والتحليل فوراً.</p>
                          <p>2️⃣ <strong className="text-slate-800">التظليل اليدوي:</strong> انقر على الدوائر بالنموذج الإلكتروني التفاعلي بالأسفل مباشرة.</p>
                        </div>
                      </div>
                    </div>

                    {/* Compact vertical divider */}
                    <div className="hidden md:block w-px h-12 bg-indigo-200/50" />

                    {/* File Upload Trigger/Zone */}
                    <div className="flex flex-col items-center justify-center text-center px-4 shrink-0 min-w-[240px] select-none">
                      {isAnalyzingKey ? (
                        <div className="space-y-1.5">
                          <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto" />
                          <p className="text-[11px] font-extrabold text-indigo-800 animate-pulse">{keyUploadStage || "جاري فحص ورقة الإجابة بالذكاء الاصطناعي..."}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <UploadCloud className="h-8 w-8 text-indigo-500 group-hover:text-indigo-600 mx-auto transition" />
                          <p className="text-xs font-bold text-slate-700">اسحب نموذج الإجابة هنا أو تصفح</p>
                          <p className="text-[10px] text-slate-400">يدعم الصور وملفات PDF</p>
                          {keyFileName && (
                            <div className="mt-1 inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-[9px] font-medium">
                              <CheckCircle className="h-3 w-3" />
                              تم تحميل: {keyFileName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {keyFileError && (
                    <div className="bg-red-50 text-red-800 p-3 rounded-lg text-xs mt-3 flex items-center gap-2 border border-red-200">
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                      {keyFileError}
                    </div>
                  )}
                </div>


            {/* Answer Key Grid / Sections Editor */}
            <div>
              {sections.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <FileSpreadsheet className="h-16 w-16 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-600">لم يتم إعداد أي أسئلة لنموذج الإجابة بعد</p>
                  <p className="text-xs mt-1">اضغط على زر النموذج التجريبي، أو قم برفع ورقة إجابة نموذجية، أو أضف أقساماً يدوياً للبدء.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* GORGEOUS OFFICIAL ARABIC STANDARD SHEET */}
                  <div className="bg-[#fcfcfa] text-[#1a1c1e] p-6 border-4 border-double border-slate-800 rounded-2xl shadow-sm relative overflow-hidden" dir="rtl">
                    {/* Watermark background decoration */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.02] flex items-center justify-center">
                      <GraduationCap className="w-96 h-96 text-slate-900" />
                    </div>

                    {/* MoE Official Header Table */}
                    <div className="border border-slate-700 rounded-lg p-4 mb-5 grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-xs font-medium text-slate-800 relative z-10 bg-white/50 backdrop-blur-sm">
                      {/* Right Column: Administration details */}
                      <div className="space-y-1 text-right">
                        <div className="font-extrabold text-slate-900 text-sm">المملكة العربية السعودية</div>
                        <div>وزارة التعليم</div>
                        <div>الإدارة العامة للتعليم بالشرقية</div>
                        <div className="font-semibold">مدرسة أم الحمام الثانوية</div>
                      </div>

                      {/* Center Column: Logo & Subject */}
                      <div className="text-center flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                          <GraduationCap className="h-6 w-6" />
                        </div>
                        <div className="font-extrabold text-sm text-indigo-950">نموذج الإجابة النموذجية الرسمي (للمعلم)</div>
                        <div className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                          مفتاح تصحيح معتمد للمعلم
                        </div>
                      </div>

                      {/* Left Column: Subject & Teacher */}
                      <div className="space-y-1 text-left">
                        <div><span className="font-bold text-slate-900">المادة:</span> علم البيئة أول/1</div>
                        <div><span className="font-bold text-slate-900">معلم المادة:</span> أ. يوسف العبدالعال</div>
                        <div><span className="font-bold text-slate-900">التاريخ:</span> الإثنين 29 / 12 / 1447 هـ</div>
                        <div><span className="font-bold text-slate-900">نوع المستند:</span> <span className="text-emerald-600 font-bold">نموذج الإجابة النموذجية الرئيسي</span></div>
                      </div>
                    </div>

                    {/* Teacher / Exam Key metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 relative z-10 text-xs">
                      {/* Exam Name */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">نوع الاختبار والمرحلة:</div>
                        <div className="font-extrabold text-slate-800 text-[11px]">اختبار نهاية الفصل الدراسي - نظري</div>
                      </div>
                      
                      {/* Supervisor Teacher */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">المعلم معد النموذج:</div>
                        <div className="font-bold text-slate-800">لجنة التقييم والتحكيم المدرسية</div>
                      </div>

                      {/* Active Model Selector */}
                      <div className="bg-white border-2 border-indigo-200 p-3 rounded-xl flex items-center justify-between col-span-1 md:col-span-2">
                        <div>
                          <div className="text-[10px] text-indigo-500 font-bold mb-1">تظليل رمز النموذج النشط لـ مفتاح الإجابة:</div>
                          <div className="font-bold text-slate-800 text-xs">تغيير النموذج النشط للتصحيح</div>
                        </div>
                        <div className="flex gap-1.5">
                          {["A", "B", "C", "D"].map((m) => {
                            const isSelected = activeModelForm === m;
                            const arabicMap: Record<string, string> = { A: "أ", B: "ب", C: "ج", D: "د" };
                            return (
                              <button
                                key={m}
                                onClick={() => setActiveModelForm(m as any)}
                                className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center border transition-all ${
                                  isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-md scale-110 ring-2 ring-indigo-500"
                                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {arabicMap[m]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Instructions Bar */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 mb-6 text-xs text-indigo-900 leading-relaxed relative z-10 flex flex-col md:flex-row items-center gap-3">
                      <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="font-extrabold block mb-0.5">تعليمات ضبط نموذج الإجابة النموذجي الخاص بالمعلم:</span>
                        انقر على الحروف بالأسفل لتظليل وتعديل الإجابات النموذجية الصحيحة مباشرة. سيتم اعتماد هذه التظليلات كمفتاح التصحيح الأساسي لجميع أوراق الطلاب المرفوعة.
                      </div>
                    </div>

                    {/* THE THREE SECTIONS SIDE-BY-SIDE OR STACKED */}
                    <div className="space-y-6 relative z-10">

                      {/* SECTION 1: Multiple Choice Questions (60 Questions) */}
                      <div className="border border-slate-300 rounded-xl bg-white p-4">
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 -mx-4 -mt-4 rounded-t-xl flex items-center justify-between mb-4">
                          <span className="font-extrabold text-xs text-slate-800">السؤال الأول: الاختيار من متعدد</span>
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 rounded-xl shadow-sm text-sm font-extrabold text-red-600">
                            <span className="text-xs md:text-sm">الدرجة لكل فقرة:</span>
                            <div className="flex items-center gap-1 bg-white border border-red-100 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_mcq")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_mcq", Math.max(0, curVal - 0.25));
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="تقليل الدرجة"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={sections.find(s => s.id === "sec_mcq")?.questions[0]?.points ?? 1}
                                onChange={(e) => handleSectionPointsChange("sec_mcq", parseFloat(e.target.value) || 0)}
                                className="w-12 h-6 text-center text-red-700 bg-transparent border-0 font-black text-sm focus:outline-none focus:ring-0 p-0"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_mcq")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_mcq", curVal + 0.25);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="زيادة الدرجة"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {[0, 1, 2, 3].map((colIndex) => {
                            const startNum = colIndex * 15 + 1;
                            return (
                              <div key={colIndex} className="space-y-2 border-r border-slate-200 pr-2 first:border-0 first:pr-0">
                                <table className="w-full text-[10px] text-right">
                                  <tbody>
                                    {Array.from({ length: 15 }, (_, i) => {
                                      const qNum = startNum + i;
                                      const mcqSec = sections.find(s => s.id === "sec_mcq");
                                      const q = mcqSec?.questions.find(item => item.number === qNum);
                                      const activeAns = q?.correctAnswer || "";

                                      return (
                                        <tr key={qNum} className="border-b border-slate-50 hover:bg-slate-50/50">
                                          <td className="py-1.5 font-bold text-slate-700 min-w-[75px]">
                                            <span>فقرة {qNum}</span>
                                          </td>
                                          {["A", "B", "C", "D"].map((opt) => {
                                            const isShaded = activeAns === opt;
                                            return (
                                              <td key={opt} className="py-1.5 text-center">
                                                <div
                                                  onClick={() => toggleBubbleShading("mcq", qNum, opt)}
                                                  className={`w-5.5 h-5.5 rounded-full border mx-auto flex items-center justify-center cursor-pointer text-[9px] font-black transition-all ${
                                                    isShaded
                                                      ? "bg-slate-900 text-white border-slate-900 ring-1 ring-slate-800 scale-105"
                                                      : "bg-white border-slate-300 text-slate-400 hover:border-indigo-500 hover:bg-indigo-50"
                                                  }`}
                                                >
                                                  {opt === "A" ? "أ" : opt === "B" ? "ب" : opt === "C" ? "ج" : "د"}
                                                </div>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION 2: True/False Questions (30 Questions) */}
                      <div className="border border-slate-300 rounded-xl bg-white p-4">
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 -mx-4 -mt-4 rounded-t-xl flex items-center justify-between mb-4">
                          <span className="font-extrabold text-xs text-slate-800">السؤال الثاني: الصواب والخطأ</span>
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 rounded-xl shadow-sm text-sm font-extrabold text-red-600">
                            <span className="text-xs md:text-sm">الدرجة لكل فقرة:</span>
                            <div className="flex items-center gap-1 bg-white border border-red-100 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_tf")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_tf", Math.max(0, curVal - 0.25));
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="تقليل الدرجة"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={sections.find(s => s.id === "sec_tf")?.questions[0]?.points ?? 1}
                                onChange={(e) => handleSectionPointsChange("sec_tf", parseFloat(e.target.value) || 0)}
                                className="w-12 h-6 text-center text-red-700 bg-transparent border-0 font-black text-sm focus:outline-none focus:ring-0 p-0"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_tf")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_tf", curVal + 0.25);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="زيادة الدرجة"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                          {[0, 1, 2, 3, 4, 5].map((colIndex) => {
                            const startNum = colIndex * 5 + 1;
                            return (
                              <div key={colIndex} className="space-y-2 border-r border-slate-200 pr-1.5 first:border-0 first:pr-0">
                                <table className="w-full text-[10px] text-right">
                                  <tbody>
                                    {Array.from({ length: 5 }, (_, i) => {
                                      const visualNum = startNum + i;
                                      const tfSec = sections.find(s => s.id === "sec_tf");
                                      const q = tfSec?.questions.find(item => item.number === visualNum);
                                      const activeAns = q?.correctAnswer || "";

                                      return (
                                        <tr key={visualNum} className="border-b border-slate-50 hover:bg-slate-50/50">
                                          <td className="py-1.5 font-bold text-slate-700 min-w-[75px]">
                                            <span>فقرة {visualNum}</span>
                                          </td>
                                          {["T", "F"].map((opt) => {
                                            const isShaded = activeAns === opt;
                                            return (
                                              <td key={opt} className="py-1.5 text-center">
                                                <div
                                                  onClick={() => toggleBubbleShading("tf", visualNum, opt)}
                                                  className={`w-5.5 h-5.5 rounded-full border mx-auto flex items-center justify-center cursor-pointer text-[9px] font-black transition-all ${
                                                    isShaded
                                                      ? "bg-slate-900 text-white border-slate-900 ring-1 ring-slate-800 scale-105"
                                                      : "bg-white border-slate-300 text-slate-400 hover:border-indigo-500 hover:bg-indigo-50"
                                                  }`}
                                                >
                                                  {opt === "T" ? "ص" : "خ"}
                                                </div>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION 3: Matching Questions (10 Questions) */}
                      <div className="border border-slate-300 rounded-xl bg-white p-4">
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 -mx-4 -mt-4 rounded-t-xl flex items-center justify-between mb-4">
                          <span className="font-extrabold text-xs text-slate-800">السؤال الثالث: المزاوجة والربط</span>
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1 rounded-xl shadow-sm text-sm font-extrabold text-red-600">
                            <span className="text-xs md:text-sm">الدرجة لكل فقرة:</span>
                            <div className="flex items-center gap-1 bg-white border border-red-100 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_matching")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_matching", Math.max(0, curVal - 0.25));
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="تقليل الدرجة"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={sections.find(s => s.id === "sec_matching")?.questions[0]?.points ?? 1}
                                onChange={(e) => handleSectionPointsChange("sec_matching", parseFloat(e.target.value) || 0)}
                                className="w-12 h-6 text-center text-red-700 bg-transparent border-0 font-black text-sm focus:outline-none focus:ring-0 p-0"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const curVal = sections.find(s => s.id === "sec_matching")?.questions[0]?.points ?? 1;
                                  handleSectionPointsChange("sec_matching", curVal + 0.25);
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-100 text-red-600 active:scale-90 font-bold text-base transition-all select-none cursor-pointer"
                                title="زيادة الدرجة"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {[0, 1].map((colIndex) => {
                            const startNum = colIndex * 5 + 1;
                            return (
                              <div key={colIndex} className="space-y-2 border-r border-slate-200 pr-3 first:border-0 first:pr-0">
                                <table className="w-full text-[10px] text-right">
                                  <tbody>
                                    {Array.from({ length: 5 }, (_, i) => {
                                      const visualNum = startNum + i;
                                      const matchingSec = sections.find(s => s.id === "sec_matching");
                                      const q = matchingSec?.questions.find(item => item.number === visualNum);
                                      const activeAns = q?.correctAnswer || "";

                                      const options = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
                                      const arabicLetters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"];

                                      return (
                                        <tr key={visualNum} className="border-b border-slate-50 hover:bg-slate-50/50">
                                          <td className="py-2 font-bold text-slate-700 min-w-[75px]">
                                            <span>فقرة {visualNum}</span>
                                          </td>
                                          {options.map((opt, oIdx) => {
                                            const isShaded = activeAns === opt;
                                            return (
                                              <td key={opt} className="py-2 text-center">
                                                <div
                                                  onClick={() => toggleBubbleShading("matching", visualNum, opt)}
                                                  className={`w-5.5 h-5.5 rounded-full border mx-auto flex items-center justify-center cursor-pointer text-[9px] font-black transition-all ${
                                                    isShaded
                                                      ? "bg-slate-900 text-white border-slate-900 ring-1 ring-slate-800 scale-105"
                                                      : "bg-white border-slate-300 text-slate-400 hover:border-indigo-500 hover:bg-indigo-50"
                                                  }`}
                                                >
                                                  {arabicLetters[oIdx]}
                                                </div>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Navigation button to Step 2 */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setCurrentStep("students")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center gap-2 transition w-full sm:w-auto justify-center"
                    >
                      الانتقال لرفع أوراق إجابات الطلاب ({studentFiles.length})
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                  </div>
                </div>
              )}
              {/* Deactivated list view mode editor block */}
              {false && (
                <div className={keyFileBase64 ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "space-y-6"}>
                  {/* Right Column: Sections Editor */}
                  <div className={keyFileBase64 ? "lg:col-span-6 space-y-6" : "space-y-6"}>
                    {sections.map((sec) => (
                  <div key={sec.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    
                    {/* Section Header */}
                    <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-mono">
                          {sec.type === "mcq" ? "اختيار من متعدد (أ ب ج د)" : sec.type === "matching" ? "مزاوجة ومطابقة (10 خيارات)" : "صح أم خطأ"}
                        </span>
                        <input
                          type="text"
                          value={sec.name || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSections(prev => prev.map(s => s.id === sec.id ? { ...s, name: val } : s));
                          }}
                          className="bg-transparent border-b border-transparent hover:border-slate-500 focus:border-white focus:outline-none font-bold text-md px-1 py-0.5 w-64 text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => addQuestionToSection(sec.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          إضافة فقرة
                        </button>
                        <button
                          onClick={() => deleteSection(sec.id)}
                          className="text-red-400 hover:text-red-300 p-1.5 hover:bg-slate-800 rounded-lg transition"
                          title="حذف القسم بالكامل"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Section Questions Items Grid */}
                    <div className="p-6">
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-800 mb-5 leading-relaxed">
                        ⚠️ <strong>ملاحظة التظليل والتحكم المتقدم:</strong> 
                        الفقرات المعروضة أدناه هي الفقرات المعتمدة كإجابات صحيحة. 
                        إذا كان النموذج المطبوع يحتوي على 60 فقرة مثلاً لكنك قمت بتظليل 10 فقرات فقط، 
                        سيقوم الذكاء الاصطناعي تلقائياً باعتماد أول 10 فقرات وتجاهل البقية كما حددت بالنموذج. يمكنك تفعيل/تجاهل أو تعديل الإجابات والدرجات مباشرة بالأسفل.
                      </div>

                      <div className="flex flex-col gap-2.5">
                        {sec.questions.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                            لا توجد فقرات في هذا القسم حالياً. اضغط على "إضافة فقرة" بالأعلى للبدء.
                          </div>
                        ) : (
                          sec.questions.map((question) => {
                            const idxNum = question.number;
                            return (
                              <div 
                                key={idxNum}
                                className="border border-indigo-100 bg-white rounded-xl px-5 py-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 hover:shadow-sm"
                              >
                                <div className="flex items-center gap-4">
                                  <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center font-mono">
                                    {idxNum}
                                  </span>
                                  <span className="font-bold text-slate-800 text-sm">الفقرة {idxNum}</span>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                  {/* Answer Options representing physical bubbles */}
                                  <div className="flex gap-2.5 justify-center">
                                    {sec.type === "mcq" ? (
                                      ["A", "B", "C", "D"].map((opt, oIdx) => {
                                        const letters = ["أ", "ب", "ج", "د"];
                                        const isSelected = question.correctAnswer === opt;
                                        return (
                                          <button
                                            key={opt}
                                            onClick={() => handleAnswerKeyChange(sec.id, idxNum, opt)}
                                            className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all border-2 ${
                                              isSelected 
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105" 
                                                : "bg-white border-slate-300 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300"
                                            }`}
                                            title={`تحديد الإجابة الصحيحة كـ ${letters[oIdx]}`}
                                          >
                                            {letters[oIdx]}
                                          </button>
                                        );
                                      })
                                    ) : sec.type === "matching" ? (
                                      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((opt, oIdx) => {
                                        const letters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"];
                                        const isSelected = question.correctAnswer === opt;
                                        return (
                                          <button
                                            key={opt}
                                            onClick={() => handleAnswerKeyChange(sec.id, idxNum, opt)}
                                            className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all border-2 ${
                                              isSelected 
                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 scale-105" 
                                                : "bg-white border-slate-300 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300"
                                            }`}
                                            title={`تحديد الإجابة الصحيحة كـ ${letters[oIdx]}`}
                                          >
                                            {letters[oIdx]}
                                          </button>
                                        );
                                      })
                                    ) : (
                                      ["T", "F"].map((opt) => {
                                        const isSelected = question.correctAnswer === opt;
                                        return (
                                          <button
                                            key={opt}
                                            onClick={() => handleAnswerKeyChange(sec.id, idxNum, opt)}
                                            className={`px-4 py-1.5 rounded-full font-bold text-xs flex items-center justify-center transition-all border-2 ${
                                              isSelected 
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 scale-105" 
                                                : "bg-white border-slate-300 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300"
                                            }`}
                                          >
                                            {opt === "T" ? "صح" : "خطأ"}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>

                                  <span className="hidden sm:block h-6 w-px bg-slate-200"></span>

                                  {/* Points weight input */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-400 font-medium">الدرجة:</span>
                                    <input 
                                      type="number"
                                      step="0.5"
                                      min="0.5"
                                      value={question.points !== undefined && question.points !== null ? question.points : ""}
                                      onChange={(e) => handlePointsChange(sec.id, idxNum, parseFloat(e.target.value) || 1)}
                                      className="w-12 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-center text-xs text-slate-700 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>

                                  <span className="hidden sm:block h-6 w-px bg-slate-200"></span>

                                  {/* Ignore/delete button */}
                                  <button
                                    onClick={() => toggleQuestionActive(sec.id, idxNum)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                    title="حذف هذه الفقرة"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Navigation button to Step 2 */}
                {sections.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setCurrentStep("students")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center gap-2 transition w-full sm:w-auto justify-center"
                    >
                      الانتقال لرفع أوراق إجابات الطلاب ({studentFiles.length})
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                  </div>
                )}
              </div>

              {/* Left Column: Teacher's Scanned Sheet / Image Preview */}
              {keyFileBase64 && (
                <div className="lg:col-span-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-6 flex flex-col gap-4" dir="rtl">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
                      <div className="flex items-center gap-2">
                        <Sliders className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                        <span className="font-extrabold text-xs text-slate-800">معايرة ومحاذاة ورقة الإجابة</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">نموذج المعلم</span>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col justify-center items-center bg-slate-100/50 rounded-xl border border-slate-100 p-2 min-h-[380px] relative">
                      {keyFileMimeType && keyFileMimeType.toLowerCase().includes("pdf") ? (
                        <PdfPreviewer
                          base64={keyFileBase64}
                          blobUrl={keyFileBlobUrl}
                          mimeType={keyFileMimeType}
                          fileName={keyFileName}
                          heightClass="h-full w-full"
                        />
                      ) : (
                        <div className="relative group max-w-full h-full flex items-center justify-center overflow-auto p-1">
                          <div className="relative max-h-full max-w-full">
                            <img
                              src={showProcessedView ? (processedKeyBlobUrl || `data:${keyFileMimeType || "image/png"};base64,${processedKeyBase64 || keyFileBase64}`) : (keyFileBlobUrl || `data:${keyFileMimeType || "image/png"};base64,${keyFileBase64}`)}
                              alt="نموذج إجابة المعلم المرفوع"
                              className="max-h-[350px] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 transition"
                            />
                            
                            {/* Crop Guides Overlay */}
                            {showCropGuides && (
                              <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                                {/* MCQ guide band */}
                                <div 
                                  className="absolute left-0 right-0 bg-emerald-500/15 border-y-2 border-emerald-500 flex items-center justify-center"
                                  style={{ top: `${keyMcqStartY}%`, bottom: `${100 - keyMcqEndY}%` }}
                                >
                                  <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                    نطاق الاختيار من متعدد ({keyMcqStartY}% - {keyMcqEndY}%)
                                  </span>
                                </div>

                                {/* T/F & Matching guide band */}
                                <div 
                                  className="absolute left-0 right-0 bg-blue-500/15 border-y-2 border-blue-500 flex items-center justify-center"
                                  style={{ top: `${keyTfStartY}%`, bottom: `${100 - keyTfEndY}%` }}
                                >
                                  <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                    نطاق الصح والخطأ والمزاوجة ({keyTfStartY}% - {keyTfEndY}%)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Calibration controls */}
                    {!keyFileMimeType.toLowerCase().includes("pdf") && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3 shrink-0 text-right">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                            المعايرة التلقائية والفلاتر الذكية (OMR Filters)
                          </span>
                          <button
                            onClick={() => setShowCropGuides(!showCropGuides)}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition ${
                              showCropGuides ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {showCropGuides ? "إخفاء خطوط الاقتطاع" : "عرض خطوط الاقتطاع"}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Tab switcher */}
                          <div className="col-span-2 flex bg-slate-200 p-1 rounded-lg">
                            <button
                              onClick={() => setShowProcessedView(false)}
                              className={`flex-1 text-center py-1 rounded text-[10px] font-bold transition ${
                                !showProcessedView ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
                              }`}
                            >
                              الصورة الأصلية
                            </button>
                            <button
                              onClick={() => setShowProcessedView(true)}
                              className={`flex-1 text-center py-1 rounded text-[10px] font-bold transition ${
                                showProcessedView ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
                              }`}
                            >
                              تصفية التظليل (OMR Mode)
                            </button>
                          </div>

                          {/* Rotation */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500">تدوير الصورة:</label>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setKeyRotation(prev => (prev + 270) % 360)}
                                className="bg-white border border-slate-300 text-slate-700 p-1 rounded-lg text-xs hover:bg-slate-50 flex-1 flex justify-center items-center"
                                title="تدوير يسار 90 درجة"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setKeyRotation(prev => (prev + 90) % 360)}
                                className="bg-white border border-slate-300 text-slate-700 p-1 rounded-lg text-xs hover:bg-slate-50 flex-1 flex justify-center items-center"
                                title="تدوير يمين 90 درجة"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Fine Tilt Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span>محاذاة الميلان الدقيق:</span>
                              <span className="font-mono text-indigo-600">{keyFineTilt}°</span>
                            </div>
                            <input
                              type="range"
                              min="-15"
                              max="15"
                              step="0.5"
                              value={keyFineTilt}
                              onChange={(e) => setKeyFineTilt(parseFloat(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                            />
                          </div>

                          {/* MCQ Range Slider */}
                          <div className="col-span-2 space-y-1 bg-white p-2 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                              <span>نطاق قص الاختيار من متعدد:</span>
                              <span className="font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                                {keyMcqStartY}% إلى {keyMcqEndY}%
                              </span>
                            </div>
                            <div className="flex gap-4 items-center">
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-[8px] text-slate-400">
                                  <span>بداية النطاق: {keyMcqStartY}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="50"
                                  value={keyMcqStartY}
                                  onChange={(e) => setKeyMcqStartY(parseInt(e.target.value))}
                                  className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-[8px] text-slate-400">
                                  <span>نهاية النطاق: {keyMcqEndY}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="50"
                                  max="100"
                                  value={keyMcqEndY}
                                  onChange={(e) => setKeyMcqEndY(parseInt(e.target.value))}
                                  className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* T/F Range Slider */}
                          <div className="col-span-2 space-y-1 bg-white p-2 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                              <span>نطاق قص الصح والخطأ والمزاوجة:</span>
                              <span className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">
                                {keyTfStartY}% إلى {keyTfEndY}%
                              </span>
                            </div>
                            <div className="flex gap-4 items-center">
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-[8px] text-slate-400">
                                  <span>بداية النطاق: {keyTfStartY}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="50"
                                  max="85"
                                  value={keyTfStartY}
                                  onChange={(e) => setKeyTfStartY(parseInt(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-[8px] text-slate-400">
                                  <span>نهاية النطاق: {keyTfEndY}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="75"
                                  max="100"
                                  value={keyTfEndY}
                                  onChange={(e) => setKeyTfEndY(parseInt(e.target.value))}
                                  className="w-full accent-blue-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2 pt-1 flex gap-2">
                            <button
                              onClick={reAnalyzeKeyWithCalibration}
                              disabled={isAnalyzingKey || isProcessingKeyCanvas}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                            >
                              {isAnalyzingKey ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  جاري المعالجة والتحليل...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 text-amber-350" />
                                  البدء بالمعالجة والتحليل الذكي
                                </>
                              )}
                            </button>
                            <button
                              onClick={resetKeyCalibration}
                              className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition flex items-center justify-center"
                              title="إعادة تعيين الافتراضيات"
                            >
                              إعادة ضبط
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Open External / Download option */}
                    <div className="flex gap-2 justify-center pt-2 border-t border-slate-100 mt-1 shrink-0">
                      <a
                        href={keyFileBlobUrl || `data:${keyFileMimeType || "application/pdf"};base64,${keyFileBase64}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-200 shadow-xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        عرض الصورة الأصلية كاملة
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

          </div>
        )}

        {/* ----------------- STEP 2: STUDENT FILES UPLOADER ----------------- */}
        {currentStep === "students" && (
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-extrabold text-lg text-slate-900 mb-2">الخطوة الثانية: تحميل أوراق أوراق إجابات الطلاب</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                ارفع صوراً أو ملفات PDF ممسوحة ضوئياً لأوراق إجابات الطلاب. يمكنك تحميل عدة ملفات معاً، وسيتم تجميعها وفحصها وتصحيحها بناءً على نموذج الإجابة النموذجي النشط بالخطوة السابقة.
              </p>

              {/* Upload Drag & Drop Zone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/10 rounded-2xl p-10 transition flex flex-col items-center justify-center text-center relative group">
                <input 
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleStudentFilesUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isGrading}
                />
                <div className="space-y-3">
                  <UploadCloud className="h-14 w-14 text-slate-400 group-hover:text-emerald-600 mx-auto transition" />
                  <p className="text-md font-bold text-slate-700">اسحب أوراق الطلاب المظللة هنا أو اضغط للتصفح</p>
                  <p className="text-xs text-slate-400">يدعم رفع ملفات متعددة (صور أو PDF) لجميع الطلاب دفعة واحدة</p>
                </div>
              </div>

              {/* Upload Statistics and Controls */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-500" />
                    عدد أوراق الطلاب المحملة: 
                    <span className="text-emerald-700 text-sm font-extrabold">{studentFiles.length}</span>
                  </div>
                  {isDemoMode && (
                    <div className="bg-amber-100 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold">
                      نشط حالياً: نموذج محاكاة تجريبي
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep("key")}
                    className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-5 py-3 rounded-xl font-medium text-xs transition"
                  >
                    الرجوع لتعديل نموذج الإجابة
                  </button>
                  <button
                    onClick={startCorrection}
                    disabled={isGrading || (studentFiles.length === 0 && !isDemoMode)}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 transition"
                  >
                    {isGrading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        جاري التصحيح...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" />
                        البدء في تصحيح الأوراق
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>

            {/* Uploaded Files Table list */}
            {studentFiles.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    قائمة ملفات الطلاب المرفوعة ({studentFiles.length} ملف)
                  </h3>
                  <button
                    onClick={() => {
                      setStudentFiles([]);
                      setResults([]);
                      setSelectedStudentIndex(null);
                      setAuditedStudentIds([]);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                  >
                    تفريغ القائمة
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                  {studentFiles.map((file) => (
                    <div key={file.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{file.name}</p>
                          <span className="text-[10px] text-slate-400">{file.size} • {file.mimeType.split('/')[1]?.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          file.status === "success" ? "bg-emerald-100 text-emerald-800" :
                          file.status === "processing" ? "bg-blue-100 text-blue-800 animate-pulse" :
                          file.status === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {file.status === "success" ? "تم التصحيح بنجاح" :
                           file.status === "processing" ? "جاري المعالجة بالذكاء الاصطناعي..." :
                           file.status === "error" ? `فشل: ${file.errorMsg || "خطأ مجهول"}` : "جاهز للبدء"}
                        </span>

                        {!file.mimeType.toLowerCase().includes("pdf") && (
                          <button
                            onClick={() => openStudentCalibration(file.id)}
                            className="text-slate-500 hover:text-indigo-650 p-1.5 rounded hover:bg-slate-100 transition flex items-center gap-1.5 border border-slate-200 bg-white"
                            title="معايرة وتصحيح ميلان تظليل الورقة"
                          >
                            <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                            <span className="text-[9px] font-extrabold hidden sm:inline">معايرة الورقة</span>
                          </button>
                        )}

                        <button
                          onClick={() => deleteStudentFile(file.id)}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-slate-100 transition"
                          title="حذف الملف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Grading Loader Panel */}
            {isGrading && (
              <div className="bg-slate-900 text-white rounded-2xl p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-600/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-900/90 to-slate-900"></div>
                <div className="relative space-y-4">
                  <RefreshCw className="h-12 w-12 text-emerald-500 animate-spin mx-auto" />
                  <h3 className="text-lg font-bold">جاري تصحيح أوراق أوراق الإجابة بالذكاء الاصطناعي...</h3>
                  <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                    نقوم الآن بتحليل ورقة الطالب ومقارنة فقرات التظليل بدقة فائقة واستخراج الاسم والرقم الأكاديمي وتصحيح الدرجات تلقائياً.
                  </p>

                  <div className="max-w-xl mx-auto space-y-2 pt-4">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>الملف الحالي: <span className="text-white font-bold">{currentGradingFile}</span></span>
                      <span>{gradingProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${gradingProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ----------------- STEP 3: RESULTS DASHBOARD ----------------- */}
        {currentStep === "results" && (
          <div className="space-y-6">
            
            {/* Header & Main Actions Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4" dir="rtl">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-emerald-600 h-5 w-5" />
                  لوحة نتائج وتدقيق اختبار الطلاب ({results.length})
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  تستطيع الآن استعراض نتائج جميع الطلاب، والتحقق البصري المزدوج ومقارنتها بالورقة الأصلية، بالإضافة إلى إمكانية تصديرها أو طباعتها.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <button 
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm active:scale-98"
                >
                  <Printer className="h-4 w-4" />
                  طباعة كشف الدرجات الرسمي
                </button>
                <button 
                  onClick={() => {
                    setStudentFiles([]);
                    setResults([]);
                    setSelectedStudentIndex(null);
                    setAuditedStudentIds([]);
                    setCurrentStep("key");
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition active:scale-98"
                >
                  تصحيح اختبار جديد
                </button>
              </div>
            </div>

            {/* Students Selection Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4" dir="rtl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black text-slate-800">تصفح واختيار الطالب للمقارنة والتدقيق:</span>
                </div>
                
                {/* Search input */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute right-3 top-2.5 text-slate-400 h-4 w-4" />
                  <input 
                    type="text"
                    placeholder="ابحث عن اسم الطالب أو الرقم الأكاديمي..."
                    value={searchQuery || ""}
                    onChange={(e) => setSearchQuery(e.e?.target ? e.target.value : e)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right font-medium"
                  />
                </div>
              </div>

              {/* Horizontal Scrollable list of student cards */}
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {filteredResults.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs w-full">
                    لا يوجد طلاب يطابقون معايير البحث الحالية.
                  </div>
                ) : (
                  filteredResults.map((student) => {
                    const originalIdx = results.findIndex(r => r.studentId === student.studentId);
                    const isSelected = selectedStudentIndex === originalIdx;
                    const hasPassed = student.percentage >= 60;

                    return (
                      <div 
                        key={student.studentId}
                        onClick={() => setSelectedStudentIndex(originalIdx)}
                        className={`min-w-[190px] sm:min-w-[230px] p-3.5 cursor-pointer hover:bg-slate-50 rounded-xl transition-all border shrink-0 text-right ${
                          isSelected 
                            ? "bg-emerald-50/50 border-emerald-500 shadow-sm ring-1 ring-emerald-400" 
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="text-xs font-black text-slate-800 truncate max-w-[120px] sm:max-w-[150px]" title={student.studentName}>
                              {student.studentName}
                            </h4>
                            {auditedStudentIds.includes(student.studentId) ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full" title="تم التدقيق وتأكيد صحة النتيجة">
                                مدقق
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded-full" title="بانتظار المراجعة البصرية">
                                غير مؤكد
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">الرقم: {student.studentId}</p>
                          
                          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 mt-1">
                            <span className="text-[10px] text-slate-400 font-bold">النتيجة:</span>
                            <span className={`text-xs font-black font-mono ${hasPassed ? "text-emerald-600" : "text-red-500"}`}>
                              {student.scorePoints}/{student.totalPoints} ({student.percentage}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Student grading detail viewer / Editor */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm w-full flex flex-col min-h-[720px]">
              {selectedStudentIndex === null ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/30">
                  <FileSpreadsheet className="h-16 w-16 text-slate-300 mb-3 animate-bounce" />
                  <p className="font-extrabold text-slate-700 text-sm">يرجى اختيار طالب من القائمة العلوية لعرض وتدقيق إجابته</p>
                  <p className="text-xs text-slate-400 mt-1.5">يمكنك مقارنة تظليل ورقة الطالب مباشرة ببيانات التعرف الآلي وتعديل الدرجات يدوياً.</p>
                </div>
              ) : (
                (() => {
                  const student = results[selectedStudentIndex];
                  if (!student) return null;

                    return (
                      <div className="flex-1 flex flex-col overflow-hidden h-full">
                        
                        {/* Student Detail Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <h3 className="font-bold text-sm text-slate-900">{student.studentName}</h3>
                            <div className="flex gap-4 text-[10px] text-slate-500">
                              <span>الرقم الأكاديمي: <strong className="text-slate-700 font-mono">{student.studentId}</strong></span>
                              <span>الملف المرفوع: <strong className="text-slate-700">{student.fileName || "غير متوفر"}</strong></span>
                            </div>
                          </div>

                          {/* Grading Audit Status Control */}
                          <div className="flex items-center gap-3">
                            {auditedStudentIds.includes(student.studentId) ? (
                              <button
                                onClick={() => setAuditedStudentIds(prev => prev.filter(id => id !== student.studentId))}
                                className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs hover:bg-emerald-100"
                                title="إلغاء التدقيق"
                              >
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                <span>تم التدقيق وتأكيد صحة النتيجة</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setAuditedStudentIds(prev => [...prev, student.studentId])}
                                className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs animate-bounce"
                                title="اضغط لتأكيد مراجعة هذه النتيجة وتدقيقها بصرياً"
                              >
                                <ShieldCheck className="h-4 w-4 text-amber-600" />
                                <span>بانتظار التأكيد والاعتماد البصري</span>
                              </button>
                            )}
                          </div>

                          <div className="text-left bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الدرجة النهائية</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-extrabold text-emerald-600 font-mono">{student.scorePoints}</span>
                              <span className="text-slate-400 text-xs font-mono">/ {student.totalPoints}</span>
                              <span className="text-xs text-slate-500 font-bold">({student.percentage}%)</span>
                            </div>
                          </div>
                        </div>

                        {/* Tab Selector */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50 px-5 shrink-0 select-none">
                          <button
                            onClick={() => setDetailTab("list")}
                            className={`py-3 px-4 text-xs font-bold border-b-2 transition ${
                              detailTab === "list"
                                ? "border-emerald-600 text-emerald-700 font-extrabold"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            قائمة تفصيلية بالدرجات
                          </button>
                          <button
                            onClick={() => setDetailTab("compare")}
                            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                              detailTab === "compare"
                                ? "border-emerald-600 text-emerald-700 font-extrabold"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            مطابقة التظليل والتعرف الآلي (مقارنة بصرية)
                          </button>
                        </div>

                        {detailTab === "compare" ? (
                          <div className="flex-1 overflow-y-auto p-5 flex flex-col space-y-6 bg-slate-50/30">
                            <div className="flex justify-between items-center shrink-0" dir="rtl">
                              <h3 className="text-xs font-black text-slate-800">مطابقة الورقة الأصلية بالتصحيح التلقائي</h3>
                              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                                يمكنك النقر مباشرة على أي دائرة لتعديل وتصحيح التظليل يدوياً إذا تطلب الأمر!
                              </span>
                            </div>

                            {/* Two Column Grid for Side-by-Side Comparison */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" dir="rtl">
                              
                              {/* Right Column (First in Arabic flow): Scanned Original Image */}
                              <div className="flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm w-full">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 shrink-0 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-400">الورقة الأصلية المرفوعة</span>
                                  <span className="text-xs font-extrabold text-slate-700">المستند الممسوح ضوئياً</span>
                                </div>
                                <div className="p-4 flex flex-col items-center justify-center bg-slate-100/50 min-h-[500px]">
                                  {student.fileDataUrl ? (
                                    <div className="flex flex-col items-center justify-center w-full space-y-4">
                                      <div className="relative group max-w-full w-full flex justify-center items-center">
                                        {student.fileMimeType && student.fileMimeType.toLowerCase().includes("pdf") ? (
                                          <PdfPreviewer
                                            base64={student.fileDataUrl}
                                            blobUrl={activeFileBlobUrl}
                                            mimeType={student.fileMimeType}
                                            fileName={student.fileName}
                                            heightClass="h-[600px]"
                                          />
                                        ) : (
                                          <div className="relative group max-w-full w-full flex justify-center">
                                            <img
                                              src={activeFileBlobUrl || `data:${student.fileMimeType || "image/png"};base64,${student.fileDataUrl}`}
                                              alt="ورقة إجابة الطالب المرفوعة"
                                              className="max-h-[650px] w-full max-w-3xl object-contain rounded shadow-md border border-slate-200"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold pointer-events-none rounded">
                                              معاينة الورقة الأصلية المظللة
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Action buttons to open or download the original file */}
                                      <div className="flex gap-2 w-full justify-center pt-3 border-t border-slate-200/60 shrink-0">
                                        <a
                                          href={activeFileBlobUrl || `data:${student.fileMimeType || "application/pdf"};base64,${student.fileDataUrl}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-200 shadow-xs"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                          فتح المستند في نافذة كاملة
                                        </a>
                                        <a
                                          href={activeFileBlobUrl || `data:${student.fileMimeType || "application/octet-stream"};base64,${student.fileDataUrl}`}
                                          download={student.fileName || "ورقة_الطالب.pdf"}
                                          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-200 shadow-xs"
                                        >
                                          <Download className="h-3.5 w-3.5 text-slate-500" />
                                          تحميل المستند الأصلي
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center p-6 text-slate-400 space-y-4 max-w-xs">
                                      <FileText className="h-12 w-12 mx-auto text-slate-300" />
                                      <p className="font-semibold text-xs text-slate-600">ورقة تظليل افتراضية (وضع المحاكاة)</p>
                                      <p className="text-[10px] text-slate-400">
                                        في التشغيل الفعلي، ستظهر هنا صورة الورقة المرفوعة (PNG, JPEG, PDF) التي تم تصحيحها بالذكاء الاصطناعي لمقارنتها بالتعرف الآلي.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Left Column (Second in Arabic flow): Graded answers list (with interactive bubbles) */}
                              <div className="flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm w-full">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-emerald-600">تم التعرف على {student.gradedAnswers.filter(a => a.studentAnswer).length} إجابة</span>
                                  <span className="text-xs font-extrabold text-slate-700">نتائج تصحيح تظليل الطالب</span>
                                </div>
                                <div className="p-4 space-y-5 max-h-[750px] overflow-y-auto">
                                  {sections.map((sec) => {
                                    const secQuestionNums = sec.questions.map(q => q.number);
                                    const secAnswers = student.gradedAnswers.filter(ans => {
                                      if (ans.sectionId) return ans.sectionId === sec.id;
                                      return secQuestionNums.includes(ans.number);
                                    });
                                    
                                    if (secAnswers.length === 0) return null;

                                    return (
                                      <div key={sec.id} className="space-y-3 border border-slate-100 p-4 rounded-xl bg-slate-50/40 text-right" dir="rtl">
                                        <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                                          <span className="font-extrabold text-[12px] text-slate-800">{sec.name}</span>
                                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded font-bold">
                                            {sec.type === "mcq" ? "اختيار" : sec.type === "matching" ? "مزاوجة" : "صح/خطأ"}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          {secAnswers.map((ans) => {
                                            const sectionType = sec.type;
                                            const options = sectionType === "mcq" ? ["A", "B", "C", "D"] : sectionType === "matching" ? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] : ["T", "F"];
                                            const getArabicLetter = (o: string) => {
                                              if (sectionType === "tf") {
                                                return o === "T" ? "صح" : "خطأ";
                                              }
                                              const mapping: Record<string, string> = {
                                                "A": "أ", "B": "ب", "C": "ج", "D": "د", "E": "هـ", "F": "و", "G": "ز", "H": "ح", "I": "ط", "J": "ي"
                                              };
                                              return mapping[o] || o;
                                            };

                                            return (
                                              <div key={ans.number} className="flex items-center justify-between text-xs p-2.5 border border-slate-100 rounded-xl bg-white shadow-xs">
                                                <span className="font-bold text-slate-700 w-11 shrink-0">فقرة {ans.number}:</span>
                                                
                                                <div className="flex gap-1 items-center justify-center flex-1">
                                                  {options.map((opt) => {
                                                    const isStudentChoice = ans.studentAnswer === opt;
                                                    const isCorrectChoice = ans.correctAnswer === opt;

                                                    let bubbleStyle = "border-slate-300 text-slate-400 hover:bg-slate-50";
                                                    if (isStudentChoice) {
                                                      bubbleStyle = ans.isCorrect
                                                        ? "bg-emerald-600 border-emerald-600 text-white font-extrabold ring-2 ring-emerald-200"
                                                        : "bg-red-500 border-red-500 text-white font-extrabold ring-2 ring-red-200";
                                                    } else if (isCorrectChoice) {
                                                      bubbleStyle = "border-2 border-dashed border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold";
                                                    }

                                                    return (
                                                      <button
                                                        key={opt}
                                                        onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, opt)}
                                                        className={`w-5.5 h-5.5 rounded-full text-[9px] flex items-center justify-center border transition-all ${bubbleStyle}`}
                                                        title={`تعديل إجابة الطالب للفقرة ${ans.number} لتكون ${getArabicLetter(opt)}`}
                                                      >
                                                        {getArabicLetter(opt)}
                                                      </button>
                                                    );
                                                  })}

                                                  <button
                                                    onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, "")}
                                                    className={`text-[8px] px-1 py-0.5 rounded transition border ${
                                                      ans.studentAnswer === ""
                                                        ? "bg-slate-700 border-slate-700 text-white"
                                                        : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200"
                                                    }`}
                                                    title="ترك السؤال غير مجاب"
                                                  >
                                                    فارغ
                                                  </button>
                                                </div>

                                                <div className="w-11 text-left shrink-0">
                                                  <span className={`text-[10px] font-mono font-bold ${ans.isCorrect ? "text-emerald-600" : "text-red-500"}`}>
                                                    {ans.pointsAwarded}/{ans.points} د
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Also display any unclassified questions */}
                                  {(() => {
                                    const allSecQuestionNums = sections.flatMap(sec => sec.questions.map(q => q.number));
                                    const extraAnswers = student.gradedAnswers.filter(ans => !allSecQuestionNums.includes(ans.number));

                                    if (extraAnswers.length === 0) return null;

                                    return (
                                      <div className="space-y-3 border border-amber-100 p-4 rounded-xl bg-amber-50/30 text-right" dir="rtl">
                                        <div className="flex justify-between items-center border-b border-amber-200 pb-2 mb-3">
                                          <span className="font-extrabold text-[12px] text-amber-900">أسئلة غير مصنفة (عام)</span>
                                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded font-bold">عام</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          {extraAnswers.map((ans) => {
                                            const options = ["A", "B", "C", "D"];
                                            const arabicLetters: Record<string, string> = {
                                              "A": "أ", "B": "ب", "C": "ج", "D": "د"
                                            };

                                            return (
                                              <div key={ans.number} className="flex items-center justify-between text-xs p-2.5 border border-amber-100 rounded-xl bg-white shadow-xs">
                                                <span className="font-bold text-amber-800 w-11 shrink-0">فقرة {ans.number}:</span>
                                                
                                                <div className="flex gap-1 items-center justify-center flex-1">
                                                  {options.map((opt) => {
                                                    const isStudentChoice = ans.studentAnswer === opt;
                                                    const isCorrectChoice = ans.correctAnswer === opt;

                                                    let bubbleStyle = "border-amber-300 text-amber-500 hover:bg-amber-50";
                                                    if (isStudentChoice) {
                                                      bubbleStyle = ans.isCorrect
                                                        ? "bg-emerald-600 border-emerald-600 text-white font-bold ring-2 ring-emerald-100"
                                                        : "bg-red-500 border-red-500 text-white font-bold ring-2 ring-red-100";
                                                    } else if (isCorrectChoice) {
                                                      bubbleStyle = "border-2 border-dashed border-emerald-500 bg-emerald-50 text-emerald-800 font-bold";
                                                    }

                                                    return (
                                                      <button
                                                        key={opt}
                                                        onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, ans.sectionId || "", opt)}
                                                        className={`w-5.5 h-5.5 rounded-full text-[9px] flex items-center justify-center border transition-all ${bubbleStyle}`}
                                                      >
                                                        {arabicLetters[opt] || opt}
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                <div className="w-11 text-left shrink-0">
                                                  <span className="text-[10px] font-mono font-bold text-amber-900">
                                                    {ans.pointsAwarded}/{ans.points} د
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto p-5 space-y-4">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b border-slate-100 pb-2">
                            <span>الفقرة والخيارات المتاحة</span>
                            <span>الحالة / الدرجة المستحقة</span>
                          </div>

                          <div className="space-y-6">
                            {sections.map((sec) => {
                              const secQuestionNums = sec.questions.map(q => q.number);
                              const secAnswers = student.gradedAnswers.filter(ans => {
                                if (ans.sectionId) return ans.sectionId === sec.id;
                                return secQuestionNums.includes(ans.number);
                              });
                              
                              if (secAnswers.length === 0) return null;

                              return (
                                <div key={sec.id} className="space-y-2.5">
                                  {/* Section Header */}
                                  <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl flex items-center justify-between shadow-sm">
                                    <span className="font-extrabold text-xs text-slate-800">{sec.name}</span>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                                      {sec.type === "mcq" ? "اختيار من متعدد (أ ب ج د)" : sec.type === "matching" ? "مزاوجة ومطابقة (10 خيارات)" : "صح أم خطأ"}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {secAnswers.map((ans) => {
                                      const sectionType = sec.type;

                                      return (
                                        <div 
                                          key={ans.number}
                                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                            ans.isCorrect ? "bg-emerald-50/15 border-emerald-100" : "bg-red-50/10 border-red-100"
                                          }`}
                                        >
                                          {/* Left part: Question Number and Option selections */}
                                          <div className="flex items-center gap-4">
                                            <span className="font-extrabold text-slate-800 text-xs font-mono w-14 shrink-0">فقرة {ans.number}</span>
                                            
                                            <div className="flex gap-1.5">
                                              {sectionType === "mcq" ? (
                                                ["A", "B", "C", "D"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;
                                                  
                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, opt)}
                                                      className={`w-6.5 h-6.5 rounded-full font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt}`}
                                                    >
                                                      {opt === "A" ? "أ" : opt === "B" ? "ب" : opt === "C" ? "ج" : "د"}
                                                    </button>
                                                  );
                                                })
                                              ) : sectionType === "matching" ? (
                                                ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;
                                                  
                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  const arabicLetters: Record<string, string> = {
                                                    "A": "أ", "B": "ب", "C": "ج", "D": "د", "E": "هـ", "F": "و", "G": "ز", "H": "ح", "I": "ط", "J": "ي"
                                                  };

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, opt)}
                                                      className={`w-6.5 h-6.5 rounded-full font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt}`}
                                                    >
                                                      {arabicLetters[opt] || opt}
                                                    </button>
                                                  );
                                                })
                                              ) : (
                                                ["T", "F"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;

                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, opt)}
                                                      className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt === 'T' ? 'صح' : 'خطأ'}`}
                                                    >
                                                      {opt === "T" ? "صح" : "خطأ"}
                                                    </button>
                                                  );
                                                })
                                              )}
                                              
                                              {/* Option to clear / make unanswered */}
                                              <button
                                                onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, sec.id, "")}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition border ${ans.studentAnswer === "" ? "bg-slate-700 text-white border-slate-700" : "bg-slate-50 text-slate-400 hover:bg-slate-100 border-slate-200"}`}
                                                title="تحديد الفقرة كغير مجابة"
                                              >
                                                ترك فارغ
                                              </button>
                                            </div>
                                          </div>

                                          {/* Right part: correction badge and points earned */}
                                          <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                              ans.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                                            }`}>
                                              {ans.isCorrect ? "إجابة صحيحة" : ans.studentAnswer === "" ? "متروك / فارغ" : "إجابة خاطئة"}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-slate-700">
                                              {ans.pointsAwarded} / {ans.points} د
                                            </span>
                                          </div>

                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Fallback extra questions that are not in any defined section */}
                            {(() => {
                              const allSecQuestionNums = sections.flatMap(sec => sec.questions.map(q => q.number));
                              const extraAnswers = student.gradedAnswers.filter(ans => !allSecQuestionNums.includes(ans.number));

                              if (extraAnswers.length === 0) return null;

                              return (
                                <div className="space-y-2.5">
                                  {/* Section Header */}
                                  <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center justify-between shadow-sm">
                                    <span className="font-extrabold text-xs text-amber-900">أسئلة غير مصنفة (خارج الأقسام)</span>
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">عام</span>
                                  </div>

                                  <div className="space-y-2">
                                    {extraAnswers.map((ans) => {
                                      const sectionType = (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(ans.correctAnswer) ? (["E", "F", "G", "H", "I", "J"].includes(ans.correctAnswer) ? "matching" : "mcq") : "tf");

                                      return (
                                        <div 
                                          key={ans.number}
                                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                            ans.isCorrect ? "bg-emerald-50/15 border-emerald-100" : "bg-red-50/10 border-red-100"
                                          }`}
                                        >
                                          {/* Left part: Question Number and Option selections */}
                                          <div className="flex items-center gap-4">
                                            <span className="font-extrabold text-slate-800 text-xs font-mono w-14 shrink-0">فقرة {ans.number}</span>
                                            
                                            <div className="flex gap-1.5">
                                              {sectionType === "mcq" ? (
                                                ["A", "B", "C", "D"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;
                                                  
                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, ans.sectionId || "", opt)}
                                                      className={`w-6.5 h-6.5 rounded-full font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt}`}
                                                    >
                                                      {opt === "A" ? "أ" : opt === "B" ? "ب" : opt === "C" ? "ج" : "د"}
                                                    </button>
                                                  );
                                                })
                                              ) : sectionType === "matching" ? (
                                                ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;
                                                  
                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  const arabicLetters: Record<string, string> = {
                                                    "A": "أ", "B": "ب", "C": "ج", "D": "د", "E": "هـ", "F": "و", "G": "ز", "H": "ح", "I": "ط", "J": "ي"
                                                  };

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, ans.sectionId || "", opt)}
                                                      className={`w-6.5 h-6.5 rounded-full font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt}`}
                                                    >
                                                      {arabicLetters[opt] || opt}
                                                    </button>
                                                  );
                                                })
                                              ) : (
                                                ["T", "F"].map((opt) => {
                                                  const isStudentChoice = ans.studentAnswer === opt;
                                                  const isCorrectChoice = ans.correctAnswer === opt;

                                                  let styleClass = "bg-white border-slate-300 text-slate-600";
                                                  if (isStudentChoice) {
                                                    styleClass = ans.isCorrect 
                                                      ? "bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300" 
                                                      : "bg-red-500 border-red-500 text-white ring-2 ring-red-300";
                                                  } else if (isCorrectChoice) {
                                                    styleClass = "bg-emerald-100 border-emerald-300 text-emerald-800 font-extrabold";
                                                  }

                                                  return (
                                                    <button
                                                      key={opt}
                                                      onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, ans.sectionId || "", opt)}
                                                      className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] flex items-center justify-center border transition ${styleClass}`}
                                                      title={`تعديل اختيار الطالب ليكون ${opt === 'T' ? 'صح' : 'خطأ'}`}
                                                    >
                                                      {opt === "T" ? "صح" : "خطأ"}
                                                    </button>
                                                  );
                                                })
                                              )}
                                              
                                              {/* Option to clear / make unanswered */}
                                              <button
                                                onClick={() => handleStudentAnswerOverride(selectedStudentIndex!, ans.number, ans.sectionId || "", "")}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition border ${ans.studentAnswer === "" ? "bg-slate-700 text-white border-slate-700" : "bg-slate-50 text-slate-400 hover:bg-slate-100 border-slate-200"}`}
                                                title="تحديد الفقرة كغير مجابة"
                                              >
                                                ترك فارغ
                                              </button>
                                            </div>
                                          </div>

                                          {/* Right part: correction badge and points earned */}
                                          <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                              ans.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                                            }`}>
                                              {ans.isCorrect ? "إجابة صحيحة" : ans.studentAnswer === "" ? "متروك / فارغ" : "إجابة خاطئة"}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-slate-700">
                                              {ans.pointsAwarded} / {ans.points} د
                                            </span>
                                          </div>

                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        )}

                      </div>
                    );
                  })()
                )}
              </div>

            </div>
        )}          </div>

        </section>

      </main>

      {/* Bubble sheet generator modal overlay */}
      {showSheetGenerator && (
        <BubbleSheetGenerator 
          onClose={() => setShowSheetGenerator(false)} 
          onImportKey={(importedSections) => {
            setSections(importedSections);
            setExamName("قالب ورقة الإجابة المخصصة");
            setIsDemoMode(false);
          }}
        />
      )}

      {/* Student Sheet Calibration Modal Overlay */}
      {calibratingStudentFileId && (() => {
        const fileObj = studentFiles.find(f => f.id === calibratingStudentFileId);
        if (!fileObj) return null;
        
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full overflow-hidden text-right flex flex-col max-h-[90vh]" dir="rtl">
              
              {/* Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-emerald-400 animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-sm">مساعد معايرة ومحاذاة تظليل ورقة الطالب</h3>
                    <p className="text-[10px] text-slate-300">الملف: {fileObj.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setCalibratingStudentFileId(null)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visual Image Preview Column (7 cols) */}
                <div className="lg:col-span-7 flex flex-col h-[500px] border border-slate-200 rounded-2xl bg-slate-100/50 p-4 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-3 shrink-0">
                    <span className="text-xs font-bold text-slate-700">المعاينة الحية لمدخلات OMR للذكاء الاصطناعي</span>
                    <div className="flex bg-slate-200 p-0.5 rounded-lg text-[9px] font-bold">
                      <button
                        onClick={() => setShowStudentProcessedView(false)}
                        className={`px-3 py-1 rounded transition ${!showStudentProcessedView ? "bg-white text-slate-800 shadow-xs" : "text-slate-600"}`}
                      >
                        الصورة الأصلية
                      </button>
                      <button
                        onClick={() => setShowStudentProcessedView(true)}
                        className={`px-3 py-1 rounded transition ${showStudentProcessedView ? "bg-white text-slate-800 shadow-xs" : "text-slate-600"}`}
                      >
                        وضع OMR المصفى
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center overflow-auto bg-slate-200/30 rounded-xl border border-slate-100 relative p-1">
                    <div className="relative max-h-full max-w-full">
                      <img
                        src={showStudentProcessedView ? (processedStudentBlobUrl || `data:${fileObj.mimeType};base64,${processedStudentBase64 || fileObj.fileDataUrl}`) : (fileObj.fileDataUrl)}
                        alt="معاينة ورقة الطالب المعدلة"
                        className="max-h-[380px] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 transition"
                      />
                      
                      {/* Guides Overlay */}
                      {showStudentCropGuides && (
                        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                          {/* MCQ guide band */}
                          <div 
                            className="absolute left-0 right-0 bg-emerald-500/15 border-y border-emerald-500 flex items-center justify-center"
                            style={{ top: `${studentMcqStartY}%`, bottom: `${100 - studentMcqEndY}%` }}
                          >
                            <span className="bg-emerald-650 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow-xs">
                              نطاق فقرات الاختيار من متعدد ({studentMcqStartY}% - {studentMcqEndY}%)
                            </span>
                          </div>

                          {/* T/F & Matching guide band */}
                          <div 
                            className="absolute left-0 right-0 bg-blue-500/15 border-y border-blue-500 flex items-center justify-center"
                            style={{ top: `${studentTfStartY}%`, bottom: `${100 - studentTfEndY}%` }}
                          >
                            <span className="bg-blue-650 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow-xs">
                              نطاق فقرات الصح والخطأ والمزاوجة ({studentTfStartY}% - {studentTfEndY}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 shrink-0">
                    <button
                      onClick={() => setShowStudentCropGuides(!showStudentCropGuides)}
                      className={`text-[10px] font-bold px-2 py-1 rounded transition ${
                        showStudentCropGuides ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {showStudentCropGuides ? "إخفاء خطوط الاقتطاع" : "عرض خطوط الاقتطاع"}
                    </button>
                    <span className="text-[9px] text-slate-400">تساعد خطوط الاقتطاع في عزل شبكة تظليل الإجابات لمنع تشتت عين الذكاء الاصطناعي</span>
                  </div>
                </div>

                {/* Adjustments Controls Column (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-slate-800">أدوات المعالجة ومطابقة الفقرات</span>
                      <p className="text-[9px] text-slate-400 mt-1">اضبط زاوية التدوير، الميلان الطفيف، ونطاقات قص جدول التظليل لورقة الطالب هذه.</p>
                    </div>

                    {/* Rotation */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-600">تدوير الصفحة بزوايا قائمة:</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStudentRotation(prev => (prev + 270) % 360)}
                          className="bg-white border border-slate-200 text-slate-700 py-1.5 rounded-xl text-xs hover:bg-slate-50 flex-1 flex justify-center items-center gap-1.5 font-bold shadow-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-indigo-500" />
                          يسار 90°
                        </button>
                        <button
                          onClick={() => setStudentRotation(prev => (prev + 90) % 360)}
                          className="bg-white border border-slate-200 text-slate-700 py-1.5 rounded-xl text-xs hover:bg-slate-50 flex-1 flex justify-center items-center gap-1.5 font-bold shadow-xs"
                        >
                          <RotateCw className="h-3.5 w-3.5 text-indigo-500" />
                          يمين 90°
                        </button>
                      </div>
                    </div>

                    {/* Fine Tilt Slider */}
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                        <span>محاذاة الميلان الدقيق (Deskew):</span>
                        <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{studentFineTilt}°</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={studentFineTilt}
                        onChange={(e) => setStudentFineTilt(parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                      />
                    </div>

                    {/* MCQ Range Slider */}
                    <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                        <span>نطاق الاختيار من متعدد:</span>
                        <span className="font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                          {studentMcqStartY}% إلى {studentMcqEndY}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-400">البداية: {studentMcqStartY}%</span>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={studentMcqStartY}
                            onChange={(e) => setStudentMcqStartY(parseInt(e.target.value))}
                            className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-400">النهاية: {studentMcqEndY}%</span>
                          <input
                            type="range"
                            min="50"
                            max="100"
                            value={studentMcqEndY}
                            onChange={(e) => setStudentMcqEndY(parseInt(e.target.value))}
                            className="w-full accent-emerald-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* T/F Range Slider */}
                    <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                        <span>نطاق الصح والخطأ والمزاوجة:</span>
                        <span className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">
                          {studentTfStartY}% إلى {studentTfEndY}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-400">البداية: {studentTfStartY}%</span>
                          <input
                            type="range"
                            min="50"
                            max="85"
                            value={studentTfStartY}
                            onChange={(e) => setStudentTfStartY(parseInt(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] text-slate-400">النهاية: {studentTfEndY}%</span>
                          <input
                            type="range"
                            min="75"
                            max="100"
                            value={studentTfEndY}
                            onChange={(e) => setStudentTfEndY(parseInt(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Toggle OMR filter */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 block">مرشح التظليل التلقائي (OMR Mode)</span>
                        <span className="text-[8px] text-slate-400">تنظيف الورقة ورفع التباين لبروز فقرات التظليل بدقة</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={studentContrast}
                        onChange={(e) => setStudentContrast(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={saveStudentCalibration}
                      disabled={isProcessingStudentCanvas}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-2xl transition shadow-md active:scale-[0.98] disabled:bg-slate-300"
                    >
                      تطبيق وحفظ المعايرة لورقة الطالب
                    </button>
                    <button
                      onClick={() => setCalibratingStudentFileId(null)}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-2xl text-xs font-bold transition"
                    >
                      إلغاء التغييرات
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* Empty Template Notification Modal Overlay */}
      {showEmptyTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden text-right" dir="rtl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">ملاحظة: تم الكشف عن نموذج إجابة فارغ</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">منصة المصحح الإلكتروني الذكية</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <p>
                  لقد قمت برفع مستند <strong>نموذج إجابة فارغ</strong> (بدون تظليل أي فقرات).
                </p>
                <p>
                  بناءً على طلبك، <strong>لم يتم تظليل أي فقرة</strong> في النموذج الإلكتروني التفاعلي بشكل تلقائي أو افتراضي.
                </p>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500">
                  💡 يمكنك الآن تظليل الإجابات الصحيحة يدوياً على هذا النموذج الإلكتروني، أو رفع ملف مفتاح إجابة يحتوي على تظليلات معتمدة ليتم ملؤها تلقائياً.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowEmptyTemplateModal(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-sm cursor-pointer"
              >
                فهمت ذلك، حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 mt-12 shrink-0 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} منصة المصحح الإلكتروني والتحكم الذكي بمؤشرات الاختبارات.</p>
          <p className="font-mono">OMR Core AI Engine • Gemini 3.5 Flash Model</p>
        </div>
      </footer>

      {/* Custom print styling to render clean official report tables on standard print click */}
      <div className="hidden print:block p-8 bg-white text-slate-900" dir="rtl">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <h2 className="text-xl font-extrabold">{examName}</h2>
          <p className="text-xs text-slate-600 mt-1">كشف درجات الطلاب الرسمي الصادر عن المصحح الإلكتروني</p>
        </div>

        <table className="w-full text-xs text-right border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 p-2 font-bold">اسم الطالب</th>
              <th className="border border-slate-400 p-2 font-bold">الرقم الأكاديمي</th>
              <th className="border border-slate-400 p-2 font-bold">عدد الإجابات الصحيحة</th>
              <th className="border border-slate-400 p-2 font-bold">مجموع الدرجات</th>
              <th className="border border-slate-400 p-2 font-bold">النسبة المئوية</th>
              <th className="border border-slate-400 p-2 font-bold">التقدير</th>
            </tr>
          </thead>
          <tbody>
            {results.map((student, idx) => (
              <tr key={idx}>
                <td className="border border-slate-400 p-2 font-bold">{student.studentName}</td>
                <td className="border border-slate-400 p-2 font-mono">{student.studentId}</td>
                <td className="border border-slate-400 p-2 font-mono text-center">{student.correctCount}</td>
                <td className="border border-slate-400 p-2 font-mono text-center">{student.scorePoints} / {student.totalPoints}</td>
                <td className="border border-slate-400 p-2 font-mono text-center">{student.percentage}%</td>
                <td className="border border-slate-400 p-2 text-center font-bold">
                  {student.percentage >= 90 ? "ممتاز" :
                   student.percentage >= 80 ? "جيد جداً" :
                   student.percentage >= 70 ? "جيد" :
                   student.percentage >= 60 ? "مقبول" : "ضعيف"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between text-xs">
          <div>
            <p className="font-bold">توقيع المعلم المادة:</p>
            <div className="border-b border-slate-400 w-32 h-8"></div>
          </div>
          <div>
            <p className="font-bold">اعتماد قائد المدرسة:</p>
            <div className="border-b border-slate-400 w-32 h-8"></div>
          </div>
        </div>
      </div>

    </div>
  );
}
