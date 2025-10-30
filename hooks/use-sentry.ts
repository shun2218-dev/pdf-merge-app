import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";

export const useSentry = () => {
      const [hasSentError, setHasSentError] = useState(false);
      const [isConnected, setIsConnected] = useState(true);
      
      useEffect(() => {
        async function checkConnectivity() {
          const result = await Sentry.diagnoseSdkConnectivity();
          setIsConnected(result !== 'sentry-unreachable');
        }
        checkConnectivity();
      }, []);

      return {
        hasSentError,
        setHasSentError,
        isConnected,
        setIsConnected,
      }
}

export class SentryFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryFrontendError";
  }
}