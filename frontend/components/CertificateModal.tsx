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
  const formattedDate = new Date().toLocaleDateString("en-US", {
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
      background: #0E0E0B;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
      color: #F2F1EA;
    }
    .cert-outer {
      width: 277mm; height: 192mm;
      background: #14140F;
      border: 4px solid #6B2737;
      padding: 10px;
      position: relative;
    }
    .cert-inner {
      width: 100%; height: 100%;
      background: #1C1C16;
      border: 1.5px solid #D4A94A;
      padding: 30px 40px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      text-align: center; position: relative;
    }
    .corner { position: absolute; font-size: 14px; color: #D4A94A; font-family: serif; }
    .tl { top: 6px; left: 10px; }
    .tr { top: 6px; right: 10px; }
    .bl { bottom: 6px; left: 10px; }
    .br { bottom: 6px; right: 10px; }

    .badge-tag {
      font-size: 9px; font-weight: 800; color: #D4A94A;
      letter-spacing: 4px; text-transform: uppercase; margin-bottom: 2px;
    }
    .issuer {
      font-size: 11px; font-weight: 700; color: #B5677A;
      letter-spacing: 2px; text-transform: uppercase;
    }
    .title {
      font-size: 28px; font-weight: 700; color: #F2F1EA;
      letter-spacing: 2px; text-transform: uppercase; margin: 6px 0 4px;
      font-family: Georgia, serif;
    }
    .line { width: 100px; height: 2px; background: #D4A94A; margin: 4px auto 10px; }

    .sub { font-size: 12px; color: #ABA99C; font-style: italic; margin-bottom: 4px; }
    .name {
      font-size: 30px; font-weight: 700; color: #D4A94A;
      font-family: Georgia, serif; margin-bottom: 6px;
      border-bottom: 1px solid #6B2737; display: inline-block; padding: 0 24px 4px;
    }
    .topic-sub { font-size: 12px; color: #ABA99C; margin-bottom: 2px; }
    .topic-val { font-size: 18px; font-weight: 700; color: #F2F1EA; margin-bottom: 12px; }

    .stats-grid {
      display: flex; align-items: center; justify-content: center; gap: 24px;
      background: #262620; border: 1px solid #35352C;
      padding: 10px 24px; border-radius: 8px; margin-bottom: 12px; width: 100%; max-width: 520px;
    }
    .score-num { font-size: 32px; font-weight: 800; color: #7EBA88; line-height: 1; }
    .stat-sep { width: 1px; height: 32px; background: #35352C; }
    .stat-box { text-align: left; font-size: 11px; color: #ABA99C; line-height: 1.4; }
    .stat-box strong { color: #F2F1EA; }

    .footer-row {
      width: 100%; display: flex; align-items: flex-end; justify-content: space-between;
      padding-top: 10px; border-top: 1px solid #262620;
    }
    .sig-col { text-align: center; width: 150px; }
    .sig-text {
      font-family: Georgia, serif; font-style: italic;
      font-size: 14px; color: #B5677A; border-bottom: 1px solid #5B5A52;
      padding-bottom: 2px; margin-bottom: 2px;
    }
    .sig-label { font-size: 8px; font-weight: 600; color: #8C8B82; text-transform: uppercase; letter-spacing: 1px; }

    .seal-circle {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1.5px solid #D4A94A; background: #6B2737; color: #D4A94A;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-size: 6px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
    }

    .cert-info { font-family: monospace; font-size: 8px; color: #8C8B82; text-align: right; line-height: 1.5; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  <div class="cert-outer">
    <div class="cert-inner">
      <div class="corner tl">❖</div>
      <div class="corner tr">❖</div>
      <div class="corner bl">❖</div>
      <div class="corner br">❖</div>

      <div>
        <div class="badge-tag">Official Academic Credential</div>
        <div class="issuer">Questly Assessment Board</div>
        <div class="title">Certificate of Achievement</div>
        <div class="line"></div>
      </div>

      <div>
        <div class="sub">This certifies that</div>
        <div class="name">${userName}</div>
        <div class="topic-sub">has successfully completed the assessment in</div>
        <div class="topic-val">${topic}</div>
      </div>

      <div class="stats-grid">
        <div class="score-num">${scorePct}%</div>
        <div class="stat-sep"></div>
        <div class="stat-box">
          <div>Accuracy: <strong>${correctAnswers}/${totalQuestions} Correct</strong></div>
          <div>Difficulty: <strong>${diffLabel}</strong></div>
          <div>Status: <strong style="color:#7EBA88">Verified Pass (≥70%)</strong></div>
        </div>
      </div>

      <div class="footer-row">
        <div class="sig-col">
          <div class="sig-text">Questly AI Board</div>
          <div class="sig-label">Academic Director</div>
        </div>

        <div class="seal-circle">
          <span>★ ★ ★</span>
          <span>QUESTLY</span>
          <span style="font-size:5px">VERIFIED</span>
        </div>

        <div class="cert-info">
          <div>Issued: ${formattedDate}</div>
          <div>ID: ${certId}</div>
        </div>
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
        backgroundColor: visible ? "rgba(10,10,8,0.92)" : "rgba(0,0,0,0)",
        backdropFilter: "blur(6px)",
        padding: "16px",
        overflowY: "auto",
        transition: "background-color 300ms ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 660,
        maxHeight: "94vh",
        display: "flex", flexDirection: "column",
        border: "1px solid #35352C",
        borderRadius: 14,
        boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
        backgroundColor: "#14140F",
        color: "#F2F1EA",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
        overflowY: "auto",
      }}>

        {/* Modal Top Bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px",
          borderBottom: "1px solid #262620",
          backgroundColor: "#1C1C16",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F2F1EA" }}>
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

        {/* Certificate Card Content */}
        <div style={{ padding: "14px", backgroundColor: "#0E0E0B" }}>
          {/* Outer Border Frame */}
          <div style={{
            border: "4px solid #6B2737",
            backgroundColor: "#14140F",
            padding: "8px",
            position: "relative",
          }}>
            {/* Inner Border Frame */}
            <div style={{
              border: "1.5px solid #D4A94A",
              backgroundColor: "#1C1C16",
              padding: "24px 28px 18px",
              textAlign: "center",
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
            }}>
              {/* Corner Motifs */}
              <div style={{ position: "absolute", top: 4, left: 8, fontSize: 12, color: "#D4A94A" }}>❖</div>
              <div style={{ position: "absolute", top: 4, right: 8, fontSize: 12, color: "#D4A94A" }}>❖</div>
              <div style={{ position: "absolute", bottom: 4, left: 8, fontSize: 12, color: "#D4A94A" }}>❖</div>
              <div style={{ position: "absolute", bottom: 4, right: 8, fontSize: 12, color: "#D4A94A" }}>❖</div>

              {/* Header */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#D4A94A", letterSpacing: "3px", textTransform: "uppercase", marginBottom: 2 }}>
                  OFFICIAL ACADEMIC CREDENTIAL
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#B5677A", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>
                  QUESTLY LEARNING PLATFORM
                </div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#F2F1EA", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Certificate of Achievement
                </div>
                <div style={{ width: 70, height: 2, backgroundColor: "#D4A94A", margin: "6px auto 0", borderRadius: 1 }} />
              </div>

              {/* Recipient */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#ABA99C", fontStyle: "italic", marginBottom: 2 }}>
                  This certifies that
                </div>
                <div style={{
                  fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700, color: "#D4A94A",
                  margin: "2px 0 6px", borderBottom: "1px solid #6B2737", display: "inline-block", padding: "0 20px 3px"
                }}>
                  {userName}
                </div>
                <div style={{ fontSize: 11, color: "#ABA99C", marginBottom: 2 }}>
                  has successfully completed the assessment in
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F2F1EA" }}>
                  {topic}
                </div>
              </div>

              {/* Stats Box */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 18,
                backgroundColor: "#262620", border: "1px solid #35352C",
                padding: "8px 20px", borderRadius: 8, marginBottom: 16
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#7EBA88", lineHeight: 1 }}>
                  {scorePct}%
                </div>
                <div style={{ width: 1, height: 28, backgroundColor: "#35352C" }} />
                <div style={{ textAlign: "left", fontSize: 10, color: "#ABA99C", lineHeight: 1.4 }}>
                  <div>Accuracy: <strong style={{ color: "#F2F1EA" }}>{correctAnswers}/{totalQuestions} Correct</strong></div>
                  <div>Difficulty: <strong style={{ color: "#F2F1EA" }}>{diffLabel}</strong></div>
                  <div>Status: <strong style={{ color: "#7EBA88" }}>Verified Pass (≥70%)</strong></div>
                </div>
              </div>

              {/* Footer Signatures & Official Emblem */}
              <div style={{
                display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                width: "100%", paddingTop: 10, borderTop: "1px solid #262620"
              }}>
                <div style={{ textAlign: "center", width: 130 }}>
                  <div style={{
                    fontFamily: "Georgia, serif", fontStyle: "italic",
                    fontSize: 13, color: "#B5677A", borderBottom: "1px solid #5B5A52",
                    paddingBottom: 2, marginBottom: 2
                  }}>
                    Questly AI Board
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 600, color: "#8C8B82", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Academic Director
                  </div>
                </div>

                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  border: "1.5px solid #D4A94A", backgroundColor: "#6B2737",
                  color: "#D4A94A", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 6, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase"
                }}>
                  <span style={{ fontSize: 5 }}>★ ★ ★</span>
                  <span>QUESTLY</span>
                  <span style={{ fontSize: 5 }}>SEAL</span>
                </div>

                <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 8, color: "#8C8B82", lineHeight: 1.4 }}>
                  <div>Issued: {formattedDate}</div>
                  <div>ID: {certId}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{
          display: "flex", gap: 10, padding: "12px 18px",
          borderTop: "1px solid #262620", backgroundColor: "#1C1C16",
          position: "sticky", bottom: 0, zIndex: 10
        }}>
          <button onClick={handleDownload} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, backgroundColor: "#6B2737", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#551F2C")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#6B2737")}
          >
            <Download size={16} /> Download Official Certificate (PDF)
          </button>
          <button onClick={onClose} style={{
            padding: "10px 22px", background: "#262620", border: "1px solid #35352C",
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
