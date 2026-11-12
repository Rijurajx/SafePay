'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface LunaMascotProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  interactive?: boolean;
  status?: 'idle' | 'thinking' | 'happy' | 'alert';
}

export function LunaMascot({
  size = 'md',
  className = '',
  interactive = true,
  status = 'idle',
}: LunaMascotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [ballOffset, setBallOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // Size configurations
  const dimensions = {
    xs: { ball: 'w-6 h-6', eye: 'w-1 h-2', gap: 'gap-0.5', maxTravel: 2 },
    sm: { ball: 'w-8 h-8', eye: 'w-1.5 h-3', gap: 'gap-1', maxTravel: 3.5 },
    md: { ball: 'w-10 h-10', eye: 'w-2 h-4', gap: 'gap-1.5', maxTravel: 5 },
    lg: { ball: 'w-16 h-16', eye: 'w-2.5 h-6', gap: 'gap-2', maxTravel: 7 },
    xl: { ball: 'w-36 h-36 sm:w-44 sm:h-44', eye: 'w-3.5 h-8 sm:w-4 sm:h-9', gap: 'gap-3.5 sm:gap-4', maxTravel: 12 },
  }[size];

  // Natural organic blinking
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleBlink = () => {
      const delay = Math.random() * 3500 + 2500; // 2.5s to 6s
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160);
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Global mouse position tracking with physics damping
  useEffect(() => {
    if (!interactive) return;

    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        const distance = Math.hypot(deltaX, deltaY);
        const angle = Math.atan2(deltaY, deltaX);

        // Scaled pupil travel
        const travelRatio = Math.min(1, distance / 280);
        const eyeTravel = dimensions.maxTravel * travelRatio;

        const eyeX = Math.cos(angle) * eyeTravel;
        const eyeY = Math.sin(angle) * eyeTravel;

        // Subtle organic body shift
        const ballX = Math.cos(angle) * (dimensions.maxTravel * 0.25 * travelRatio);
        const ballY = Math.sin(angle) * (dimensions.maxTravel * 0.25 * travelRatio);

        setEyeOffset({ x: eyeX, y: eyeY });
        setBallOffset({ x: ballX, y: ballY });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [interactive, dimensions.maxTravel]);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role="img"
      aria-label="Luna AI Mascot"
      className={`relative rounded-full select-none shrink-0 transition-transform cursor-pointer flex items-center justify-center ${dimensions.ball} ${className}`}
      style={{
        background: 'radial-gradient(circle at 35% 30%, #2a2e39 0%, #090b10 65%, #020305 100%)',
        boxShadow:
          size === 'xl'
            ? '0 24px 48px -12px rgba(0, 0, 0, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.25), inset 0 -4px 8px rgba(0, 0, 0, 0.6)'
            : '0 8px 20px -4px rgba(0, 0, 0, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25)',
        transform: `translate3d(${ballOffset.x}px, ${ballOffset.y}px, 0) ${
          isClicked ? 'scale(0.92)' : 'scale(1)'
        }`,
      }}
    >
      {/* Specular ambient glass reflection highlight */}
      <div
        className="absolute top-[12%] left-[18%] w-[28%] h-[24%] rounded-full pointer-events-none opacity-40 blur-[0.5px]"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 80%)',
        }}
      />

      {/* Eyes container */}
      <div
        className={`flex items-center justify-center ${dimensions.gap} transition-transform ease-out duration-75`}
        style={{
          transform: `translate3d(${eyeOffset.x}px, ${eyeOffset.y}px, 0)`,
        }}
      >
        {/* Left Eye */}
        <div
          className={`${dimensions.eye} bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-all duration-100`}
          style={{
            transform: isBlinking ? 'scaleY(0.08)' : status === 'happy' ? 'scaleY(0.7) rotate(10deg)' : 'scaleY(1)',
          }}
        />

        {/* Right Eye */}
        <div
          className={`${dimensions.eye} bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-all duration-100`}
          style={{
            transform: isBlinking ? 'scaleY(0.08)' : status === 'happy' ? 'scaleY(0.7) rotate(-10deg)' : 'scaleY(1)',
          }}
        />
      </div>

      {/* Subtle alert status indicator ring if alerted */}
      {status === 'alert' && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />
      )}
    </div>
  );
}
