import { describe, expect, it } from 'vitest';

import { haversineMeters, isWithinRadius, roundDistance } from '../src/lib/geo';

describe('haversineMeters', () => {
  it('mengembalikan 0 untuk koordinat yang sama', () => {
    const point = { latitude: -6.2088, longitude: 106.8456 };
    expect(haversineMeters(point, point)).toBe(0);
  });

  it('mengukur satu derajat lintang sekitar 111,2 km', () => {
    const distance = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it('mengukur pergeseran kecil di Jakarta dengan benar', () => {
    const office = { latitude: -6.2088, longitude: 106.8456 };
    const nearby = { latitude: -6.2089, longitude: 106.8456 };
    const distance = haversineMeters(office, nearby);

    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(12);
    expect(isWithinRadius(distance, 50)).toBe(true);
  });

  it('menolak lokasi 1 km dari kantor pada radius 50 m', () => {
    const office = { latitude: -6.2088, longitude: 106.8456 };
    const far = { latitude: -6.2178, longitude: 106.8456 };
    expect(isWithinRadius(haversineMeters(office, far), 50)).toBe(false);
  });
});

describe('isWithinRadius', () => {
  it('menganggap jarak tepat di radius sebagai di dalam', () => {
    expect(isWithinRadius(50, 50)).toBe(true);
  });

  it('menolak jarak melebihi radius', () => {
    expect(isWithinRadius(50.1, 50)).toBe(false);
  });
});

describe('roundDistance', () => {
  it('membulatkan satu desimal', () => {
    expect(roundDistance(12.345)).toBe(12.3);
    expect(roundDistance(12.36)).toBe(12.4);
  });
});
