export const randomRacePairs = [
  ["Lando Norris", "Border Collie"],
  ["Mona Lisa", "Volcano"],
  ["Saturn V", "Jazz"],
  ["Ada Lovelace", "Octopus"],
  ["Miami", "Shark"],
  ["Nintendo", "Penguin"],
  ["Apollo 11", "Pyramid"],
  ["Telescope", "Tiramisu"],
];

export function slugifyTitle(value: string) {
  return value.trim().replace(/\s+/g, "_");
}
