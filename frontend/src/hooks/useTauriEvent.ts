import { useEffect } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
) {
  useEffect(() => {
    let unlisten: UnlistenFn;

    const setup = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        handler(event.payload);
      });
    };

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, [eventName, handler]);
}
