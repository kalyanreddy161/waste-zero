import React, { useEffect, useRef } from "react";
import ActionButton, { ActionGlyph } from "./ActionButton";
import useDialogTransition from "./useDialogTransition";

const COLORS = ["#08C18A", "#0F172A", "#22D3EE", "#F59E0B", "#10B981", "#1E293B"];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function useConfetti(open) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!open) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
      particlesRef.current = [];
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    particlesRef.current = Array.from({ length: 80 }, () => ({
      x: randomBetween(canvas.width * 0.24, canvas.width * 0.76),
      y: canvas.height * 0.26,
      r: randomBetween(4, 8),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: randomBetween(-4.5, 4.5),
      vy: randomBetween(-9, -2),
      gravity: 0.24,
      rotation: randomBetween(0, Math.PI * 2),
      rotationVelocity: randomBetween(-0.12, 0.12),
      alpha: 1,
      shape: Math.random() < 0.5 ? "rect" : "circle",
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy + particle.gravity,
          vy: particle.vy + particle.gravity,
          rotation: particle.rotation + particle.rotationVelocity,
          alpha: particle.alpha - 0.012,
        }))
        .filter((particle) => particle.alpha > 0);

      particlesRef.current.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);

        if (particle.shape === "rect") {
          ctx.fillRect(-particle.r, -particle.r / 2, particle.r * 2, particle.r);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, particle.r / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(render);
      }
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [open]);

  return canvasRef;
}

export default function CongratulationsDialog({
  open,
  co2Saved,
  onClose,
  onGoToStats,
}) {
  const { isMounted, isVisible } = useDialogTransition(open, 240);
  const canvasRef = useConfetti(isMounted && isVisible);
  const safeCo2Saved = Number(co2Saved || 0);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "var(--overlay-scrim)",
        backdropFilter: "blur(10px)",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 240ms ease",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(520px, 100%)",
          background: "linear-gradient(180deg, var(--surface-primary), var(--surface-secondary))",
          borderRadius: "30px",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-strong)",
          transform: isVisible ? "scale(1)" : "scale(0)",
          opacity: isVisible ? 1 : 0,
          transition: "transform 240ms cubic-bezier(.2,.85,.32,1.1), opacity 240ms ease",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "30px",
            display: "grid",
            gap: "24px",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderRadius: "24px",
              background:
                "linear-gradient(135deg, rgba(8, 193, 138, 0.96), rgba(5, 150, 105, 0.92))",
              color: "#ffffff",
              display: "grid",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "74px",
                height: "74px",
                borderRadius: "24px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
              }}
            >
              <ActionGlyph icon="pickup" />
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  fontWeight: 700,
                  opacity: 0.86,
                }}
              >
                Pickup completed
              </span>
              <h2 style={{ margin: 0, fontSize: "30px", lineHeight: 1.08 }}>
                Congratulations
              </h2>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.7, maxWidth: "36ch", color: "rgba(255,255,255,0.92)" }}>
                Your pickup has been marked as completed successfully. WasteZero
                has already updated your impact data.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "18px",
              alignItems: "stretch",
              padding: "18px 20px",
              borderRadius: "24px",
              border: "1px solid var(--border-color)",
              background: "var(--surface-primary)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <div style={{ display: "grid", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                }}
              >
                Carbon impact saved
              </span>
              <strong
                style={{
                  fontSize: "34px",
                  lineHeight: 1,
                  color: "var(--text-primary)",
                }}
              >
                {safeCo2Saved.toFixed(2)} <span style={{ fontSize: "15px", color: "var(--text-secondary)" }}>kg CO2</span>
              </strong>
            </div>

            <div
              style={{
                width: "84px",
                minHeight: "84px",
                borderRadius: "24px",
                display: "grid",
                placeItems: "center",
                background: "rgba(8, 193, 138, 0.12)",
                color: "var(--primary)",
              }}
            >
              <ActionGlyph icon="chart" />
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ActionButton
              type="button"
              icon="close"
              tone="neutral"
              minWidth={150}
              onClick={onClose}
            >
              Close
            </ActionButton>
            <ActionButton
              type="button"
              icon="chart"
              tone="primary"
              minWidth={190}
              onClick={onGoToStats}
            >
              Go to Statistics
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
