import { useController, EventHandler } from './Controller';

export default function useShockedEvent(name: string) {
  const controller = useController();
  return <T>(cb: EventHandler<T>) => {
    controller.addEventListener(name, cb);
    return () => controller.removeEventListener(name, cb);
  }
}