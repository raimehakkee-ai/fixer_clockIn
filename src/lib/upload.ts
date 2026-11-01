import { Platform } from 'react-native';

export type LocalFile = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export async function appendFile(
  form: FormData,
  field: string,
  file: LocalFile,
): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    form.append(field, blob, file.fileName);
    return;
  }

  form.append(field, {
    uri: file.uri,
    name: file.fileName,
    type: file.mimeType,
  } as unknown as Blob);
}
