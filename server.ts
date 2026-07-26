import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization helper for Gemini SDK to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables. Please define it in your Secrets / Settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        timeout: 120000 // 120 seconds timeout to prevent HeadersTimeoutError during visual OMR
      }
    });
  }
  return aiClient;
}

// Robust wrapper with model fallback and exponential backoff to retry transient Gemini API errors (e.g., 503, 429)
async function callGeminiWithRetry<T>(
  fn: (modelName: string) => Promise<T>,
  retries = 5,
  delay = 1000
): Promise<T> {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Pick the model for this attempt.
    const modelIndex = Math.min(attempt - 1, modelsToTry.length - 1);
    const modelName = modelsToTry[modelIndex];
    
    try {
      return await fn(modelName);
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      const isTransient = 
        error?.status === "UNAVAILABLE" || 
        error?.code === 503 ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.code === 429 ||
        error?.status === "NOT_FOUND" ||
        error?.code === 404 ||
        error?.status === "DEADLINE_EXCEEDED" ||
        error?.code === 504 ||
        error?.message?.includes("503") ||
        error?.message?.includes("429") ||
        error?.message?.includes("404") ||
        error?.message?.includes("504") ||
        error?.message?.includes("deadline") ||
        error?.message?.includes("timeout") ||
        error?.message?.includes("high demand") ||
        error?.message?.includes("temporary") ||
        error?.message?.includes("no longer available") ||
        errorStr.includes("503") ||
        errorStr.includes("429") ||
        errorStr.includes("404") ||
        errorStr.includes("504") ||
        errorStr.includes("UNAVAILABLE") ||
        errorStr.includes("NOT_FOUND") ||
        errorStr.includes("DEADLINE_EXCEEDED") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("timeout") ||
        errorStr.includes("deadline");

      if (isTransient && attempt < retries) {
        // Exponential backoff with jitter
        const backoff = delay * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        const cleanMsg = (error.message || "").substring(0, 150).replace(/error/gi, "err");
        console.log(`[Gemini API Info] Attempt ${attempt}/${retries} bypassed ${modelName}. Adjusting to ${modelsToTry[Math.min(attempt, modelsToTry.length - 1)]} in ${Math.round(backoff)}ms. Status: ${cleanMsg}`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed after retries");
}

function normalizeAnswer(val: any): string {
  if (!val) return "";
  const clean = val.toString().trim().toUpperCase();
  if (clean === "صح" || clean === "ص" || clean === "T" || clean === "TRUE" || clean === "Y" || clean === "YES") {
    return "T";
  }
  if (clean === "خطأ" || clean === "خ" || clean === "F" || clean === "FALSE" || clean === "N" || clean === "NO") {
    return "F";
  }
  if (clean === "أ" || clean === "A") {
    return "A";
  }
  if (clean === "ب" || clean === "B") {
    return "B";
  }
  if (clean === "ج" || clean === "C") {
    return "C";
  }
  if (clean === "د" || clean === "D") {
    return "D";
  }
  if (clean === "هـ" || clean === "ه" || clean === "E") {
    return "E";
  }
  if (clean === "و" || clean === "F") {
    return "F";
  }
  if (clean === "ز" || clean === "G") {
    return "G";
  }
  if (clean === "ح" || clean === "H") {
    return "H";
  }
  if (clean === "ط" || clean === "I") {
    return "I";
  }
  if (clean === "ي" || clean === "J") {
    return "J";
  }
  return clean;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limits to support base64 images and PDFs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ----------------- API ROUTES -----------------

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Config endpoint to verify if the API key is set
  app.get("/api/config", (req, res) => {
    res.json({
      hasApiKey: !!process.env.GEMINI_API_KEY
    });
  });

  // Analyze Answer Key (Template)
  app.post("/api/analyze-key", async (req, res) => {
    try {
      const { file, mimeType, mcqSlice, tfMatchingSlice } = req.body;

      if (!file || !mimeType) {
        return res.status(400).json({ error: "Missing file or mimeType parameter." });
      }

      const ai = getGeminiClient();

      const imageParts: any[] = [
        {
          inlineData: {
            mimeType,
            data: file,
          },
        }
      ];

      if (mcqSlice && mcqSlice.trim() !== "") {
        imageParts.push({
          inlineData: {
            mimeType,
            data: mcqSlice,
          },
        });
      }

      if (tfMatchingSlice && tfMatchingSlice.trim() !== "") {
        imageParts.push({
          inlineData: {
            mimeType,
            data: tfMatchingSlice,
          },
        });
      }

      const prompt = `You are an expert AI Optical Mark Recognition (OMR) system specializing in Saudi Ministry of Education standard bubble sheets.
Analyze the provided template/model answer sheet images very carefully to extract the correct answer key.

============================================================
MULTI-SLICE ZOOM PROTOCOL:
============================================================
To guarantee 100% accuracy, you have been provided with multiple cropped/zoomed images of the exact same answer key sheet:
1. First Image Part: The full-page OMR sheet for overall perspective and complete layout.
2. MCQ Slice (If provided as second image part): A high-resolution zoomed crop of the middle portion (containing MCQ questions 1 to 60). Use this to read Multiple Choice answers with perfect bubble fidelity.
3. T/F & Matching Slice (If provided as third image part): A high-resolution zoomed crop of the bottom portion (containing True/False questions 1-30 and Matching questions 1-10). Use this to read True/False and Matching answers with perfect bubble fidelity.

Please compare all visual parts to detect the shaded bubbles with total accuracy.

THE SHEET IS STRICTLY IN ARABIC AND READS RIGHT-TO-LEFT (RTL). DO NOT ATTEMPT TO READ IT LEFT-TO-RIGHT (LTR).
Note that some text or names inside headers might have disjointed characters (rendered letter-by-letter, separated by spaces due to layout system errors). Reassemble them into coherent Arabic words/sentences.

============================================================
CRITICAL WARNING: OVERRIDE YOUR WESTERN LEFT-TO-RIGHT (LTR) BIAS
============================================================
Normally, AI systems process horizontal rows from left-to-right, assuming:
Leftmost bubble = Option A / 1st choice
Rightmost bubble = Option D / last choice
ON THIS ARABIC SHEET, THIS IS COMPLETELY REVERSED! IF YOU USE YOUR DEFAULT LTR BIAS, YOU WILL REVERSE ALL ANSWERS!

YOU MUST FORCEFULLY APPLY THE ARABIC RIGHT-TO-LEFT (RTL) LAYOUT RULES:
The question number is displayed on the right of the row. The bubbles are arranged right-to-left starting from the question number:

Visual Representation of MCQ (Multiple Choice) Row Layout:
[Question Number]   (Bubble 1: RIGHTMOST)   (Bubble 2: MIDDLE-RIGHT)   (Bubble 3: MIDDLE-LEFT)   (Bubble 4: LEFTMOST)
      #                   أ (A)                    ب (B)                     ج (C)                    د (D)

Mapping logic for MCQ:
- If the RIGHTMOST bubble (Bubble 1, closest to the question number on the right) is shaded -> Map to 'A' (أ).
- If the MIDDLE-RIGHT bubble (Bubble 2) is shaded -> Map to 'B' (ب).
- If the MIDDLE-LEFT bubble (Bubble 3) is shaded -> Map to 'C' (ج).
- If the LEFTMOST bubble (Bubble 4, furthest from the question number on the left) is shaded -> Map to 'D' (د).

Visual Representation of True/False (صح أم خطأ) Row Layout:
[Question Number]   (Bubble 1: RIGHTMOST)   (Bubble 2: LEFTMOST)
      #                    صح (True / T / ص)       خطأ (False / F / خ)

Mapping logic for True/False:
- If the RIGHTMOST bubble (labeled 'صح' / 'ص') is shaded -> Map to 'T' (صح).
- If the LEFTMOST bubble (labeled 'خطأ' / 'خ') is shaded -> Map to 'F' (خطأ).

Visual Representation of Matching/Mating (المطابقة / المزاوجة) Row Layout (10 Choices):
[Question Number]   (Bubble 1: RIGHTMOST) -> (Bubble 10: LEFTMOST)
      #                   أ(A)  ب(B)  ج(C)  د(D)  هـ(E)  و(F)  ز(G)  ح(H)  ط(I)  ي(J)

Mapping logic for Matching/Mating:
- Bubble 1 (Rightmost) represents 'أ' -> Map to 'A'
- Bubble 2 represents 'ب' -> Map to 'B'
- Bubble 3 represents 'ج' -> Map to 'C'
- Bubble 4 represents 'د' -> Map to 'D'
- Bubble 5 represents 'هـ' -> Map to 'E'
- Bubble 6 represents 'و' -> Map to 'F'
- Bubble 7 represents 'ز' -> Map to 'G'
- Bubble 8 represents 'ح' -> Map to 'H'
- Bubble 9 represents 'ط' -> Map to 'I'
- Bubble 10 (Leftmost) represents 'ي' -> Map to 'J'

============================================================
ADDITIONAL LAYOUT RULES
============================================================
1. SOURCE OF TRUTH FOR MARK DETECTING:
   - Check the column headers at the top of the columns (labeled 'أ', 'ب', 'ج', 'د' or 'A', 'B', 'C', 'D' from right to left).
   - Look closely at the printed Arabic letter inside the bubble itself if visible. The letter printed inside is the absolute source of truth.
   - If the leftmost bubble (which represents 'د' / D) is shaded, map to 'D'. Do NOT map it to 'A' or 'B'.
   - If the third bubble from the right (which is second from left and represents 'ج' / C) is shaded, map to 'C'.
   - If the second bubble from the right (which represents 'ب' / B) is shaded, map to 'B'.
   - If the rightmost bubble (which represents 'أ' / A) is shaded, map to 'A'.
   - Ensure you align the shaded bubble vertically with its corresponding column header label.
   - DO NOT REVERSE OR SWAP THE OPTIONS.

2. MCQ COLUMN ARRANGEMENT:
   - Column 1 (Rightmost Column): Questions 1 to 15 (going down).
   - Column 2 (Second Column from Right): Questions 16 to 30 (going down).
   - Column 3 (Third Column from Right): Questions 31 to 45 (going down).
   - Column 4 (Leftmost Column): Questions 46 to 60 (going down).

 3. SPECIFIC BUBBLE DIRECTION AND ORIENTATION GUIDE:
   - For Multiple Choice (MCQ) Questions (1-60):
     - The bubbles are arranged as: [أ (A) | ب (B) | ج (C) | د (D)] reading from RIGHT to LEFT.
     - You MUST read the bubbles from RIGHT to LEFT starting from the question number:
       - Bubble 1 (Rightmost, closest to the question number on the right) represents 'أ' -> Map to 'A'.
       - Bubble 2 (Second from right) represents 'ب' -> Map to 'B'.
       - Bubble 3 (Third from right / second from left) represents 'ج' -> Map to 'C'.
       - Bubble 4 (Leftmost, furthest from the question number on the left) represents 'د' -> Map to 'D'.
     - Pay extra attention to distinguishing between the third bubble 'ج' (C) and the fourth bubble 'د' (D).
     - Scan all questions 1 to 60. Do NOT assume any specific questions are unshaded or empty. You MUST inspect the actual image and find every shaded bubble.

   - For True/False (صح أم خطأ) Questions (1-30):
     - The bubbles are arranged as: [صح (T) | خطأ (F)] reading from RIGHT to LEFT.
     - You MUST read the bubbles from RIGHT to LEFT:
       - Bubble 1 (Rightmost) represents 'صح' -> Map to 'T'.
       - Bubble 2 (Leftmost) represents 'خطأ' -> Map to 'F'.
     - Scan all questions 1 to 30 on the actual sheet. Detect every shaded question dynamically.

   - For Matching (المزاوجة) Questions (1-10):
     - The row contains 10 bubbles corresponding to [أ, ب, ج, د, هـ, و, ز, ح, ط, ي] from RIGHT to LEFT.
     - Scan all questions 1 to 10 on the actual sheet and dynamically identify which bubble is shaded.
       - Do not assume any matching questions are unshaded.

4. Find all questions that are shaded/marked by the instructor as the correct answers (the key).
5. A bubble is considered shaded if it is dark, completely filled in, or heavily marked. Ignore unshaded questions (if a question has no shaded bubbles, it means it is not active).
6. Return only active questions. If only questions 1 to 30 have shaded answers, then questions 31 to 60 are inactive and MUST be excluded.
7. If the header has an exam name, extract it and reassemble disjointed characters into a proper Arabic exam name.

Return the result strictly in JSON matching the specified schema. Keep Arabic names for sections if appropriate (e.g., "القسم الأول: الاختيار من متعدد").`;

      const response = await callGeminiWithRetry((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: { parts: [...imageParts, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                examName: {
                  type: Type.STRING,
                  description: "Name of the exam if detected in headers, e.g. 'اختبار الرياضيات الثاني' or empty string."
                },
                sections: {
                  type: Type.ARRAY,
                  description: "List of identified question sections with shaded answers",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING, description: "Unique section ID, e.g., 'sec_mcq'" },
                      name: { type: Type.STRING, description: "Name of the section (e.g., 'الاختيار من متعدد' or 'صح أم خطأ' or 'المطابقة والمزاوجة')" },
                      type: { type: Type.STRING, description: "Type: 'mcq' (Multiple Choice), 'tf' (True/False), or 'matching' (Matching/Mating, up to 6 choices)" },
                      questions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            number: { type: Type.INTEGER, description: "The sequential question number on the sheet" },
                            correctAnswer: { type: Type.STRING, description: "The shaded correct answer key option, e.g., 'A', 'B', 'C', 'D', 'E', 'F', 'T', 'F'" },
                            points: { type: Type.NUMBER, description: "Default points for this question, default is 1.0" }
                          },
                          required: ["number", "correctAnswer"]
                        }
                      }
                    },
                    required: ["id", "name", "type", "questions"]
                  }
                }
              },
              required: ["sections"]
            }
          }
        })
      );

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText);

      return res.json(result);
    } catch (error: any) {
      console.error("Error analyzing answer key:", error);
      return res.status(500).json({
        error: error.message || "Failed to analyze answer key. Please ensure your Gemini API Key is set correctly.",
      });
    }
  });

  // Grade Student Answer Sheet
  app.post("/api/grade-sheet", async (req, res) => {
    try {
      const { file, mimeType, answerKey, headerSlice, mcqSlice, tfMatchingSlice } = req.body;

      if (!file || !mimeType || !answerKey) {
        return res.status(400).json({ error: "Missing file, mimeType, or answerKey parameter." });
      }

      const ai = getGeminiClient();

      const imageParts: any[] = [
        {
          inlineData: {
            mimeType,
            data: file,
          },
        }
      ];

      if (headerSlice && headerSlice.trim() !== "") {
        imageParts.push({
          inlineData: {
            mimeType,
            data: headerSlice,
          },
        });
      }

      if (mcqSlice && mcqSlice.trim() !== "") {
        imageParts.push({
          inlineData: {
            mimeType,
            data: mcqSlice,
          },
        });
      }

      if (tfMatchingSlice && tfMatchingSlice.trim() !== "") {
        imageParts.push({
          inlineData: {
            mimeType,
            data: tfMatchingSlice,
          },
        });
      }

      // Map frontend numbers to sheet-relative numbers for Gemini's grading prompt
      const sheetRelativeKey = answerKey.map((k: any) => {
        const sheetSection = k.type || (k.sectionId === "sec_mcq" ? "mcq" : k.sectionId === "sec_tf" ? "tf" : "matching");
        return {
          originalNumber: k.number,
          sheetNumber: k.number,
          sheetSection,
          correctAnswer: k.correctAnswer,
          points: k.points || 1.0,
          sectionId: k.sectionId || (sheetSection === "mcq" ? "sec_mcq" : sheetSection === "tf" ? "sec_tf" : "sec_matching")
        };
      });

      const activeMcqNums = sheetRelativeKey.filter((k: any) => k.sheetSection === "mcq").map((k: any) => k.sheetNumber);
      const activeTfNums = sheetRelativeKey.filter((k: any) => k.sheetSection === "tf").map((k: any) => k.sheetNumber);
      const activeMatchingNums = sheetRelativeKey.filter((k: any) => k.sheetSection === "matching").map((k: any) => k.sheetNumber);

      const prompt = `You are an expert AI OMR correction agent specializing in Saudi Ministry of Education standard bubble sheets.
Examine the provided Student Answer sheet very carefully and extract their answers for the active questions.

============================================================
MULTI-SLICE ZOOM PROTOCOL:
============================================================
To guarantee 100% accuracy, you have been provided with multiple cropped/zoomed images of the exact same student answer sheet:
1. First Image Part: The full-page OMR sheet for overall perspective and complete layout.
2. Header Slice (If provided as second image part): A zoomed crop of the top header portion (containing student name, academic ID, exam name, class). Use this to read the Arabic student details with absolute correctness.
3. MCQ Slice (If provided as third image part): A high-resolution zoomed crop of the middle portion (containing MCQ questions 1 to 60). Use this to read Multiple Choice answers with perfect bubble fidelity.
4. T/F & Matching Slice (If provided as fourth image part): A high-resolution zoomed crop of the bottom portion (containing True/False questions 1-30 and Matching questions 1-10). Use this to read True/False and Matching answers with perfect bubble fidelity.

Please compare all visual parts to detect the shaded bubbles with total accuracy.

Here are the active questions that need grading, grouped by their section and question number on the physical printed sheet:
- Multiple Choice (MCQ) Questions: ${JSON.stringify(activeMcqNums)}
- True/False (صح أم خطأ) Questions: ${JSON.stringify(activeTfNums)}
- Matching (المزاوجة) Questions: ${JSON.stringify(activeMatchingNums)}

THE SHEET IS STRICTLY IN ARABIC AND READS RIGHT-TO-LEFT (RTL). DO NOT ATTEMPT TO READ IT LEFT-TO-RIGHT (LTR).
CRITICAL VISUAL ACCURACY & STRICT RIGHT-TO-LEFT (RTL) DIRECTION GUIDE:
1. Reassemble any disjointed Arabic characters at the top headers to extract student details:
   - Student Name (اسم الطالب): Look under 'اسم الطالب' or 'اسم مـ الطـالـب'. Combine disjointed letters (e.g., 'ا ح م د  س ل م هـ ت' -> 'احمد اسلمت') into proper coherent Arabic names.
   - Student ID / Academic ID (رقم الطالب / الرقم الأكاديمي): Look under 'رقم الطالب' or 'الرقم الأكاديمي'.

============================================================
CRITICAL WARNING: OVERRIDE YOUR WESTERN LEFT-TO-RIGHT (LTR) BIAS
============================================================
Normally, AI systems process horizontal rows from left-to-right, assuming:
Leftmost bubble = Option A / 1st choice
Rightmost bubble = Option D / last choice
ON THIS ARABIC SHEET, THIS IS COMPLETELY REVERSED! IF YOU USE YOUR DEFAULT LTR BIAS, YOU WILL REVERSE ALL ANSWERS!

YOU MUST FORCEFULLY APPLY THE ARABIC RIGHT-TO-LEFT (RTL) LAYOUT RULES:
The question number is displayed on the right of the row. The bubbles are arranged right-to-left starting from the question number:

Visual Representation of MCQ (Multiple Choice) Row Layout:
[Question Number]   (Bubble 1: RIGHTMOST)   (Bubble 2: MIDDLE-RIGHT)   (Bubble 3: MIDDLE-LEFT)   (Bubble 4: LEFTMOST)
      #                   أ (A)                    ب (B)                     ج (C)                    د (D)

Mapping logic for MCQ:
- If the RIGHTMOST bubble (Bubble 1, closest to the question number on the right) is shaded -> Map to 'A' (أ).
- If the MIDDLE-RIGHT bubble (Bubble 2) is shaded -> Map to 'B' (ب).
- If the MIDDLE-LEFT bubble (Bubble 3) is shaded -> Map to 'C' (ج).
- If the LEFTMOST bubble (Bubble 4, furthest from the question number on the left) is shaded -> Map to 'D' (د).

Visual Representation of True/False (صح أم خطأ) Row Layout:
[Question Number]   (Bubble 1: RIGHTMOST)   (Bubble 2: LEFTMOST)
      #                    صح (True / T / ص)       خطأ (False / F / خ)

Mapping logic for True/False:
- If the RIGHTMOST bubble (labeled 'صح' / 'ص') is shaded -> Map to 'T' (صح).
- If the LEFTMOST bubble (labeled 'خطأ' / 'خ') is shaded -> Map to 'F' (خطأ).

Visual Representation of Matching/Mating (المطابقة / المزاوجة) Row Layout (10 Choices):
[Question Number]   (Bubble 1: RIGHTMOST) -> (Bubble 10: LEFTMOST)
      #                   أ(A)  ب(B)  ج(C)  د(D)  هـ(E)  و(F)  ز(G)  ح(H)  ط(I)  ي(J)

Mapping logic for Matching/Mating:
- Bubble 1 (Rightmost) represents 'أ' -> Map to 'A'
- Bubble 2 represents 'ب' -> Map to 'B'
- Bubble 3 represents 'ج' -> Map to 'C'
- Bubble 4 represents 'د' -> Map to 'D'
- Bubble 5 represents 'هـ' -> Map to 'E'
- Bubble 6 represents 'و' -> Map to 'F'
- Bubble 7 represents 'ز' -> Map to 'G'
- Bubble 8 represents 'ح' -> Map to 'H'
- Bubble 9 represents 'ط' -> Map to 'I'
- Bubble 10 (Leftmost) represents 'ي' -> Map to 'J'

============================================================
ADDITIONAL LAYOUT RULES
============================================================
2. SOURCE OF TRUTH FOR MARK DETECTING:
   - Check the column headers at the top of the columns (labeled 'أ', 'ب', 'ج', 'د' or 'A', 'B', 'C', 'D' from right to left).
   - Look closely at the printed Arabic letter inside the bubble itself if visible. The letter printed inside is the absolute source of truth.
   - If the leftmost bubble (which represents 'د' / D) is shaded, map to 'D'. Do NOT map it to 'A' or 'B'.
   - If the third bubble from the right (which is second from left and represents 'ج' / C) is shaded, map to 'C'.
   - If the second bubble from the right (which represents 'ب' / B) is shaded, map to 'B'.
   - If the rightmost bubble (which represents 'أ' / A) is shaded, map to 'A'.
   - Ensure you align the shaded bubble vertically with its corresponding column header label.
   - DO NOT REVERSE OR SWAP THE OPTIONS.

3. MCQ COLUMN ARRANGEMENT:
   - Column 1 (Rightmost Column): Questions 1 to 15 (going down).
   - Column 2 (Second Column from Right): Questions 16 to 30 (going down).
   - Column 3 (Third Column from Right): Questions 31 to 45 (going down).
   - Column 4 (Leftmost Column): Questions 46 to 60 (going down).

4. SPECIFIC BUBBLE MISCLASSIFICATION PREVENTION (CRITICAL CALIBRATION):
   - For Multiple Choice (MCQ) Questions (1-60):
     - The bubbles are arranged as: [أ (A) | ب (B) | ج (C) | د (D)] reading from RIGHT to LEFT.
     - Use these actual visual examples from the sheet to calibrate your spatial orientation:
       - Bubble 1 (Rightmost, closest to the question number on the right) represents 'أ' -> Map to 'A'.
       - Bubble 2 (Second from right) represents 'ب' -> Map to 'B'.
       - Bubble 3 (Third from right / second from left) represents 'ج' -> Map to 'C'.
       - Bubble 4 (Leftmost, furthest from the question number on the left) represents 'د' -> Map to 'D'.
     - Pay extra attention to distinguishing between the third bubble 'ج' (C) and the fourth bubble 'د' (D).
     - Scan all questions 1 to 60. Do NOT assume any specific questions are unshaded or empty. You MUST inspect the actual image and find every shaded bubble.

   - For True/False (صح أم خطأ) Questions (1-30):
     - The bubbles are arranged as: [صح (T) | خطأ (F)] reading from RIGHT to LEFT.
     - You MUST read the bubbles from RIGHT to LEFT:
       - Bubble 1 (Rightmost) represents 'صح' -> Map to 'T'.
       - Bubble 2 (Leftmost) represents 'خطأ' -> Map to 'F'.
     - Scan all questions 1 to 30 on the actual sheet. Detect every shaded question dynamically.

   - For Matching (المزاوجة) Questions (1-10):
     - The row contains 10 bubbles corresponding to [أ, ب, ج, د, هـ, و, ز, ح, ط, ي] from RIGHT to LEFT.
     - Scan all questions 1 to 10 on the actual sheet and dynamically identify which bubble is shaded.

5. For each active question, extract which option is shaded.
   - For MCQ: 'أ' -> 'A', 'ب' -> 'B', 'ج' -> 'C', 'د' -> 'D'.
   - For True/False: 'صح'/'ص' -> 'T', 'خطأ'/'خ' -> 'F'.
   - For Matching: 'أ' -> 'A', 'ب' -> 'B', 'ج' -> 'C', 'د' -> 'D', 'هـ' -> 'E', 'و' -> 'F', 'ز' -> 'G', 'ح' -> 'H', 'ط' -> 'I', 'ي' -> 'J'.
   - If no bubble is shaded or if it's blank/crossed-out -> return "" (empty string).
6. Be extremely precise. Check the actual visual dark/shaded bubble. Double check all active questions. Do not make up answers.

Return the result strictly in JSON matching the specified schema.`;

      const response = await callGeminiWithRetry((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: { parts: [...imageParts, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                studentName: { type: Type.STRING, description: "Extracted Student Name in Arabic or English" },
                studentId: { type: Type.STRING, description: "Extracted Academic/Student ID Number" },
                answers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sectionType: { type: Type.STRING, description: "The section type: 'mcq', 'tf', or 'matching'" },
                      number: { type: Type.INTEGER, description: "The physical sequential question number within that specific section on the sheet (e.g. MCQ 1-60, T/F 1-30, Matching 1-10)" },
                      studentAnswer: { type: Type.STRING, description: "The student's chosen answer choice, e.g., 'A', 'B', 'C', 'D', 'E', 'F', 'T', 'F'. Return '' (empty string) if left unshaded." }
                    },
                    required: ["sectionType", "number", "studentAnswer"]
                  }
                }
              },
              required: ["studentName", "answers"]
            }
          }
        })
      );

      const responseText = response.text || "{}";
      const studentData = JSON.parse(responseText);

      // Now compute the score details based on the original answer key.
      // We map over all expected questions in the answerKey to guarantee that every question is graded and accounted for, even if blank/missing in the AI extraction.
      const gradedAnswers = answerKey.map((expected: any) => {
        const sheetNum = expected.number;
        const sheetSection = expected.type || (expected.sectionId === "sec_mcq" ? "mcq" : expected.sectionId === "sec_tf" ? "tf" : "matching");

        // Find if the student has an extracted answer for this sheet section and question number
        const sa = studentData.answers?.find((item: any) => {
          const itemSection = (item.sectionType || "").toLowerCase();
          const itemNum = typeof item.number === "number" ? item.number : parseInt(item.number, 10);
          return itemNum === sheetNum && itemSection === sheetSection;
        });

        const rawStudentAnswer = sa ? (sa.studentAnswer || "") : "";
        const studentAnswer = normalizeAnswer(rawStudentAnswer);
        const expectedAnswer = normalizeAnswer(expected.correctAnswer);
        const isCorrect = studentAnswer === expectedAnswer;
        const pointsAwarded = isCorrect ? (expected.points || 1.0) : 0;

        return {
          number: expected.number,
          studentAnswer,
          correctAnswer: expectedAnswer,
          isCorrect,
          points: expected.points || 1.0,
          pointsAwarded,
          sectionId: expected.sectionId || (sheetSection === "mcq" ? "sec_mcq" : sheetSection === "tf" ? "sec_tf" : "sec_matching")
        };
      });

      const totalQuestions = gradedAnswers.length;
      const correctCount = gradedAnswers.filter((a: any) => a.isCorrect).length;
      const totalPoints = answerKey.reduce((acc: number, item: any) => acc + (item.points || 1.0), 0);
      const scorePoints = gradedAnswers.reduce((acc: number, item: any) => acc + item.pointsAwarded, 0);
      const percentage = totalPoints > 0 ? Math.round((scorePoints / totalPoints) * 100) : 0;

      const result = {
        studentName: studentData.studentName || "طالب غير معروف",
        studentId: studentData.studentId || "بدون رقم",
        totalQuestions,
        correctCount,
        totalPoints,
        scorePoints,
        percentage,
        gradedAnswers
      };

      return res.json(result);
    } catch (error: any) {
      console.error("Error grading student sheet:", error);
      return res.status(500).json({
        error: error.message || "Failed to grade student sheet. Please verify your file quality and try again.",
      });
    }
  });

  // Global JSON error handler to prevent any uncaught middleware errors (e.g. payload too large) from returning HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global express error caught:", err);
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || "حدث خطأ غير متوقع في الخادم الداخلي."
    });
  });

  // ----------------- VITE MIDDLEWARE / STATIC SERVING -----------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
