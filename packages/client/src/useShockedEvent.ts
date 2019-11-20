import { useEffect } from 'react';
import { useController, EventHandler } from './Controller';

export default function useShockedEvent<T>(name: string, handler: EventHandler<T>) {
  const controller = useController();
  useEffect(() => {
    controller.addEventListener(name, handler);
    return () => controller.removeEventListener(name, handler);
  }, [name, handler]);
}
