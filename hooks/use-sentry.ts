import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export const useSentry = () => {
	const [hasSentError, setHasSentError] = useState(false);
	const [isConnected, setIsConnected] = useState(true);

	useEffect(() => {
		async function checkConnectivity() {
			try {
				const result = await Sentry.diagnoseSdkConnectivity();
				setIsConnected(result !== "sentry-unreachable");
			} catch (e: unknown) {
				setHasSentError(true);
				console.error(e);
			}
		}
		checkConnectivity();
	}, []);

	return {
		hasSentError,
		setHasSentError,
		isConnected,
		setIsConnected,
	};
};

export class SentryFrontendError extends Error {
	constructor(message: string | undefined) {
		super(message);
		this.name = "SentryFrontendError";
	}
}
