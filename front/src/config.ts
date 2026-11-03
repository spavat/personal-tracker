export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Set by the CI image build (commit sha, ISO date); absent locally
export const APP_VERSION: string | undefined = import.meta.env.VITE_APP_VERSION;
export const BUILD_DATE: string | undefined = import.meta.env.VITE_BUILD_DATE;
