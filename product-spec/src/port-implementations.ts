/** A product's named port implementations. The production path returns the same object. */
export function bindPortImplementations<Ports extends object>(ports: Ports): Ports {
  return ports;
}
