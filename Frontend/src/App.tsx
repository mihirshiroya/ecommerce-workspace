import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useSWR, { SWRConfig } from "swr";
import { Toaster } from "@/components/ui/sonner";
import { store } from "./store";
import { useAppDispatch, useAppSelector } from "./hooks/redux";
import { setCredentials, clearAuth } from "./store/slices/authSlice";
import { fetcher } from "./api/workspace";
import { authApi } from "./api/auth";
import type { User } from "./types";
import Shell from "./components/workspace/Shell";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Skus from "./pages/Skus";
import BulkListing from "./pages/BulkListing";
import ListingHistory from "./pages/ListingHistory";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AdminDashboard from "./pages/AdminDashboard";
import UsersManagement from "./pages/UsersManagement";
import UserDetail from "./pages/UserDetail";
import { Loading } from "./components/workspace/Common";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
async function sessionFetcher() {
  try {
    return await fetcher<{ user: User }>("/auth/profile");
  } catch (e) {
    if ((e as { response?: { status: number } }).response?.status === 401) {
      try {
        await authApi.refreshToken();
        return await fetcher<{ user: User }>("/auth/profile");
      } catch {
        return null;
      }
    }
    return null;
  }
}
function SessionBoundary({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useSWR<{ user: User } | null>(
    "/auth/profile",
    sessionFetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const authenticated = useAppSelector((s) => s.auth.isAuthenticated);
  useEffect(() => {
    if (data?.user) dispatch(setCredentials({ user: data.user }));
    else if (data === null) dispatch(clearAuth());
  }, [data, dispatch]);
  if (isLoading || (data?.user && !authenticated)) return <Loading />;
  return children;
}
function RequireAuth({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (admin && user?.role !== "ADMIN")
    return <Navigate to="/dashboard" replace />;
  return children;
}
function Routing() {
  const authenticated = useAppSelector((s) => s.auth.isAuthenticated);
  return (
    <BrowserRouter>
      <SessionBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate to={authenticated ? "/dashboard" : "/login"} replace />
            }
          />
          <Route
            path="/login"
            element={
              authenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />
          <Route
            path="/register"
            element={
              authenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Register />
              )
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/skus" element={<Skus />} />
            <Route path="/listing" element={<BulkListing />} />
            <Route path="/history" element={<ListingHistory />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/profile"
              element={<Navigate to="/settings" replace />}
            />
            <Route
              path="/security"
              element={<Navigate to="/settings" replace />}
            />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth admin>
                  <UsersManagement />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <RequireAuth admin>
                  <UserDetail />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionBoundary>
    </BrowserRouter>
  );
}
export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SWRConfig
          value={{
            fetcher,
            shouldRetryOnError: false,
            revalidateOnFocus: false,
          }}
        >
          <Routing />
          <Toaster richColors position="top-right" />
        </SWRConfig>
      </QueryClientProvider>
    </Provider>
  );
}
