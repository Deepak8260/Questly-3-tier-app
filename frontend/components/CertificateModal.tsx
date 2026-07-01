"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

interface CertificateModalProps {
  topic: string;
  scorePct: number;
  correctAnswers: number;
  totalQuestions: number;
  difficulty: string;
  userName: string;
  earnedAt: string;
  certId: string;
  onClose: () => void;
}

export default function CertificateModal(props: CertificateModalProps) {
  // Wait for client-side mount before using createPortal
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;
  return createPortal(<ModalContent {...props} />, document.body);
}

/* ─── The actual modal UI, rendered into document.body ─── */
function ModalContent({
  topic, scorePct, correctAnswers, totalQuestions,
  difficulty, userName, earnedAt, certId, onClose,
}: CertificateModalProps) {
  const formattedDate = new Date(earnedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  const handleDownload = () => {
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow popups for PDF download."); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Questly Certificate – ${topic}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: Georgia, serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
    }
    .cert {
      width: 270mm; height: 190mm;
      border: 10px solid #6366F1; border-radius: 12px;
      background: linear-gradient(135deg,#EEF2FF 0%,#fff 55%,#F5F3FF 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 40px 80px; position: relative;
    }
    .ring { position:absolute; border-radius:50%; border:3px solid #6366F1; opacity:.1; }
    .badge  { font-size:64px; margin-bottom:10px; }
    .issuer { font-size:9px; color:#6366F1; font-weight:900; letter-spacing:5px; text-transform:uppercase; margin-bottom:14px; }
    .title  { font-size:34px; font-weight:bold; color:#111827; }
    .bar    { width:72px; height:3px; background:#6366F1; margin:12px auto; border-radius:2px; }
    .sub    { font-size:13px; color:#6B7280; margin-bottom:6px; }
    .name   { font-size:32px; color:#6366F1; font-style:italic; margin-bottom:10px; }
    .body   { font-size:14px; color:#374151; margin-bottom:4px; }
    .topic  { font-size:20px; font-weight:bold; color:#111827; margin:4px 0 18px; }
    .row    { display:flex; align-items:center; gap:24px; margin-bottom:22px; }
    .score  { font-size:52px; font-weight:900; color:#059669; line-height:1; }
    .sep    { width:1px; height:50px; background:#E5E7EB; }
    .mc     { text-align:left; }
    .ml     { font-size:10px; color:#9CA3AF; }
    .mv     { font-size:14px; font-weight:700; color:#374151; }
    .footer { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; width:100%; padding-top:14px; border-top:1px solid #E5E7EB; font-size:11px; color:#6B7280; text-align:center; }
    .cid    { font-family:monospace; font-size:9px; color:#C4C9D4; margin-top:10px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  <div class="cert">
    <div class="ring" style="top:-24px;left:-24px;width:130px;height:130px"></div>
    <div class="ring" style="bottom:-24px;right:-24px;width:110px;height:110px"></div>
    <div class="badge">🏆</div>
    <div class="issuer">Questly · AI-Powered Learning Platform</div>
    <div class="title">Certificate of Achievement</div>
    <div class="bar"></div>
    <div class="sub">This certifies that</div>
    <div class="name">${userName}</div>
    <div class="body">has successfully completed the quiz on</div>
    <div class="topic">${topic}</div>
    <div class="row">
      <div class="score">${scorePct}%</div>
      <div class="sep"></div>
      <div class="mc">
        <div class="ml">Questions</div>
        <div class="mv">${correctAnswers} / ${totalQuestions} correct</div>
        <div class="ml" style="margin-top:6px">Difficulty</div>
        <div class="mv">${diffLabel}</div>
      </div>
    </div>
    <div class="footer">
      <div>📅 Issued: ${formattedDate}</div>
      <div>✅ Passing criteria: ≥ 70%</div>
      <div>🎓 Verified by Questly</div>
    </div>
    <div class="cid">${certId}</div>
  </div>
</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 700);
  };

  return (
    /* ── Backdrop — rendered directly in document.body via portal ── */
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.70)",
        backdropFilter: "blur(4px)",
        padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Modal — wide (landscape) ── */}
      <div style={{
        width: "100%", maxWidth: 760,
        display: "flex", flexDirection: "column",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        backgroundColor: "#ffffff",
      }}>

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid #F3F4F6",
          backgroundColor: "#ffffff",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            Certificate Preview
          </span>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#9CA3AF",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Landscape certificate (always light — print document) ── */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{
            border: "7px solid #6366F1", borderRadius: 12,
            background: "linear-gradient(135deg,#EEF2FF 0%,#ffffff 55%,#F5F3FF 100%)",
            padding: "28px 48px 24px",
            textAlign: "center", position: "relative", overflow: "hidden",
          }}>
            {/* Decorative rings */}
            <div style={{ position:"absolute", top:-20, left:-20, width:90, height:90,
              border:"3px solid #6366F1", borderRadius:"50%", opacity:0.1 }} />
            <div style={{ position:"absolute", bottom:-20, right:-20, width:75, height:75,
              border:"3px solid #6366F1", borderRadius:"50%", opacity:0.1 }} />

            {/* Trophy */}
            <div style={{ fontSize:36, marginBottom:6 }}>🏆</div>

            {/* Issuer */}
            <div style={{ fontSize:8, fontWeight:900, color:"#6366F1",
              letterSpacing:"4px", textTransform:"uppercase", marginBottom:10 }}>
              Questly · AI-Powered Learning Platform
            </div>

            {/* Title */}
            <div style={{ fontSize:22, fontWeight:900, color:"#111827", marginBottom:0 }}>
              Certificate of Achievement
            </div>

            {/* Divider */}
            <div style={{ width:60, height:3, background:"#6366F1",
              margin:"10px auto", borderRadius:2 }} />

            {/* Certifies that */}
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:5 }}>This certifies that</div>

            {/* Name */}
            <div style={{ fontSize:20, fontWeight:700, color:"#6366F1",
              fontStyle:"italic", marginBottom:8 }}>
              {userName}
            </div>

            {/* Body */}
            <div style={{ fontSize:12, color:"#374151", marginBottom:3 }}>
              has successfully completed the quiz on
            </div>
            <div style={{ fontSize:16, fontWeight:900, color:"#111827", marginBottom:14 }}>
              {topic}
            </div>

            {/* Score row */}
            <div style={{ display:"flex", alignItems:"center",
              justifyContent:"center", gap:20, marginBottom:16 }}>
              <div style={{ fontSize:42, fontWeight:900, color:"#059669", lineHeight:1 }}>
                {scorePct}%
              </div>
              <div style={{ width:1, height:44, background:"#E5E7EB" }} />
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:10, color:"#9CA3AF" }}>Questions</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>
                  {correctAnswers}/{totalQuestions} correct
                </div>
                <div style={{ fontSize:10, color:"#9CA3AF", marginTop:5 }}>Difficulty</div>
                <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{diffLabel}</div>
              </div>
            </div>

            {/* Footer strip */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8,
              borderTop:"1px solid #E5E7EB", paddingTop:12,
              fontSize:9, color:"#9CA3AF", textAlign:"center" }}>
              <div>📅 {formattedDate}</div>
              <div>✅ Passing: ≥ 70%</div>
              <div>🎓 Verified by Questly</div>
            </div>

            {/* Cert ID */}
            <div style={{ fontFamily:"monospace", fontSize:8, color:"#D1D5DB", marginTop:8 }}>
              {certId}
            </div>
          </div>
        </div>

        {/* ── Action footer ── */}
        <div style={{ display:"flex", gap:12, padding:"16px 20px",
          borderTop:"1px solid #F3F4F6", backgroundColor:"#F9FAFB", marginTop:20 }}>
          <button onClick={handleDownload} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            gap:8, backgroundColor:"#6366F1", color:"#fff", border:"none",
            borderRadius:12, padding:"10px 0", fontSize:14, fontWeight:600,
            cursor:"pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4F46E5")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#6366F1")}
          >
            <Download size={16} /> Download Certificate (PDF)
          </button>
          <button onClick={onClose} style={{
            padding:"10px 24px", background:"#fff", border:"1px solid #E5E7EB",
            borderRadius:12, fontSize:14, fontWeight:600, color:"#374151",
            cursor:"pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
