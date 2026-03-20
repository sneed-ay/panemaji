'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export default function GirlImage({ src, alt, size = 80, className = '' }: Props) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center shrink-0 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          className="text-gray-400"
          style={{ width: size * 0.5, height: size * 0.5 }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`object-cover shrink-0 rounded-lg ${className}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      unoptimized
    />
  );
}
