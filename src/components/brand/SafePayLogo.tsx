'use client';

import React from 'react';
import Image from 'next/image';

export interface SafePayLogoProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export function SafePayLogo({
  size = 'sm',
  className = '',
  priority = false,
}: SafePayLogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 32;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-xs select-none transition-transform ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize,
      }}
    >
      <Image
        src="/safepay-logo.png"
        alt="SafePay Logo"
        width={pixelSize * 2}
        height={pixelSize * 2}
        priority={priority}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

