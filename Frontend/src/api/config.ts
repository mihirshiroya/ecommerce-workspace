import axios from "axios";
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "ListingStudio",
  },
});
let refreshing: Promise<unknown> | null = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !String(original.url).includes("/auth/")
    ) {
      original._retry = true;
      try {
        if (!refreshing)
          refreshing = api.post("/auth/refresh-token", {}).finally(() => {
            refreshing = null;
          });
        await refreshing;
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
export default api;
