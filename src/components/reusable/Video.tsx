// src/components/reusable/Video.tsx
import { forwardRef } from 'react';

const Video = forwardRef<HTMLVideoElement, {}>((_, ref) => (
  <div className="w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden">
    <video
      playsInline
      autoPlay
      ref={ref}
      className="w-full h-full object-contain"
      style={{ aspectRatio: '9 / 16' }}
    />
  </div>
));

export { Video };
