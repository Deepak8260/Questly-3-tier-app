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
      font-family: Georgia, 'Times New Roman', serif;
      background: #14140F;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
      color: #F2F1EA;
    }
    .cert-card {
      width: 275mm; height: 190mm;
      background: #1C1C16;
      border: 2px solid #6B2737;
      padding: 40px 52px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      text-align: center; position: relative;
    }
    .header-sub {
      font-size: 10px; font-weight: 700; color: #B5677A;
      letter-spacing: 4px; text-transform: uppercase; margin-bottom: 2px;
    }
    .title {
      font-size: 32px; font-weight: 700; color: #F2F1EA;
      letter-spacing: 2px; text-transform: uppercase; margin: 8px 0 12px;
      font-family: Georgia, serif;
    }
    .divider {
      width: 80px; height: 2px; background: #6B2737; margin: 0 auto 16px;
    }
    .sub-text {
      font-size: 13px; color: #ABA99C; font-style: italic; margin-bottom: 6px;
    }
    .name {
      font-size: 34px; font-weight: 700; color: #F2F1EA;
      font-family: Georgia, serif; margin-bottom: 12px;
      border-bottom: 1px solid #35352C; display: inline-block; padding: 0 32px 6px;
    }
    .topic-desc {
      font-size: 13px; color: #ABA99C; margin-bottom: 4px;
    }
    .topic-name {
      font-size: 22px; font-weight: 700; color: #B5677A; margin-bottom: 20px;
    }

    .stats-bar {
      display: flex; align-items: center; gap: 24px;
      background: #262620; border: 1px solid #35352C;
      padding: 12px 28px; border-radius: 8px; margin-bottom: 20px;
    }
    .score-val {
      font-size: 36px; font-weight: 800; color: #7EBA88; line-height: 1;
    }
    .sep { width: 1px; height: 36px; background: #35352C; }
    .meta { text-align: left; font-size: 11px; color: #ABA99C; line-height: 1.5; }
    .meta strong { color: #F2F1EA; }

    .footer-bar {
      width: 100%; display: flex; align-items: flex-end; justify-content: space-between;
      padding-top: 16px; border-top: 1px solid #262620;
    }
    .sig-box { text-align: center; width: 180px; }
    .sig-text {
      font-family: Georgia, serif; font-style: italic;
      font-size: 16px; color: #B5677A; border-bottom: 1px solid #35352C;
      padding-bottom: 4px; margin-bottom: 4px;
    }
    .sig-lbl { font-size: 9px; font-weight: 600; color: #8C8B82; text-transform: uppercase; letter-spacing: 1px; }

    .cert-meta { font-family: monospace; font-size: 9px; color: #8C8B82; text-align: right; line-height: 1.6; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  <div class="cert-card">
    <div>
      <div class="header-sub">Questly Learning Platform</div>
      <div class="title">Certificate of Achievement</div>
      <div class="divider"></div>
    </div>

    <div>
      <div class="sub-text">This certifies that</div>
      <div class="name">${userName}</div>
      <div class="topic-desc">has successfully completed the assessment in</div>
      <div class="topic-name">${topic}</div>
    </div>

    <div class="stats-bar">
      <div class="score-val">${scorePct}%</div>
      <div class="sep"></div>
      <div class="meta">
        <div>Accuracy: <strong>${correctAnswers}/${totalQuestions} Correct</strong></div>
        <div>Difficulty: <strong>${diffLabel}</strong></div>
        <div>Status: <strong style="color:#7EBA88">Passed (≥70%)</strong></div>
      </div>
    </div>

    <div class="footer-bar">
      <div class="sig-box">
        <div class="sig-text">Questly Assessment Board</div>
        <div class="sig-lbl">Authorized Signature</div>
      </div>

      <div class="cert-meta">
        <div>Issued: ${formattedDate}</div>
        <div>Credential ID: ${certId}</div>
      </div>
    </div>
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
        backgroundColor: visible ? "rgba(18,18,14,0.85)" : "rgba(0,0,0,0)",
        backdropFilter: "blur(4px)",
        padding: "20px",
        overflowY: "auto",
        transition: "background-color 300ms ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 680,
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        border: "1px solid #35352C",
        borderRadius: 12,
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        backgroundColor: "#1C1C16",
        color: "#F2F1EA",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
        overflowY: "auto",
      }}>

        {/* Modal Top Bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid #262620",
          backgroundColor: "#14140F",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F2F1EA" }}>
            Certificate Preview
          </span>
          <button onClick={onClose} style={{
            width: 28, height: 28, border: "none",
            borderRadius: 6,
            background: "transparent", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#ABA99C",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#262620")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Certificate Preview Card */}
        <div style={{ padding: "20px", backgroundColor: "#14140F" }}>
          <div style={{
            backgroundColor: "#1C1C16",
            border: "2px solid #6B2737",
            borderRadius: 8,
            padding: "28px 32px 24px",
            textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
          }}>

            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#B5677A", letterSpacing: "3px", textTransform: "uppercase", marginBottom: 4 }}>
                QUESTLY LEARNING PLATFORM
              </div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: "#F2F1EA", letterSpacing: "1px", textTransform: "uppercase" }}>
                Certificate of Achievement
              </div>
              <div style={{ width: 60, height: 2, backgroundColor: "#6B2737", margin: "8px auto 0", borderRadius: 1 }} />
            </div>

            {/* Recipient info */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "#ABA99C", fontStyle: "italic", marginBottom: 4 }}>
                This certifies that
              </div>
              <div style={{
                fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: "#F2F1EA",
                margin: "4px 0 10px", borderBottom: "1px solid #35352C", display: "inline-block", padding: "0 24px 4px"
              }}>
                {userName}
              </div>
              <div style={{ fontSize: 12, color: "#ABA99C", marginBottom: 2 }}>
                has successfully completed the assessment in
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#B5677A" }}>
                {topic}
              </div>
            </div>

            {/* Stats Row */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 20,
              backgroundColor: "#262620", border: "1px solid #35352C",
              padding: "10px 24px", borderRadius: 8, marginBottom: 20
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#7EBA88", lineHeight: 1 }}>
                {scorePct}%
              </div>
              <div style={{ width: 1, height: 32, backgroundColor: "#35352C" }} />
              <div style={{ textAlign: "left", fontSize: 11, color: "#ABA99C", lineHeight: 1.4 }}>
                <div>Accuracy: <strong style={{ color: "#F2F1EA" }}>{correctAnswers}/{totalQuestions} Correct</strong></div>
                <div>Difficulty: <strong style={{ color: "#F2F1EA" }}>{diffLabel}</strong></div>
                <div>Status: <strong style={{ color: "#7EBA88" }}>Passed (≥70%)</strong></div>
              </div>
            </div>

            {/* Footer Row */}
            <div style={{
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              width: "100%", paddingTop: 14, borderTop: "1px solid #262620"
            }}>
              <div style={{ textAlign: "center", width: 160 }}>
                <div style={{
                  fontFamily: "Georgia, serif", fontStyle: "italic",
                  fontSize: 14, color: "#B5677A", borderBottom: "1px solid #35352C",
                  paddingBottom: 2, marginBottom: 2
                }}>
                  Questly Assessment Board
                </div>
                <div style={{ fontSize: 8, fontWeight: 600, color: "#8C8B82", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Authorized Signature
                </div>
              </div>

              <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 9, color: "#8C8B82", lineHeight: 1.5 }}>
                <div>Issued: {formattedDate}</div>
                <div>ID: {certId}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{
          display: "flex", gap: 10, padding: "14px 20px",
          borderTop: "1px solid #262620", backgroundColor: "#14140F",
          position: "sticky", bottom: 0, zIndex: 10
        }}>
          <button onClick={handleDownload} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, backgroundColor: "#6B2737", color: "#fff", border: "none",
            borderRadius: 8, padding: "11px 0", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#551F2C")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#6B2737")}
          >
            <Download size={16} /> Download Official Certificate (PDF)
          </button>
          <button onClick={onClose} style={{
            padding: "11px 24px", background: "#262620", border: "1px solid #35352C",
            borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#F2F1EA",
            cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#35352C")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#262620")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
