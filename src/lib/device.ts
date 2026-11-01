import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getStoredItem, setStoredItem } from './auth-storage';

const DEVICE_KEY = 'clockin.device.id';

let cachedIdentifier: string | null = null;

export async function getDeviceIdentifier(): Promise<string> {
  if (cachedIdentifier) {
    return cachedIdentifier;
  }

  const existing = await getStoredItem(DEVICE_KEY);
  if (existing) {
    cachedIdentifier = existing;
    return existing;
  }

  const identifier = Crypto.randomUUID();
  await setStoredItem(DEVICE_KEY, identifier);
  cachedIdentifier = identifier;
  return identifier;
}

export function getDeviceName(): string {
  return (
    Device.deviceName ??
    Device.modelName ??
    `${Platform.OS === 'web' ? 'Browser' : 'Perangkat'} ClockIn`
  );
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}
