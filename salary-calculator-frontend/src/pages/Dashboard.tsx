import { useState, useEffect, useRef } from "react";
import { calculateSalary } from "../api/salaryApi";
import { ADToBS } from "bikram-sambat-js";


// ─── Constants ───────────────────────────────────────────────────────────────
const NEPALI_MONTHS = [
  "बैशाख","जेठ","असार","साउन","भदौ","असोज",
  "कार्तिक","मंसिर","पुष","माघ","फागुन","चैत",
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface SalaryResult {
  basicEarned: number;
  allowanceEarned: number;
  employeePF: number;
  totalSalary: number;
  sst: number;
  netSalary: number;
}

interface PayslipData {
  engDate: string;
  nepDate: string;
  totalSalary: number;
  daysPresent: number;
  totalDays: number;
  maritalStatus: string;
  result: SalaryResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getNepaliDate(date = new Date()): string {
  try {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const bs = ADToBS(`${yyyy}-${mm}-${dd}`);
    const [year, month, day] = bs.split("-");
    return `${day} ${NEPALI_MONTHS[Number(month) - 1]} ${year}`;
  } catch { return "—"; }
}

function getEnglishDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// Currency: रू prefix (Nepali symbol) + digits in Playfair via span
function fmtNum(val: number): string {
  return val.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FmtAmount({ val, className = "" }: { val: number; className?: string }) {
  return (
    <span className={className}>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.78em", letterSpacing: "0.02em" }}>रू </span>
      <span>{fmtNum(val)}</span>
    </span>
  );
}

function fmtPDF(val: number): string {
  return "Rs. " + fmtNum(val); // ASCII-safe for jsPDF
}

// ─── PDF via jsPDF (reliable, no font-load issue) ────────────────────────────
function downloadPayslipPDF(entry: PayslipData) {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = () => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const W = 210;
    const margin = 20;
    const contentW = W - margin * 2;
    let y = 0;

    const gold = [180, 140, 40] as [number, number, number];
    const black = [20, 20, 20] as [number, number, number];
    const gray = [100, 100, 100] as [number, number, number];
    const lightGray = [160, 160, 160] as [number, number, number];
    const red = [192, 57, 43] as [number, number, number];
    const bgGold = [255, 250, 230] as [number, number, number];
    const bgLight = [248, 248, 248] as [number, number, number];
    

    // ── Header band ──
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 0, W, 42, "F");

    doc.setTextColor(...gold);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("NEPAL PAYROLL SYSTEM", margin, 13);

    doc.setTextColor(240, 236, 224);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("My Company", margin, 26);

    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("PAYROLL STATEMENT", margin, 34);

    // Dates top right
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(entry.engDate, W - margin, 18, { align: "right" });
    doc.setTextColor(...gold);
    doc.text(entry.nepDate, W - margin, 26, { align: "right" });

    y = 52;

    // ── Meta grid ──
    doc.setTextColor(...lightGray);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const metaLabels = ["MARITAL STATUS", "WORKING DAYS", "DAYS PRESENT", "ATTENDANCE"];
    const metaVals = [
      entry.maritalStatus.charAt(0).toUpperCase() + entry.maritalStatus.slice(1),
      String(entry.totalDays),
      String(entry.daysPresent),
      `${Math.round((entry.daysPresent / entry.totalDays) * 100)}%`,
    ];
    const colW = contentW / 4;
    metaLabels.forEach((lbl, i) => {
      const x = margin + i * colW;
      doc.setTextColor(...lightGray);
      doc.setFontSize(7);
      doc.text(lbl, x, y);
      doc.setTextColor(...black);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(metaVals[i], x, y + 7);
      doc.setFont("helvetica", "normal");
    });

    y += 18;

    // Gold divider
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 8;

    // ── Table header ──
    doc.setFillColor(...bgLight);
    doc.rect(margin, y - 4, contentW, 8, "F");
    doc.setTextColor(...lightGray);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("PARTICULARS", margin + 2, y + 1);
    doc.text("AMOUNT", W - margin - 2, y + 1, { align: "right" });
    y += 8;

    // ── Table rows ──
    const rows: { label: string; val: number; type: "earn" | "deduct" | "total" }[] = [
      { label: "Basic Salary Earned", val: entry.result.basicEarned, type: "earn" },
      { label: "Allowance Earned", val: entry.result.allowanceEarned, type: "earn" },
      { label: "Gross Earnings", val: entry.result.basicEarned + entry.result.allowanceEarned, type: "total" },
      { label: "Employee PF (10%)", val: entry.result.employeePF, type: "deduct" },
      { label: "SST Deduction (1%)", val: entry.result.sst, type: "deduct" },
      { label: "Total Deductions", val: entry.result.employeePF + entry.result.sst, type: "total" },
    ];

    rows.forEach((row) => {
      const isTotal = row.type === "total";
      const isDeduct = row.type === "deduct";

      if (isTotal) {
        doc.setFillColor(...bgLight);
        doc.rect(margin, y - 4, contentW, 9, "F");
      }

      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(isTotal ? 10 : 10);
      doc.setTextColor(...(isTotal ? black : isDeduct ? red : black));
      doc.text(row.label, margin + 2, y + 1);

      doc.setTextColor(...(isDeduct ? red : black));
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.text(fmtPDF(row.val), W - margin - 2, y + 1, { align: "right" });

      // Row separator
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 4, W - margin, y + 4);
      y += 10;
    });

    y += 4;

    // Gold divider
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.4);
    doc.line(margin, y, W - margin, y);
    y += 6;

    // ── Net Salary box ──
    doc.setFillColor(...bgGold);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, contentW, 16, 3, 3, "FD");

    doc.setTextColor(...black);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Net Salary (Receivable)", margin + 5, y + 10);

    doc.setFontSize(14);
    doc.setTextColor(140, 90, 10);
    doc.text(fmtPDF(entry.result.netSalary), W - margin - 5, y + 10, { align: "right" });

    y += 26;

    // ── Footer ──
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 6;
    doc.setTextColor(...lightGray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    // doc.text("Computer-generated payslip — no signature required.", W / 2, y, { align: "center" });

    // Page border accent
    doc.setDrawColor(...gold);
    doc.setLineWidth(2);
    doc.line(0, 0, 0, 297);

    doc.save(`payslip-${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  // Only add script if not already loaded
  if (!document.querySelector('script[src*="jspdf"]')) {
    document.head.appendChild(script);
  } else {
    script.onload?.(new Event("load"));
  }
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ result }: { result: SalaryResult }) {
  const total = result.totalSalary;
  const segments = [
    { label: "Basic", value: result.basicEarned, color: "#d4af37" },
    { label: "Allowance", value: result.allowanceEarned, color: "#7c9fd4" },
    { label: "Emp. PF", value: result.employeePF, color: "#8ecfb0" },
    { label: "SST", value: result.sst, color: "#f87171" },
    { label: "Net Take-Home", value: result.netSalary - result.employeePF, color: "#a78bfa" },
  ];

  const radius = 72; const cx = 92; const cy = 92;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const offset = circumference * (1 - cumulative);
    const dash = circumference * pct;
    cumulative += pct;
    return { ...seg, pct, offset, dash };
  });

  const [hovered, setHovered] = useState<number | null>(null);
  

  return (
    <div>
      <div className="donut-inner">
        <svg width="184" height="184" viewBox="0 0 184 184">
          <circle cx={cx} cy={cy} r={radius} fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
          {arcs.map((arc, i) => (
            <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
              stroke={arc.color}
              strokeWidth={hovered === i ? strokeWidth + 6 : strokeWidth}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="round"
              style={{
                transform: "rotate(-90deg)", transformOrigin: "92px 92px",
                transition: "stroke-width 0.2s ease, filter 0.2s ease",
                cursor: "pointer",
                filter: hovered === i ? `drop-shadow(0 0 10px ${arc.color})` : "none",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text x={cx} y={cy - 10} textAnchor="middle" fill="#f0ece0"
            style={{ fontFamily:"'Lora',serif", fontSize: 13, fontWeight: 600 }}>
            {hovered !== null ? arcs[hovered].label : "Net Salary"}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#d4af37"
            style={{ fontFamily:"'Lora',serif", fontSize: 12, fontWeight: 600 }}>
            {hovered !== null
              ? `${(arcs[hovered].pct * 100).toFixed(1)}%`
              : `Rs.${fmtNum(result.netSalary)}`}
          </text>
        </svg>

        <div className="donut-legend">
          {arcs.map((arc, i) => (
            <div key={i} className="legend-item"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered !== null && hovered !== i ? 0.3 : 1, transition: "opacity 0.2s" }}>
              <span className="legend-dot" style={{ background: arc.color }} />
              <span className="legend-label">{arc.label}</span>
              <span className="legend-val">
                <FmtAmount val={arc.value} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mini stat row */}
      <div className="insight-stats">
        {[
          { label: "Deduction Rate", val: `${(((result.employeePF + result.sst) / result.totalSalary) * 100).toFixed(1)}%`, color: "#f87171" },
          { label: "PF Contribution", val: `${(((result.employeePF * 2) / result.totalSalary) * 100).toFixed(1)}%`, color: "#8ecfb0" },
          { label: "Take-Home Rate", val: `${((result.netSalary / result.totalSalary) * 100).toFixed(1)}%`, color: "#d4af37" },
        ].map((s, i) => (
          <div key={i} className="insight-stat-card">
            <p className="insight-stat-val" style={{ color: s.color }}>{s.val}</p>
            <p className="insight-stat-label">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payslip Modal Preview ────────────────────────────────────────────────────
function PayslipModal({ entry, onClose }: { entry: PayslipData; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    downloadPayslipPDF(entry);
    setTimeout(() => setDownloading(false), 3500);
  };

  const rows = [
    { label: "Basic Salary Earned", val: entry.result.basicEarned, type: "earn" },
    { label: "Allowance Earned", val: entry.result.allowanceEarned, type: "earn" },
    { label: "Gross Earnings", val: entry.result.basicEarned + entry.result.allowanceEarned, type: "total" },
    { label: "Employee PF (10%)", val: entry.result.employeePF, type: "deduct" },
    { label: "SST (1%)", val: entry.result.sst, type: "deduct" },
    { label: "Total Deductions", val: entry.result.employeePF + entry.result.sst, type: "total" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-actions">
          <button className="download-btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? "⏳ Generating..." : "⬇ Download PDF"}
          </button>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="payslip">
          <div className="payslip-header">
            <div>
              <h2 className="payslip-company">My Company</h2>
              <p className="payslip-sub">Payroll Statement</p>
            </div>
            <div className="payslip-dates">
              <p>{entry.engDate}</p>
              <p style={{ color: "#d4af37" }}>{entry.nepDate}</p>
            </div>
          </div>
          <div className="payslip-divider" />
          <div className="payslip-meta">
            {[
              { label: "Marital Status", val: entry.maritalStatus.charAt(0).toUpperCase() + entry.maritalStatus.slice(1) },
              { label: "Working Days", val: String(entry.totalDays) },
              { label: "Days Present", val: String(entry.daysPresent) },
              { label: "Attendance", val: `${Math.round((entry.daysPresent / entry.totalDays) * 100)}%` },
            ].map((m, i) => (
              <div key={i} className="payslip-meta-item">
                <span className="payslip-meta-label">{m.label}</span>
                <span className="payslip-meta-val">{m.val}</span>
              </div>
            ))}
          </div>
          <div className="payslip-divider" />
          <div className="payslip-table">
            <div className="payslip-row header-row"><span>Particulars</span><span>Amount</span></div>
            {rows.map((row, i) => (
              <div key={i} className={`payslip-row ${row.type}-row`}>
                <span>{row.label}</span>
                <span className={row.type === "deduct" ? "deduct-val" : ""}>
                  <FmtAmount val={row.val} />
                </span>
              </div>
            ))}
          </div>
          <div className="payslip-net">
            <span>Net Salary (Receivable)</span>
            <FmtAmount val={entry.result.netSalary} />
          </div>
          {/* <div className="payslip-footer">Computer-generated payslip — no signature required.</div> */}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [form, setForm] = useState({
    totalSalary: 70000, totalDays: 30, daysPresent: 28, maritalStatus: "single",
  });
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [engDate, setEngDate] = useState("");
  const [nepDate, setNepDate] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"calculator" | "insights">("calculator");
  const [payslipEntry, setPayslipEntry] = useState<PayslipData | null>(null);
  const lastEntry = useRef<PayslipData | null>(null);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setEngDate(getEnglishDate());
    setNepDate(getNepaliDate());
    setMounted(true);
  }, []);

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  setForm({ ...form, [e.target.name]: e.target.value });
  setValidationError("");
};

useEffect(() => {
  if (Number(form.daysPresent) > Number(form.totalDays)) {
    setValidationError("Days present cannot exceed total working days.");
  } else {
    setValidationError("");
  }
}, [form.daysPresent, form.totalDays]);

  const handleCalculate = async () => {
    if (Number(form.daysPresent) > Number(form.totalDays)) {
      setValidationError("Days present cannot exceed total working days.");
      return;
    }
    setValidationError("");
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        totalSalary: Number(form.totalSalary), totalDays: Number(form.totalDays),
        daysPresent: Number(form.daysPresent), maritalStatus: form.maritalStatus,
        basicPercent: 70, allowancePercent: 30, pfEmployeePercent: 10,
        pfEmployerPercent: 10, sstPercent: 1,
      };
      
      const res = await calculateSalary(payload);
      setResult(res);
      const entry: PayslipData = {
        engDate: getEnglishDate(), nepDate: getNepaliDate(),
        totalSalary: Number(form.totalSalary), daysPresent: Number(form.daysPresent),
        totalDays: Number(form.totalDays), maritalStatus: form.maritalStatus, result: res,
      };
      lastEntry.current = entry;
    } catch (err) {
      console.error("Calculation failed", err);
      alert("Failed to calculate salary. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const attendancePct = Math.round((Number(form.daysPresent) / Number(form.totalDays)) * 100) || 0;

  return (
    <>
      <style>{`
     @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
/* font-family: 'Lora', serif */

        
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0b0f1a; font-family: 'DM Sans', sans-serif; }

        .page {
          min-height: 100vh;
          background: radial-gradient(ellipse 80% 60% at 20% 0%, #1a2744 0%, transparent 60%),
                      radial-gradient(ellipse 60% 50% at 80% 100%, #1a1a2e 0%, transparent 60%),
                      #0b0f1a;
          padding: 40px 24px 80px;
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .page.mounted { opacity: 1; transform: translateY(0); }
        .container { max-width: 820px; margin: 0 auto; }

        .header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid rgba(212,175,55,0.12); }
        .eyebrow { font-size: 10px; font-weight: 500; letter-spacing: 0.25em; text-transform: uppercase; color: #d4af37; margin-bottom: 8px; opacity: 0.8; }
        .title { font-family: 'Lora', serif; font-size: clamp(30px,5vw,46px); font-weight: 400; color: #f0ece0; line-height: 1.1; }
        .title span { color: #d4af37; font-weight: 700; }

        .date-stack { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .date-pill { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 100px; padding: 8px 16px; backdrop-filter: blur(12px); transition: border-color 0.3s; }
        .date-pill:hover { border-color: rgba(212,175,55,0.25); }
        .date-micro { font-size: 9px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(212,175,55,0.5); line-height: 1; margin-bottom: 2px; }
        .date-main { font-size: 12px; color: rgba(240,236,224,0.85); line-height: 1; }
        .date-main.nep { color: rgba(212,175,55,0.9); }

        .tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 4px; margin-bottom: 36px; width: fit-content; }
        .tab-btn { padding: 10px 28px; border: none; border-radius: 9px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.04em; transition: all 0.25s ease; background: transparent; color: rgba(240,236,224,0.4); }
        .tab-btn.active { background: linear-gradient(135deg, #b8922a, #d4af37); color: #0b0f1a; box-shadow: 0 2px 12px rgba(212,175,55,0.25); }
        .tab-btn:not(.active):hover { color: rgba(240,236,224,0.8); }

        .section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(212,175,55,0.6); margin-bottom: 20px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field-label { font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(240,236,224,0.4); }
        .field input, .field select { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 15px; color: #f0ece0; outline: none; transition: all 0.25s ease; width: 100%; -webkit-appearance: none; }
        .field input:focus, .field select:focus { border-color: rgba(212,175,55,0.5); background: rgba(212,175,55,0.04); box-shadow: 0 0 0 3px rgba(212,175,55,0.06); }
        .field select option { background: #141824; color: #f0ece0; }

        .attendance-bar-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; transition: all 0.25s ease; }
        .attendance-bar-wrap:focus-within { border-color: rgba(212,175,55,0.5); background: rgba(212,175,55,0.04); }
        .attendance-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .attendance-pct { font-family: 'Lora', serif; font-size: 20px; font-weight: 600; color: #d4af37; }
        .attendance-track { height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
        .attendance-fill { height: 100%; background: linear-gradient(90deg, #b8922a, #d4af37, #e8cc6a); border-radius: 99px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
        .calc-btn { width: 100%; padding: 16px; border: none; border-radius: 12px; background: linear-gradient(135deg, #b8922a 0%, #d4af37 50%, #c9a227 100%); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #0b0f1a; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 24px rgba(212,175,55,0.2); position: relative; overflow: hidden; }
        .calc-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent); opacity: 0; transition: opacity 0.2s; }
        .calc-btn:hover:not(:disabled)::after { opacity: 1; }
        .calc-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(212,175,55,0.35); }
        .calc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .spinner { width: 14px; height: 14px; border: 2px solid rgba(11,15,26,0.3); border-top-color: #0b0f1a; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .results-divider { display: flex; align-items: center; gap: 16px; margin: 36px 0 24px; }
        .divider-line { flex: 1; height: 1px; background: rgba(212,175,55,0.12); }
        .divider-label { font-size: 10px; font-weight: 500; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(212,175,55,0.5); }

        .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .result-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; animation: slideUp 0.5s ease both; transition: border-color 0.3s ease, transform 0.2s ease; }
        .result-card:hover { border-color: rgba(212,175,55,0.2); transform: translateY(-2px); }
        .result-card.col-span-2 { grid-column: span 2; }
        .result-card.accent-card { background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05)); border-color: rgba(212,175,55,0.3); position: relative; overflow: hidden; }
        .result-card.accent-card::before { content: ''; position: absolute; top: -40px; right: -40px; width: 100px; height: 100px; background: radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%); pointer-events: none; }
        .result-card.danger-card { background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.15); }
        .result-label { font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(240,236,224,0.35); margin-bottom: 10px; }
        .result-value { font-family: 'Lora', serif; font-size: 22px; font-weight: 600; color: #f0ece0; }
        .result-value.gold { color: #d4af37; font-size: 28px; }
        .result-value.red { color: #f87171; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .payslip-trigger { width: 100%; padding: 13px; border-radius: 12px; background: transparent; border: 1px solid rgba(212,175,55,0.3); font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #d4af37; cursor: pointer; transition: all 0.2s ease; margin-bottom: 8px; }
        .payslip-trigger:hover { background: rgba(212,175,55,0.06); border-color: rgba(212,175,55,0.6); transform: translateY(-1px); }

        /* Insights tab */
        .insights-wrap { animation: slideUp 0.4s ease both; }
        .insights-empty { text-align: center; padding: 70px 20px; color: rgba(240,236,224,0.2); }
        .insights-empty-icon { font-size: 40px; margin-bottom: 12px; }
        .insights-empty-text { font-size: 14px; margin-bottom: 6px; color: rgba(240,236,224,0.3); }
        .insights-empty-sub { font-size: 12px; color: rgba(240,236,224,0.15); }

        .insights-section-title { font-size: 13px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(212,175,55,0.65); margin-bottom: 24px; }

        .donut-inner { display: flex; align-items: center; gap: 36px; flex-wrap: wrap; padding: 8px 0 28px; }
        .donut-legend { display: flex; flex-direction: column; gap: 14px; flex: 1; min-width: 200px; }
        .legend-item { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .legend-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { font-size: 13px; color: rgba(240,236,224,0.6); flex: 1; }
        .legend-val { font-family: 'Lora', serif; font-size: 16px; font-weight: 600; color: #f0ece0; }

        .insight-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 4px; }
        .insight-stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; text-align: center; transition: transform 0.2s, border-color 0.3s; }
        .insight-stat-card:hover { transform: translateY(-2px); border-color: rgba(212,175,55,0.2); }
        .insight-stat-val { font-family: 'Lora', serif; font-size: 26px; font-weight: 700; margin-bottom: 6px; }
        .insight-stat-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(240,236,224,0.35); }

        /* Modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-box { background: #0f1524; border: 1px solid rgba(212,175,55,0.2); border-radius: 20px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.3s ease; }
        .modal-actions { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
        .download-btn { padding: 11px 22px; background: linear-gradient(135deg, #b8922a, #d4af37); border: none; border-radius: 9px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.06em; color: #0b0f1a; cursor: pointer; transition: all 0.2s; }
        .download-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(212,175,55,0.3); }
        .download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .close-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(240,236,224,0.6); font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .close-btn:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.3); color: #f87171; }

        .payslip { padding: 28px; }
        .payslip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .payslip-company { font-family: 'Lora', serif; font-size: 22px; font-weight: 700; color: #f0ece0; margin-bottom: 4px; }
        .payslip-sub { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(212,175,55,0.6); }
        .payslip-dates { text-align: right; font-size: 12px; color: rgba(240,236,224,0.6); line-height: 1.8; }
        .payslip-divider { height: 1px; background: rgba(212,175,55,0.15); margin: 16px 0; }
        .payslip-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
        .payslip-meta-item { display: flex; flex-direction: column; gap: 3px; }
        .payslip-meta-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(240,236,224,0.3); }
        .payslip-meta-val { font-size: 14px; color: #f0ece0; font-weight: 500; }
        .payslip-table { margin: 8px 0; }
        .payslip-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(240,236,224,0.8); }
        .payslip-row.header-row { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(212,175,55,0.5); border-bottom: 1px solid rgba(212,175,55,0.15); }
        .payslip-row.total-row { font-weight: 600; color: #f0ece0; background: rgba(212,175,55,0.04); padding: 10px 6px; border-radius: 6px; border-bottom: none; margin: 4px 0; }
        .deduct-val { color: #f87171; }
        .payslip-net { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 16px 18px; background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05)); border: 1px solid rgba(212,175,55,0.3); border-radius: 12px; font-family: 'Lora', serif; font-size: 18px; font-weight: 700; color: #d4af37; }
        .payslip-footer { margin-top: 20px; text-align: center; font-size: 11px; color: rgba(240,236,224,0.2); font-style: italic; }

        @media (max-width: 560px) {
          .form-grid, .results-grid, .payslip-meta, .insight-stats { grid-template-columns: 1fr; }
          .result-card.col-span-2 { grid-column: span 1; }
          .date-stack { align-items: flex-start; }
          .header { flex-direction: column; }
          .donut-inner { justify-content: center; }
        }
      `}</style>

      <div className={`page ${mounted ? "mounted" : ""}`}>
        <div className="container">

          {/* Header */}
          <div className="header">
            <div>
              <p className="eyebrow">Nepal Payroll System</p>
              <h1 className="title">Salary <span>Calculator</span></h1>
            </div>
            <div className="date-stack">
              <div className="date-pill">
                <span>📅</span>
                <div><p className="date-micro">English</p><p className="date-main">{engDate || "Loading..."}</p></div>
              </div>
              <div className="date-pill">
                <span>🗓</span>
                <div><p className="date-micro">नेपाली मिति</p><p className="date-main nep">{nepDate || "Loading..."}</p></div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab-btn ${activeTab === "calculator" ? "active" : ""}`}
              onClick={() => setActiveTab("calculator")}>Calculator</button>
            <button className={`tab-btn ${activeTab === "insights" ? "active" : ""}`}
              onClick={() => setActiveTab("insights")}>
              Insights {!result && ""}
            </button>
          </div>

          {/* ── Calculator Tab ── */}
          {activeTab === "calculator" && (
            <>
              <p className="section-label">Employee Details</p>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label">Total Salary (रू)</label>
                  <input type="number" name="totalSalary" value={form.totalSalary} onChange={handleChange} />
                </div>
                <div className="field">
                  <label className="field-label">Marital Status</label>
                  <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange}>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Total Working Days</label>
                  <input type="number" name="totalDays" value={form.totalDays} onChange={handleChange} />
                </div>
                <div className="field">
                  <label className="field-label">Days Present</label>
                  <div className="attendance-bar-wrap">
                    <div className="attendance-top">
                      <input type="number" name="daysPresent" value={form.daysPresent} onChange={handleChange}
                        style={{ background:"none", border:"none", outline:"none", color:"#f0ece0", fontSize:"15px", fontFamily:"'DM Sans',sans-serif", width:"60px", padding:0 }} />
                      <span className="attendance-pct">{attendancePct}%</span>
                    </div>
                    <div className="attendance-track">
                      <div className="attendance-fill" style={{ width: `${attendancePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {validationError && (
                <div style={{
                  marginBottom: 12,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  ⚠️ {validationError}
                </div>
              )}

              <button className="calc-btn" onClick={handleCalculate} disabled={loading}>
                <span className="btn-inner">
                  {loading && <span className="spinner" />}
                  {loading ? "Computing..." : "Calculate Salary"}
                </span>
              </button>

              {result && (
                <>
                  <div className="results-divider">
                    <div className="divider-line" /><span className="divider-label">Breakdown</span><div className="divider-line" />
                  </div>
                  <div className="results-grid">
                    {[
                      { label: "Basic Earned", val: result.basicEarned, d: 0 },
                      { label: "Allowance Earned", val: result.allowanceEarned, d: 60 },
                      { label: "Employee PF (10%)", val: result.employeePF, d: 120 },
                      { label: "Total PF (Emp + Employer)", val: result.employeePF * 2, d: 180 },
                    ].map((c, i) => (
                      <div key={i} className="result-card" style={{ animationDelay: `${c.d}ms` }}>
                        <p className="result-label">{c.label}</p>
                        <p className="result-value"><FmtAmount val={c.val} /></p>
                      </div>
                    ))}
                    <div className="result-card col-span-2" style={{ animationDelay: "240ms" }}>
                      <p className="result-label">Gross Salary</p>
                      <p className="result-value"><FmtAmount val={result.totalSalary} /></p>
                    </div>
                    <div className="result-card danger-card" style={{ animationDelay: "300ms" }}>
                      <p className="result-label">SST Deduction (1%)</p>
                      <p className="result-value red"><FmtAmount val={result.sst} /></p>
                    </div>
                    <div className="result-card accent-card" style={{ animationDelay: "360ms" }}>
                      <p className="result-label">Net Salary — Receivable</p>
                      <p className="result-value gold"><FmtAmount val={result.netSalary} /></p>
                    </div>
                  </div>

                  <button className="payslip-trigger"
                    onClick={() => lastEntry.current && setPayslipEntry(lastEntry.current)}>
                    🧾 Generate Payslip PDF
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Insights Tab ── */}
          {activeTab === "insights" && (
            <div className="insights-wrap">
              {!result ? (
                <div className="insights-empty">
                  <div className="insights-empty-icon">📊</div>
                  <p className="insights-empty-text">No data yet</p>
                  <p className="insights-empty-sub">Calculate a salary first to see your visual breakdown here.</p>
                </div>
              ) : (
                <>
                  <p className="insights-section-title">Visual Breakdown</p>
                  <DonutChart result={result} />
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {payslipEntry && (
        <PayslipModal entry={payslipEntry} onClose={() => setPayslipEntry(null)} />
      )}
    </>
  );
}