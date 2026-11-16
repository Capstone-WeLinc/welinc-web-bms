import axios from "axios";
import { toast } from "sonner";
declare module "axios" {
  interface AxiosRequestConfig {
    quiet?: boolean;
  }
}
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { "content-type": "application/json" },
});
api.interceptors.request.use((config) => {
  const path = config.url ?? "";
  if (path.startsWith("/public/tracking")) config.sessionCall = true;
  if (
    path.startsWith("/") &&
    !path.startsWith("/auth/") &&
    !path.startsWith("/bms/")
  )
    config.url = "/bms" + path;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "ADMIN_CODE_REQUIRED"
    )
      toast.error("Confirm your sign in in the portal", {
        action: {
          label: "Open portal",
          onClick: () =>
            window.open(
              `${import.meta.env.VITE_PORTAL_URL}/admin`,
              "_blank",
              "noopener,noreferrer",
            ),
        },
      });
    return Promise.reject(error);
  },
);
export default api;
