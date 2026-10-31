export const MAX_LOCAL_FILE_MB = 100;
export const MAX_CLOUD_FILE_MB = 25;

export function checkFileSize(file) {
  const mb = file.size / (1024 * 1024);

  if (mb > MAX_LOCAL_FILE_MB) {
    return {
      ok: false,
      cloud: false,
      message: `This file is ${Math.round(mb)}MB. The limit is ${MAX_LOCAL_FILE_MB}MB.`,
    };
  }
  if (mb > MAX_CLOUD_FILE_MB) {
    return {
      ok: true,
      cloud: false,
      message: `This file is over ${MAX_CLOUD_FILE_MB}MB, so it stays on this device and won't sync.`,
    };
  }
  return { ok: true, cloud: true };
}

