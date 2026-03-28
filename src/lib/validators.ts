const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function isValidIpv4(value: string): boolean {
  if (!IPV4_REGEX.test(value)) return false;
  return value.split('.').every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}
