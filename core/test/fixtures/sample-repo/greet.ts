// `auditQuotaLedger` is deliberately named so that it does NOT match a
// natural-language query about greeting — the e2e test relies on it being
// reachable only by following a structural edge, never as a semantic hit.
export function auditQuotaLedger(): number {
  return 42;
}

export function greet(name: string): string {
  auditQuotaLedger();
  return 'hi ' + name;
}

export function welcome(name: string): string {
  return greet(name) + '!';
}
