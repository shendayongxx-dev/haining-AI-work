type Bucket = { count: number; red: number; green: number; blue: number };

const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/** Extract a small, repeatable palette from an already downscaled local image. */
export function extractPhotoPalette(pixels: ArrayLike<number>, limit = 8): string[] {
  const buckets = new Map<string, Bucket>();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    const key = `${red >> 5}:${green >> 5}:${blue >> 5}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
  const chosen: number[][] = [];
  for (const bucket of ranked) {
    const rgb = [bucket.red / bucket.count, bucket.green / bucket.count, bucket.blue / bucket.count];
    if (chosen.some(previous => Math.hypot(...rgb.map((value, index) => value - previous[index])) < 42)) continue;
    chosen.push(rgb);
    if (chosen.length >= limit) break;
  }
  return chosen.map(rgb => `#${rgb.map(hex).join('')}`.toUpperCase());
}
