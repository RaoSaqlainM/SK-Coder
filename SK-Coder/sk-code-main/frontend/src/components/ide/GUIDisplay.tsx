/**
 * GUI Display Component
 * Interactive display for pygame, tkinter, and other GUI apps
 * Features:
 * - Touch input (mobile)
 * - Keyboard input (desktop)
 * - Mouse events
 * - Responsive canvas
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface GUIDisplayProps {
  guiUrl?: string;
  onClose?: () => void;
}

export function GUIDisplay({ guiUrl, onClose }: GUIDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const [showControls, setShowControls] = useState(true);
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  // Scaling for mobile
  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const canvasWidth = 1920; // Assume 1920x1080 (can be dynamic)
      const canvasHeight = 1080;
      
      const scaleX = containerWidth / canvasWidth;
      const scaleY = containerHeight / canvasHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      
      setScale(newScale);
    }
  }, []);
  
  // Keyboard input (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected) return;
      
      // Send key to backend (via WebSocket)
      sendKeyEvent(e.key, "down");
      
      // Prevent default for game input
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(e.key)) {
        e.preventDefault();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isConnected) return;
      
      sendKeyEvent(e.key, "up");
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isConnected]);
  
  // Touch input (mobile)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect) {
      const x = (touch.clientX - rect.left) / scale;
      const y = (touch.clientY - rect.top) / scale;
      
      lastTouchRef.current = { x, y };
      
      sendMouseEvent(x, y, "down");
    }
  }, [scale]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect && lastTouchRef.current) {
      const x = (touch.clientX - rect.left) / scale;
      const y = (touch.clientY - rect.top) / scale;
      
      sendMouseEvent(x, y, "move");
      
      lastTouchRef.current = { x, y };
    }
  }, [scale]);
  
  const handleTouchEnd = useCallback(() => {
    if (lastTouchRef.current) {
      sendMouseEvent(lastTouchRef.current.x, lastTouchRef.current.y, "up");
      lastTouchRef.current = null;
    }
  }, []);
  
  // Mouse input (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect) {
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      sendMouseEvent(x, y, "down");
    }
  }, [scale]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect) {
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      sendMouseEvent(x, y, "move");
    }
  }, [scale]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect) {
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      sendMouseEvent(x, y, "up");
    }
  }, [scale]);
  
  // Send events to backend (placeholder - implement WebSocket)
  const sendKeyEvent = useCallback((key: string, type: "down" | "up") => {
    console.log(`Key ${type}: ${key}`);
    // TODO: Implement WebSocket communication
  }, []);
  
  const sendMouseEvent = useCallback((x: number, y: number, type: "down" | "move" | "up") => {
    console.log(`Mouse ${type}: (${x}, ${y})`);
    // TODO: Implement WebSocket communication
  }, []);
  
  // Placeholder: If noVNC URL, embed iframe
  if (guiUrl) {
    return (
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          zIndex: 9999,
        }}
      >
        <iframe
          src={guiUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="fullscreen"
        />
        
        {showControls && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "rgba(0, 0, 0, 0.8)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Canvas-based display
  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          border: "1px solid #333",
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
        onMouseDown={!isMobile ? handleMouseDown : undefined}
        onMouseMove={!isMobile ? handleMouseMove : undefined}
        onMouseUp={!isMobile ? handleMouseUp : undefined}
        tabIndex={0}
      />
      
      {showControls && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "rgba(255, 0, 0, 0.8)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ✕ Close
          </button>
          
          <button
            onClick={() => setShowControls(false)}
            style={{
              padding: "8px 16px",
              background: "rgba(0, 0, 0, 0.8)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Hide Controls
          </button>
        </div>
      )}
      
      {!showControls && (
        <div
          onClick={() => setShowControls(true)}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 40,
            height: 40,
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        />
      )}
      
      {/* Mobile controls */}
      {isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            right: 16,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
            height: 150,
            opacity: 0.7,
          }}
        >
          <div />
          <button onClick={() => sendKeyEvent("ArrowUp", "down")}>▲</button>
          <div />
          <button onClick={() => sendKeyEvent("ArrowLeft", "down")}>◀</button>
          <button onClick={() => sendKeyEvent("Space", "down")}>⬤</button>
          <button onClick={() => sendKeyEvent("ArrowRight", "down")}>▶</button>
          <div />
          <button onClick={() => sendKeyEvent("ArrowDown", "down")}>▼</button>
          <div />
        </div>
      )}
      
      <style>{`
        canvas:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}
