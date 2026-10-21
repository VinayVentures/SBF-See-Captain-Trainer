/**
 * Resolve question image filenames to runtime URLs.
 *
 * Vite's `import.meta.glob` with `eager: true, import: 'default'` gives us
 * a build-time map of every image file under data/images/ to its fingerprinted
 * final URL. That ensures:
 *   - all images are included in the PWA precache (works offline)
 *   - URLs are correctly resolved under the GitHub Pages sub-path (base: './')
 */

const IMAGE_URLS = import.meta.glob('../../data/images/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const BY_FILENAME = new Map<string, string>()
for (const [path, url] of Object.entries(IMAGE_URLS)) {
  const filename = path.split('/').pop()
  if (filename) BY_FILENAME.set(filename, url)
}

export function resolveImageUrl(filename: string): string | undefined {
  return BY_FILENAME.get(filename)
}
