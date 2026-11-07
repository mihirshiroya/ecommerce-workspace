import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSWRConfig } from "swr";
import { authApi } from "../api/auth";
import { useAppDispatch, useAppSelector } from "./redux";
import { clearAuth, updateUser } from "../store/slices/authSlice";
import { toast } from "sonner";
import { errorMessage } from "../api/workspace";
export function useAuth() {
  const dispatch = useAppDispatch(),
    qc = useQueryClient(),
    { mutate } = useSWRConfig(),
    state = useAppSelector((s) => s.auth);
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const logout = useMutation({
    mutationFn: (all: boolean = false) =>
      all ? authApi.logoutAll() : authApi.logout(),
    onSuccess: () => {
      dispatch(clearAuth());
      qc.clear();
      void mutate(() => true, undefined, { revalidate: false });
    },
    onError,
  });
  const changePassword = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (r) => toast.success(r.message),
    onError,
  });
  const updateProfile = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (r) => {
      dispatch(updateUser(r.data!.user));
      toast.success(r.message);
    },
    onError,
  });
  const verifyEmail = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (r) => {
      dispatch(updateUser(r.data!.user));
      toast.success(r.message);
    },
    onError,
  });
  const resendVerification = useMutation({
    mutationFn: authApi.resendVerificationEmail,
    onSuccess: (r) => toast.success(r.message),
    onError,
  });
  const forgotPassword = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (r) => toast.success(r.message),
    onError,
  });
  const resetPassword = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: (r) => toast.success(r.message),
    onError,
  });
  const activeSessions = useQuery({
    queryKey: ["activeSessions"],
    queryFn: authApi.getActiveSessions,
    enabled: state.isAuthenticated,
  });
  const revokeSession = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activeSessions"] });
      toast.success("Session revoked");
    },
    onError,
  });
  return {
    ...state,
    logout,
    changePassword,
    updateProfile,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    activeSessions,
    revokeSession,
  };
}
