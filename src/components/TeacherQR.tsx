"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, QrCode } from "lucide-react";

// رمز QR لفضاء الأستاذ: يطبعه في الكراس أو يرسله لمجموعة أولياء القسم
export function TeacherQR({ path, teacherName, code }: { path: string; teacherName: string; code?: string | null }) {
  const [url, setUrl] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const full = `${window.location.origin}${path}`;
    setUrl(full);
    QRCode.toDataURL(full, { width: 512, margin: 2, errorCorrectionLevel: "M", color: { dark: "#064e3b", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* المتصفح يمنع النسخ */
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col sm:flex-row items-center gap-4">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`رمز QR لفضاء ${teacherName}`} className="w-36 h-36 rounded-xl border border-slate-100" />
      ) : (
        <div className="w-36 h-36 rounded-xl bg-slate-50 flex items-center justify-center">
          <QrCode className="w-10 h-10 text-slate-300" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2 text-center sm:text-right">
        <p className="text-sm font-extrabold text-slate-800">رمز QR لفضاء {teacherName}</p>
        <p className="text-[11px] text-slate-500">
          يمسحه الولي بكاميرا الهاتف لفتح دروس وواجبات ابنه مباشرة{code ? ` • أو يكتب الكود ${code}` : ""}.
        </p>
        <p className="text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg px-2 py-1 truncate" dir="ltr">
          {url}
        </p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button onClick={copy} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1">
            <Copy className="w-3.5 h-3.5" /> {copied ? "تم النسخ ✓" : "نسخ الرابط"}
          </button>
          {dataUrl && (
            <a
              href={dataUrl}
              download={`qr-${code || "teacher"}.png`}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> تحميل للطباعة
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
