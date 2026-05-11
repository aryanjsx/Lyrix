import { useEffect } from "react";
import { useLyrixStore, NetworkState } from "@/store";
import { analytics, EVENTS } from "@/services/analyticsService";

interface NetworkConnection extends EventTarget {
  effectiveType?: string;
}

export function useNetwork(): NetworkState {
  const network = useLyrixStore((s) => s.network);
  const setNetwork = useLyrixStore((s) => s.setNetwork);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: NetworkConnection };
    const connection = nav.connection;

    function update(): void {
      const effectiveType =
        (connection as NetworkConnection | undefined)?.effectiveType ?? "unknown";
      const online = navigator.onLine;

      let status: NetworkState["status"];
      if (!online) {
        status = "offline";
      } else if (effectiveType === "2g" || effectiveType === "3g") {
        status = "slow";
      } else {
        status = "online";
      }

      const type = (
        ["4g", "3g", "2g"].includes(effectiveType) ? effectiveType : "unknown"
      ) as NetworkState["type"];

      setNetwork({ status, type });
      analytics.updateNetworkType(type);
      if (status === "offline") {
        analytics.track(EVENTS.NETWORK_OFFLINE);
      }
    }

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener("change", update);
    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener("change", update);
    };
  }, [setNetwork]);

  return network;
}
