import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, ZoomIn, ZoomOut, RefreshCw, Loader2, Download, ExternalLink } from "lucide-react";

interface PdfPreviewerProps {
  base64?: string;
  blobUrl?: string;
  mimeType?: string;
  fileName?: string;
  heightClass?: string;
}

export default function PdfPreviewer({
  base64,
  blobUrl,
  mimeType,
  fileName = "document.pdf",
  heightClass = "h-[460px]"
}: PdfPreviewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfjsLoaded, setPdfjsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Auto-fit container width
  useEffect(() => {
    if (!pdfDoc || !autoFit || !containerRef.current) return;

    const handleResize = () => {
      if (!pdfDoc || !containerRef.current) return;
      try {
        pdfDoc.getPage(pageNum).then((page: any) => {
          if (!containerRef.current) return;
          const containerWidth = containerRef.current.clientWidth - 32; // padding
          if (containerWidth > 0) {
            const viewport = page.getViewport({ scale: 1.0 });
            const calculatedScale = containerWidth / viewport.width;
            setScale(Number(calculatedScale.toFixed(2)));
          }
        });
      } catch (e) {
        console.error(e);
      }
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [pdfDoc, pageNum, autoFit]);

  // 1. Load PDF.js script dynamically
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }

    const scriptId = "pdfjs-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const handleLoad = async () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        try {
          // Fetch worker code to bypass same-origin restriction on web workers
          const response = await fetch("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");
          const workerCode = await response.text();
          const blob = new Blob([workerCode], { type: "application/javascript" });
          const blobUrl = URL.createObjectURL(blob);
          pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;
        } catch (e) {
          console.warn("Could not load worker via blob, falling back to CDN URL:", e);
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        setPdfjsLoaded(true);
      } else {
        setError("فشل تحميل قارئ ملفات PDF");
      }
    };

    script.addEventListener("load", handleLoad);
    return () => {
      script.removeEventListener("load", handleLoad);
    };
  }, []);

  // 2. Load PDF document once PDF.js is loaded
  useEffect(() => {
    if (!pdfjsLoaded) return;

    let active = true;
    setLoading(true);
    setError(null);
    setPageNum(1);

    const loadPdf = async () => {
      const pdfjsLib = (window as any).pdfjsLib;
      try {
        let doc: any = null;

        if (blobUrl) {
          doc = await pdfjsLib.getDocument(blobUrl).promise;
        } else if (base64) {
          // Clean base64 just in case
          const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, "");
          const binaryString = atob(cleanBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        } else {
          throw new Error("لا يوجد مصدر ملف صالح");
        }

        if (active) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading PDF document:", err);
        if (active) {
          setError(err?.message || "فشل تحميل ملف PDF. يرجى تنزيله أو فتحه في نافذة كاملة.");
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      active = false;
    };
  }, [pdfjsLoaded, base64, blobUrl]);

  // 3. Render page whenever pageNum or scale or pdfDoc changes
  useEffect(() => {
    if (!pdfDoc) return;

    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active) return;

        // Get viewport with specified scale
        const viewport = page.getViewport({ scale: scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        // Handle high DPI displays nicely
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * devicePixelRatio;
        canvas.height = viewport.height * devicePixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.scale(devicePixelRatio, devicePixelRatio);

        // Cancel previous render task if any
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // ignore cancel errors
          }
          renderTaskRef.current = null;
        }

        const currentRenderTask = page.render({
          canvasContext: context,
          viewport: viewport
        });
        renderTaskRef.current = currentRenderTask;

        await currentRenderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("PDF render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore cancel errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleZoomIn = () => {
    setAutoFit(false);
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setAutoFit(false);
    setScale((prev) => Math.max(prev - 0.2, 0.6));
  };

  const handleToggleAutoFit = () => {
    setAutoFit((prev) => !prev);
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-xs" dir="rtl">
      {/* PDF ToolBar */}
      <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap gap-3 items-center justify-between shrink-0 select-none text-xs">
        {/* Navigation controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages || loading}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="الصفحة التالية"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          <span className="font-medium text-[11px] px-2 py-0.5 bg-slate-800 rounded">
            الصفحة {pageNum} من {numPages || "?"}
          </span>

          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || loading}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="الصفحة السابقة"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAutoFit}
            disabled={loading}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
              autoFit 
                ? "bg-indigo-600 text-white hover:bg-indigo-750" 
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title="ملائمة عرض الصفحة تلقائياً"
          >
            ملائمة العرض
          </button>
          <span className="text-slate-700 text-xs select-none">|</span>
          <button
            onClick={handleZoomOut}
            disabled={loading}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="تصغير"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-300 w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={loading}
            className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="تكبير"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-800/20 relative min-h-[350px] ${heightClass}`}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 text-slate-800 z-10 backdrop-blur-xs">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <span className="text-xs font-bold text-slate-700">جاري معالجة وعرض المستند...</span>
          </div>
        )}

        {error ? (
          <div className="max-w-xs text-center p-6 bg-white/90 rounded-2xl border border-slate-200 shadow-md space-y-3 my-auto">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs font-bold text-red-600 leading-relaxed">{error}</p>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={blobUrl || `data:${mimeType || "application/pdf"};base64,${base64}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition shadow-sm"
              >
                <ExternalLink className="h-3 w-3" />
                فتح في نافذة كاملة
              </a>
              <a
                href={blobUrl || `data:${mimeType || "application/pdf"};base64,${base64}`}
                download={fileName}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-200"
              >
                <Download className="h-3 w-3" />
                تنزيل الملف المباشر
              </a>
            </div>
          </div>
        ) : (
          <div className="shadow-lg border border-slate-200/60 rounded-sm bg-white overflow-hidden transition-all duration-300">
            <canvas ref={canvasRef} className="block" />
          </div>
        )}
      </div>
    </div>
  );
}
