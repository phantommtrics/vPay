import type { DeviceInfoInput } from './service.js';

export type OtpEmailDeviceSummary = {
  deviceLabel: string;
  systemLabel: string;
  plainLines: string[];
};

export function formatDeviceForOtpEmail(device: DeviceInfoInput): OtpEmailDeviceSummary {
  const deviceLabel =
    device.deviceName?.trim() ||
    [device.brand, device.modelName].filter(Boolean).join(' ').trim() ||
    'Phone or tablet';

  const systemLabel =
    [device.osName, device.osVersion].filter(Boolean).join(' ').trim() || 'Unknown phone system';

  const plainLines = [
    `Device: ${deviceLabel}`,
    `Phone system: ${systemLabel}`,
  ];

  if (device.isEmulator) {
    plainLines.push('Type: Test device (emulator)');
  }

  return {
    deviceLabel,
    systemLabel,
    plainLines,
  };
}
