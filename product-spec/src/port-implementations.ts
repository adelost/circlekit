/** WHAT: Returns a product's named port implementations unchanged. WHY: Keeps normal runtime binding free of test-only interception. */
export function bindPortImplementations<Ports extends object>(ports: Ports): Ports {
  return ports;
}
