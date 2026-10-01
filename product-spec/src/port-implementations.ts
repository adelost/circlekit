import type { PortContracts } from "./contract-law-model.js";

/**
 * WHAT: Returns a product's named port implementations unchanged. WHY: Keeps normal runtime binding free of test-only
 * interception. The contracts are read only under the studio-trace and v1d-observe conditions; one call fits all three.
 */
export function bindPortImplementations<Ports extends object>(ports: Ports, _contracts?: PortContracts): Ports {
  return ports;
}
