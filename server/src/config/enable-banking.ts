import "dotenv/config";
import { FRONT_URLS } from "./front";

// Enable Banking application (Control Panel): the bank sync is disabled while the app id is missing
export const ENABLE_BANKING_APP_ID = process.env.ENABLE_BANKING_APP_ID ?? "";
// private key (PEM) generated with the application, kept outside the repository
export const ENABLE_BANKING_KEY_PATH = process.env.ENABLE_BANKING_KEY_PATH ?? "";
// front page the bank sends the browser back to, must be whitelisted in the application
export const ENABLE_BANKING_REDIRECT_URL =
	process.env.ENABLE_BANKING_REDIRECT_URL ?? `${FRONT_URLS[0]}/money/banking/callback`;
export const ENABLE_BANKING_API_URL = process.env.ENABLE_BANKING_API_URL ?? "https://api.enablebanking.com";

export const ENABLE_BANKING_ENABLED = ENABLE_BANKING_APP_ID !== "" && ENABLE_BANKING_KEY_PATH !== "";
