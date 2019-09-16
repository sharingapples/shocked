/**
 * Websocket only accepts url starting with ws:// or wss://.
 * Convert http:// and https:// to their respective webocket
 * variant
 *
 * @param url
 */
export default function fixUrl(url: string) {
  if (url.startsWith('http')) {
    return `ws${url.substr(4)}`;
  }
  return url;
}
