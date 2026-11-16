const cities = [
  ["loc-hcm", "TP. Hồ Chí Minh"],
  ["loc-dalat", "Đà Lạt"],
  ["loc-danang", "Đà Nẵng"],
  ["loc-hanoi", "Hà Nội"],
] as const;
export function backendLocationName(id: string): string {
  return cities.find((city) => city[0] === id)?.[1] ?? id;
}
export function locationIdentity(name: string): string {
  return cities.find((city) => city[1] === name)?.[0] ?? name;
}
