import { useEffect, useState } from 'react';

import { errorMessage, fetchBlob } from '@/lib/api';

export function AuthImage({
  path,
  alt,
  className = '',
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setUrl(null);
    setError(null);

    fetchBlob(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-slate-100 p-4 text-center text-xs text-slate-500 ${className}`}>
        Foto tidak tersedia
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-slate-100 p-4 text-center text-xs text-slate-500 ${className}`}>
        Memuat foto…
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
}
