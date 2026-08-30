export function getOrCreateDeviceKey(): string {
  if (typeof window === 'undefined') return '';
  const keyName = 'tsg_device_key';
  let deviceKey = localStorage.getItem(keyName);
  if (!deviceKey) {
    deviceKey = 'dev_' + Math.random().toString(36).substring(2) + '_' + Date.now().toString(36);
    localStorage.setItem(keyName, deviceKey);
  }
  return deviceKey;
}

export function getDeviceInfo() {
  if (typeof window === 'undefined') return { userAgent: '', platform: '' };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`
  };
}
