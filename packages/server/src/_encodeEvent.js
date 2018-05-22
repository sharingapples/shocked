export default function encodeEvent(event, data) {
  return JSON.stringify([-1, event, data]);
}
