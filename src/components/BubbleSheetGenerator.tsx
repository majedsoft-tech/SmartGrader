import React, { useState, useRef } from "react";
import { Printer, X, FileSpreadsheet, Plus, HelpCircle, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface BubbleSheetGeneratorProps {
  onClose: () => void;
  onImportKey?: (sections: any[]) => void;
}

export default function BubbleSheetGenerator({ onClose, onImportKey }: BubbleSheetGeneratorProps) {
  const [mcqCount, setMcqCount] = useState<number>(20);
  const [tfCount, setTfCount] = useState<number>(10);
  const [matchingCount, setMatchingCount] = useState<number>(10);
  const [examTitle, setExamTitle] = useState<string>("الاختبار النهائي للفصل الدراسي الأول");
  const [courseName, setCourseName] = useState<string>("مادة العلوم العامة");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    try {
      const printableContent = document.getElementById("printable-bubble-sheet");
      if (!printableContent) {
        window.print();
        return;
      }

      // Create a hidden iframe to print reliably from inside parent frames
      let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`
          <html>
            <head>
              <title>${examTitle}</title>
              <meta charset="utf-8">
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
                body {
                  font-family: "Inter", sans-serif;
                  direction: rtl;
                  background-color: white;
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                @import "tailwindcss";
              </style>
              <script src="https://cdn.tailwindcss.com"></script>
              <script>
                tailwind.config = {
                  theme: {
                    extend: {
                      fontFamily: {
                        sans: ["Inter", "sans-serif"],
                        mono: ["JetBrains Mono", "monospace"],
                      }
                    }
                  }
                }
              </script>
            </head>
            <body class="p-8">
              <div class="w-[210mm] min-h-[297mm] mx-auto bg-white relative">
                ${printableContent.innerHTML}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                  }, 600);
                };
              </script>
            </body>
          </html>
        `);
        iframeDoc.close();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Print error:", err);
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExporting(true);
    try {
      const element = printAreaRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2, // high quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // Helper to convert OKLCH strings to rgb/rgba
          const replaceOklchInCss = (cssText: string): string => {
            return cssText.replace(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g, (match, lStr, cStr, hStr, aStr) => {
              let l = parseFloat(lStr);
              if (lStr.includes("%")) l /= 100;
              const c = parseFloat(cStr);
              const h = parseFloat(hStr);
              
              let alpha = 1;
              if (aStr) {
                alpha = parseFloat(aStr);
                if (aStr.includes("%")) alpha /= 100;
              }
              
              try {
                // Oklch to RGB conversion
                const hRad = (h * Math.PI) / 180;
                const aVal = c * Math.cos(hRad);
                const bVal = c * Math.sin(hRad);
                
                const l_ = l + 0.3963377774 * aVal + 0.2158037573 * bVal;
                const m_ = l - 0.1055613458 * aVal - 0.0638541728 * bVal;
                const s_ = l - 0.0894841775 * aVal - 1.291485548 * bVal;
                
                const l3 = l_ * l_ * l_;
                const m3 = m_ * m_ * m_;
                const s3 = s_ * s_ * s_;
                
                const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
                const gL = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
                const bL = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
                
                const gamma = (x: number) => {
                  if (isNaN(x)) return 0;
                  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
                };
                
                const r = Math.max(0, Math.min(255, Math.round(gamma(rL) * 255)));
                const g = Math.max(0, Math.min(255, Math.round(gamma(gL) * 255)));
                const b = Math.max(0, Math.min(255, Math.round(gamma(bL) * 255)));
                
                if (aStr) {
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                } else {
                  return `rgb(${r}, ${g}, ${b})`;
                }
              } catch (err) {
                return "rgb(120, 120, 120)";
              }
            });
          };

          // Process style tags in clonedDoc
          const styleTags = clonedDoc.getElementsByTagName("style");
          for (let i = 0; i < styleTags.length; i++) {
            try {
              styleTags[i].innerHTML = replaceOklchInCss(styleTags[i].innerHTML);
            } catch (styleErr) {
              console.error("Failed to replace oklch in style tag", styleErr);
            }
          }

          // Process all inline styles in clonedDoc
          const allElements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            try {
              const styleAttr = el.getAttribute("style");
              if (styleAttr && styleAttr.includes("oklch")) {
                el.setAttribute("style", replaceOklchInCss(styleAttr));
              }
            } catch (elErr) {}
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`OMR_Bubble_Sheet_${courseName.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Generate numbers array
  const mcqQuestions = Array.from({ length: mcqCount }, (_, i) => i + 1);
  const tfQuestions = Array.from({ length: tfCount }, (_, i) => mcqCount + i + 1);
  const matchingQuestions = Array.from({ length: matchingCount }, (_, i) => mcqCount + tfCount + i + 1);

  // Group MCQs into chunks of 10 for compact display
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  const mcqChunks = chunkArray(mcqQuestions, 10);
  const tfChunks = chunkArray(tfQuestions, 10);
  const matchingChunks = chunkArray(matchingQuestions, 10);

  const applyAsTemplate = () => {
    if (onImportKey) {
      const sections: any[] = [];
      
      if (mcqCount > 0) {
        sections.push({
          id: "sec_mcq",
          name: "القسم الأول: الاختيار من متعدد",
          type: "mcq",
          questions: mcqQuestions.map((num) => ({
            number: num,
            correctAnswer: "A", // default
            points: 1,
          })),
        });
      }
      
      if (tfCount > 0) {
        sections.push({
          id: "sec_tf",
          name: "القسم الثاني: الصواب والخطأ",
          type: "tf",
          questions: tfQuestions.map((num) => ({
            number: num,
            correctAnswer: "T", // default
            points: 1,
          })),
        });
      }

      if (matchingCount > 0) {
        sections.push({
          id: "sec_matching",
          name: "القسم الثالث: المزاوجة والربط",
          type: "matching",
          questions: matchingQuestions.map((num) => ({
            number: num,
            correctAnswer: "A", // default
            points: 1,
          })),
        });
      }

      onImportKey(sections);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl max-w-5xl w-full flex flex-col md:flex-row shadow-2xl h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Left pane: Customization Settings (Hidden on print) */}
        <div className="w-full md:w-80 bg-slate-50 p-6 flex flex-col border-l border-slate-200 print:hidden overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="text-indigo-600 h-5 w-5" />
              تخصيص ورقة الإجابة
            </h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">اسم الاختبار:</label>
              <input
                type="text"
                value={examTitle || ""}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="أدخل اسم الاختبار"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المادة / المقرر:</label>
              <input
                type="text"
                value={courseName || ""}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="أدخل اسم المادة"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">عدد أسئلة الاختيار من متعدد:</label>
              <input
                type="number"
                min="0"
                max="60"
                value={mcqCount !== undefined && mcqCount !== null ? mcqCount : ""}
                onChange={(e) => setMcqCount(Math.min(60, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">الحد الأقصى: 60 فقرة</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">عدد أسئلة الصواب والخطأ:</label>
              <input
                type="number"
                min="0"
                max="30"
                value={tfCount !== undefined && tfCount !== null ? tfCount : ""}
                onChange={(e) => setTfCount(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">الحد الأقصى: 30 فقرة</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">عدد أسئلة المزاوجة والربط (6 خيارات):</label>
              <input
                type="number"
                min="0"
                max="30"
                value={matchingCount !== undefined && matchingCount !== null ? matchingCount : ""}
                onChange={(e) => setMatchingCount(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">الحد الأقصى: 30 فقرة</span>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-indigo-800 text-xs leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1">
                💡 تلميح للاستخدام:
              </p>
              يمكنك طباعة هذه الورقة مباشرة، وتعبئة نموذج الإجابة للمعلم، ثم تظليل أوراق الطلاب والتقاط صورة لها بكاميرا الجوال أو رفعها بصيغة PDF وسيقوم الذكاء الاصطناعي بتصحيحها فوراً!
            </div>
          </div>

          <div className="mt-6 space-y-2 pt-4 border-t border-slate-200">
            <button
              onClick={handlePrint}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              طباعة الورقة الآن
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "جاري تصدير PDF..." : "تصدير بصيغة PDF"}
            </button>

            {onImportKey && (
              <button
                onClick={applyAsTemplate}
                className="w-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl py-2.5 px-4 font-medium text-sm transition cursor-pointer"
              >
                اعتماد كقالب نموذج إجابة
              </button>
            )}
          </div>
        </div>

        {/* Right pane: Printable Bubble Sheet Preview */}
        <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto flex justify-center items-start print:bg-white print:p-0 print:overflow-visible">
          
          <div 
            ref={printAreaRef}
            className="bg-white w-[210mm] min-h-[297mm] p-8 md:p-12 shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 rounded-lg print:rounded-none relative"
            id="printable-bubble-sheet"
          >
            {/* OMR Corner Anchor Marks (Arkan) */}
            <div className="absolute top-4 left-4 w-6 h-6 bg-slate-950 border border-white flex items-center justify-center select-none z-20 print:bg-black" id="anchor-tl">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div className="absolute top-4 right-4 w-6 h-6 bg-slate-950 border border-white flex items-center justify-center select-none z-20 print:bg-black" id="anchor-tr">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div className="absolute bottom-4 left-4 w-6 h-6 bg-slate-950 border border-white flex items-center justify-center select-none z-20 print:bg-black" id="anchor-bl">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-slate-950 border border-white flex items-center justify-center select-none z-20 print:bg-black" id="anchor-br">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>

            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
              <div className="text-right">
                <h4 className="font-bold text-xs text-slate-700">المملكة العربية السعودية</h4>
                <h4 className="font-bold text-xs text-slate-700">وزارة التعليم</h4>
                <h4 className="font-bold text-xs text-slate-700">مدرسة التميز والإبداع</h4>
              </div>
              <div className="text-center">
                <h2 className="font-extrabold text-lg text-slate-900 mb-1">ورقة إجابة نموذجية (OMR Sheet)</h2>
                <span className="text-xs text-slate-600 border border-slate-300 rounded px-2.5 py-0.5 inline-block font-mono bg-slate-50">
                  {courseName}
                </span>
              </div>
              <div className="text-left font-mono text-[10px] text-slate-400">
                OMR-V1-AISTUDIO
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="font-bold text-md text-slate-800">{examTitle}</h3>
            </div>

            {/* Student Info Blocks */}
            <div className="grid grid-cols-2 gap-4 mb-6 border border-slate-900 p-4 rounded-xl">
              <div className="space-y-2 text-sm text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold shrink-0">اسم الطالب:</span>
                  <div className="border-b border-dashed border-slate-400 flex-1 h-5"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold shrink-0">الصف / الشعبة:</span>
                  <div className="border-b border-dashed border-slate-400 flex-1 h-5"></div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold shrink-0">الرقم الأكاديمي:</span>
                  <div className="border-b border-dashed border-slate-400 flex-1 h-5"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold shrink-0">تاريخ الاختبار:</span>
                  <div className="border-b border-dashed border-slate-400 flex-1 h-5"></div>
                </div>
              </div>
            </div>

            {/* General Instructions */}
            <div className="border border-slate-300 bg-slate-50/55 p-3 rounded-lg text-[11px] text-slate-700 leading-relaxed mb-6">
              <span className="font-bold text-slate-900 block mb-1">📝 تعليمات تظليل ورقة الإجابة:</span>
              <ul className="list-disc list-inside space-y-1 pr-1">
                <li>استخدم القلم لتظليل الدائرة المختارة بالكامل <span className="font-bold text-indigo-600">⬤</span> بشكل كامل وواضح.</li>
                <li>تجنب التظليل الجزئي أو الخروج عن إطار الدائرة بشكل مفرط.</li>
                <li>يرجى كتابة اسمك الثلاثي ورقمك الأكاديمي بخط يد واضح في الحقول المخصصة أعلاه.</li>
              </ul>
            </div>

            {/* Bubble Sheet Grid Sections */}
            <div className="space-y-8">
              
              {/* MCQ Section */}
              {mcqCount > 0 && (
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 mb-3 bg-slate-100 px-3 py-1.5 rounded-lg border-r-4 border-slate-900">
                    القسم الأول: الاختيار من متعدد (أ ب ج د)
                  </h4>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    {mcqChunks.map((chunk, colIdx) => (
                      <div key={colIdx} className="space-y-2 border-l border-slate-100 last:border-0 pl-2">
                        {chunk.map((num) => (
                          <div key={num} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 rounded">
                            <span className="font-bold text-slate-700 w-6 font-mono text-center">{num}</span>
                            <div className="flex gap-4">
                              {["A", "B", "C", "D"].map((opt, idx) => {
                                const letters = ["أ", "ب", "ج", "د"];
                                return (
                                  <div key={opt} className="flex flex-col items-center">
                                    <div className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center font-bold text-[9px] text-slate-800 cursor-pointer hover:bg-slate-100 font-sans">
                                      {letters[idx]}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* True / False Section */}
              {tfCount > 0 && (
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 mb-3 bg-slate-100 px-3 py-1.5 rounded-lg border-r-4 border-slate-900">
                    القسم الثاني: الصواب والخطأ (صح / خطأ)
                  </h4>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    {tfChunks.map((chunk, colIdx) => (
                      <div key={colIdx} className="space-y-2 border-l border-slate-100 last:border-0 pl-2">
                        {chunk.map((num) => (
                          <div key={num} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 rounded">
                            <span className="font-bold text-slate-700 w-6 font-mono text-center">{num}</span>
                            <div className="flex gap-6">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">صح</span>
                                <div className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center font-bold text-[9px] text-slate-800 cursor-pointer hover:bg-slate-100 font-sans">
                                  T
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">خطأ</span>
                                <div className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center font-bold text-[9px] text-slate-800 cursor-pointer hover:bg-slate-100 font-sans">
                                  F
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Section */}
              {matchingCount > 0 && (
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 mb-3 bg-slate-100 px-3 py-1.5 rounded-lg border-r-4 border-slate-900">
                    القسم الثالث: المزاوجة والربط (10 خيارات)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    {matchingChunks.map((chunk, colIdx) => (
                      <div key={colIdx} className="space-y-2 border-l border-slate-100 last:border-0 pl-2">
                        {chunk.map((num) => (
                          <div key={num} className="flex items-center justify-between text-xs py-1 hover:bg-slate-50 rounded">
                            <span className="font-bold text-slate-700 w-6 font-mono text-center">{num}</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((opt, idx) => {
                                const letters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"];
                                return (
                                  <div key={opt} className="flex flex-col items-center">
                                    <div className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center font-bold text-[9px] text-slate-800 cursor-pointer hover:bg-slate-100 font-sans">
                                      {letters[idx]}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom official footer */}
            <div className="absolute bottom-6 left-8 right-8 border-t border-slate-300 pt-3 flex justify-between items-center text-[10px] text-slate-400">
              <span>* يرجى تسليم هذه الورقة للمصحح الإلكتروني دون طيّها أو تمزيقها.</span>
              <span className="font-mono">Smart OMR Sheet Engine</span>
            </div>

          </div>

        </div>

      </div>
      
      {/* Dynamic print-only style overrides to ensure clean full-page prints */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-bubble-sheet, #printable-bubble-sheet * {
            visibility: visible;
          }
          #printable-bubble-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
