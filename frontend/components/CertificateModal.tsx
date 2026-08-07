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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    setTimeout(() => setVisible(true), 10);
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(props.onClose, 300);
  };

  if (!mounted) return null;
  return createPortal(<ModalContent {...props} onClose={handleClose} visible={visible} />, document.body);
}

function ModalContent({
  topic, scorePct, correctAnswers, totalQuestions,
  difficulty, userName, earnedAt, certId, onClose,
  visible,
}: CertificateModalProps & { visible: boolean }) {
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
      background: #F5F4F0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
    }
    .cert {
      width: 270mm; height: 190mm;
      border: 8px solid #6B2737;
      background: linear-gradient(135deg,#F3E7E9 0%,#ffffff 55%,#FAFAF8 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 40px 80px; position: relative;
    }
    .ring { position:absolute; border-radius:50%; border:3px solid #6B2737; opacity:.1; }
    .badge  { font-size:64px; margin-bottom:10px; }
    .issuer { font-size:9px; color:#6B2737; font-weight:900; letter-spacing:5px; text-transform:uppercase; margin-bottom:14px; }
    .title  { font-size:34px; font-weight:bold; color:#1B1B18; }
    .bar    { width:72px; height:3px; background:#6B2737; margin:12px auto; border-radius:2px; }
    .sub    { font-size:13px; color:#5B5A52; margin-bottom:6px; }
    .name   { font-size:32px; color:#6B2737; font-style:italic; margin-bottom:10px; font-weight:bold; }
    .body   { font-size:14px; color:#5B5A52; margin-bottom:4px; }
    .topic  { font-size:20px; font-weight:bold; color:#1B1B18; margin:4px 0 18px; }
    .row    { display:flex; align-items:center; gap:24px; margin-bottom:22px; }
    .score  { font-size:52px; font-weight:900; color:#2F6B3A; line-height:1; }
    .sep    { width:1px; height:50px; background:#DEDCD3; }
    .mc     { text-align:left; }
    .ml     { font-size:10px; color:#8C8B82; }
    .mv     { font-size:14px; font-weight:700; color:#1B1B18; }
    .footer { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; width:100%; padding-top:14px; border-top:1px solid #DEDCD3; font-size:11px; color:#5B5A52; text-align:center; }
    .cid    { font-family:monospace; font-size:9px; color:#8C8B82; margin-top:10px; }
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
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 400);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: visible ? "rgba(28,28,22,0.85)" : "rgba(0,0,0,0)",
        backdropFilter: "blur(4px)",
        padding: "16px",
        overflowY: "auto",
        transition: "background-color 300ms ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 640,
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        border: "1px solid #DEDCD3",
        borderRadius: 12,
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        backgroundColor: "#ffffff",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease-out, transform 300ms ease-out",
        overflowY: "auto",
      }}>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #DEDCD3",
          backgroundColor: "#FAFAF8",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1B1B18" }}>
            Certificate Preview
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, border: "none",
            background: "transparent", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#8C8B82",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#EAE8E1")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "14px 14px 0", backgroundColor: "#FAFAF8" }}>
          <div style={{
            border: "5px solid #6B2737",
            background: "linear-gradient(135deg,#F3E7E9 0%,#ffffff 55%,#FAFAF8 100%)",
            padding: "18px 24px 16px",
            textAlign: "center", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position:"absolute", top:-20, left:-20, width:80, height:80,
              border:"2px solid #6B2737", borderRadius:"50%", opacity:0.1 }} />
            <div style={{ position:"absolute", bottom:-20, right:-20, width:65, height:65,
              border:"2px solid #6B2737", borderRadius:"50%", opacity:0.1 }} />
            <div style={{ fontSize:28, marginBottom:4 }}>🏆</div>
            <div style={{ fontSize:8, fontWeight:900, color:"#6B2737",
              letterSpacing:"3px", textTransform:"uppercase", marginBottom:6 }}>
              Questly · AI-Powered Learning Platform
            </div>
            <div style={{ fontSize:18, fontWeight:900, color:"#1B1B18", marginBottom:0 }}>
              Certificate of Achievement
            </div>
            <div style={{ width:48, height:2, background:"#6B2737",
              margin:"6px auto 8px", borderRadius:1 }} />
            <div style={{ fontSize:11, color:"#5B5A52", marginBottom:3 }}>This certifies that</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#6B2737",
              fontStyle:"italic", marginBottom:6 }}>
              {userName}
            </div>
            <div style={{ fontSize:11, color:"#5B5A52", marginBottom:2 }}>
              has successfully completed the quiz on
            </div>
            <div style={{ fontSize:15, fontWeight:900, color:"#1B1B18", marginBottom:10 }}>
              {topic}
            </div>
            <div style={{ display:"flex", alignItems:"center",
              justifyContent:"center", gap:16, marginBottom:12 }}>
              <div style={{ fontSize:34, fontWeight:900, color:"#2F6B3A", lineHeight:1 }}>
                {scorePct}%
              </div>
              <div style={{ width:1, height:36, background:"#DEDCD3" }} />
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:9, color:"#8C8B82" }}>Questions</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#1B1B18" }}>
                  {correctAnswers}/{totalQuestions} correct
                </div>
                <div style={{ fontSize:9, color:"#8C8B82", marginTop:3 }}>Difficulty</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#1B1B18" }}>{diffLabel}</div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6,
              borderTop:"1px solid #DEDCD3", paddingTop:8,
              fontSize:9, color:"#8C8B82", textAlign:"center" }}>
              <div>📅 {formattedDate}</div>
              <div>✅ Passing: ≥ 70%</div>
              <div>🎓 Verified by Questly</div>
            </div>
            <div style={{ fontFamily:"monospace", fontSize:8, color:"#8C8B82", marginTop:6 }}>
              {certId}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, padding:"12px 14px",
          borderTop:"1px solid #DEDCD3", backgroundColor:"#FAFAF8",
          position: "sticky", bottom: 0, zIndex: 10 }}>
          <button onClick={handleDownload} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            gap:6, backgroundColor:"#6B2737", color:"#fff", border:"none",
            borderRadius:8, padding:"8px 0", fontSize:13, fontWeight:600,
            cursor:"pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#551F2C")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#6B2737")}
          >
            <Download size={15} /> Download Certificate (PDF)
          </button>
          <button onClick={onClose} style={{
            padding:"8px 20px", background:"#fff", border:"1px solid #DEDCD3",
            borderRadius:8, fontSize:13, fontWeight:600, color:"#5B5A52",
            cursor:"pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FAFAF8")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
