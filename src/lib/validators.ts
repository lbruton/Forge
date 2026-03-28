const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export function isValidIpv4(value: string): boolean {
  if (!IPV4_REGEX.test(value)) return false;
  return value.split('.').every((octet) => {
    const n = parseInt(octet, 10);
    return n >= 0 && n <= 255;
  });
}
