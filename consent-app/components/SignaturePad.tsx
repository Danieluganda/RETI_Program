"use client";

import { useRef, useState } from "react";
import { ImageUpload } from "./ImageUpload";

type SignaturePadProps = {
  label: string;
  valueName: string;
  onChange: (dataUrl: string, method: "drawn" | "upload") => void;
};

export function SignaturePad({ label, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"drawn" | "upload">("drawn");

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawing.current = true;
    const p = point(event);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;

    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() {
    const canvas = canvasRef.current;
    if (!drawing.current || !canvas) return;
    drawing.current = false;
    onChange(canvas.toDataURL("image/png"), "drawn");
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function clear() {
    clearCanvas();
    onChange("", mode);
  }

  function chooseMode(nextMode: "drawn" | "upload") {
    clearCanvas();
    setMode(nextMode);
    onChange("", nextMode);
  }

  function drawUploadedImage(dataUrl: string) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const image = new Image();
    image.addEventListener("load", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      onChange(dataUrl, "upload");
    });
    image.src = dataUrl;
  }

  return (
    <div>
      <div className="toolbar">
        <strong>{label}</strong>
        <button className="secondary" type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="signature-mode" role="group" aria-label={`${label} method`}>
        <button className={mode === "drawn" ? "primary" : "secondary"} type="button" onClick={() => chooseMode("drawn")}>
          Draw
        </button>
        <button className={mode === "upload" ? "primary" : "secondary"} type="button" onClick={() => chooseMode("upload")}>
          Upload PNG/JPG
        </button>
      </div>
      {mode === "drawn" ? (
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          width={900}
          height={240}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
        />
      ) : (
        <div className="signature-upload-panel">
          <ImageUpload label="Attach signature or thumbprint image" onImage={drawUploadedImage} />
          <canvas ref={canvasRef} className="signature-canvas upload-preview" width={900} height={240} />
        </div>
      )}
    </div>
  );
}
