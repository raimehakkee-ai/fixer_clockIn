import { useEffect, useState } from 'react';

export function useServerClock(offsetMs: number): Date {
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date(Date.now() + offsetMs));
    }, 1000);

    return () => clearInterval(timer);
  }, [offsetMs]);

  return now;
}
