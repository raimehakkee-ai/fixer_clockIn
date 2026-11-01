export async function getStoredItem(key: string): Promise<string | null> {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Penyimpanan browser dapat diblokir; sesi tetap berjalan di memori.
  }
}

export async function deleteStoredItem(key: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // abaikan
  }
}
