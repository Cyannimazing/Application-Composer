export function excludedBundlePath(relative) {
  const parts = relative.replaceAll('\\', '/').split('/').filter(Boolean).map(part => part.toLowerCase());
  return parts[0] === 'output' || parts.some(part => part === '.local' || part === '.git' || part.startsWith('.env'));
}
