import api from "./config";
import type { ExportFile } from "../types/workspace";
export const fetcher = async <T>(path: string): Promise<T> => {
  const response = await api.get(path);
  return response.data.data;
};
export const save = async <T>(
  path: string,
  data: unknown,
  id?: string,
): Promise<T> => {
  const response = id
    ? await api.put(`${path}/${id}`, data)
    : await api.post(path, data);
  return response.data.data;
};
export const remove = async (path: string) => api.delete(path);
export function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const e = error as {
      response?: {
        data?: { message?: string; errors?: { message: string }[] };
      };
    };
    return (
      e.response?.data?.errors?.map((e) => e.message).join(" · ") ||
      e.response?.data?.message ||
      "Please try again."
    );
  }
  return error instanceof Error
    ? error.message
    : "Unable to complete this request.";
}
export async function downloadFile(file: ExportFile) {
  const response = await api.get(`/workspace/history/${file.id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
