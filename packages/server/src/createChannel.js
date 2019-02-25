export default function createChannel(name, broker) {
  return broker(name);
}
