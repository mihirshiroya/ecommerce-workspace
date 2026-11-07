import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { authApi } from "../../api/auth";
import type {
  AuthState,
  User,
  LoginRequest,
  RegisterRequest,
} from "../../types";
import { errorMessage } from "../../api/workspace";
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};
export const loginUser = createAsyncThunk(
  "auth/login",
  async (data: LoginRequest, { rejectWithValue }) => {
    try {
      return await authApi.login(data);
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);
export const registerUser = createAsyncThunk(
  "auth/register",
  async (data: RegisterRequest, { rejectWithValue }) => {
    try {
      return await authApi.register(data);
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);
export const logoutUser = createAsyncThunk(
  "auth/logout",
  async (all: boolean = false) => {
    if (all) await authApi.logoutAll();
    else await authApi.logout();
    return true;
  },
);
export const getProfile = createAsyncThunk("auth/profile", async () => {
  const response = await authApi.getProfile();
  return response.data!.user;
});
const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (s, a: PayloadAction<{ user: User }>) => {
      s.user = a.payload.user;
      s.isAuthenticated = true;
    },
    updateUser: (s, a: PayloadAction<User>) => {
      s.user = a.payload;
    },
    clearAuth: (s) => {
      s.user = null;
      s.isAuthenticated = false;
    },
    setLoading: (s, a: PayloadAction<boolean>) => {
      s.isLoading = a.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(loginUser.pending, (s) => {
      s.isLoading = true;
    })
      .addCase(registerUser.pending, (s) => {
        s.isLoading = true;
      })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.isLoading = false;
        s.isAuthenticated = true;
        s.user = a.payload.data.user;
      })
      .addCase(registerUser.fulfilled, (s, a) => {
        s.isLoading = false;
        s.isAuthenticated = true;
        s.user = a.payload.data.user;
      })
      .addCase(loginUser.rejected, (s) => {
        s.isLoading = false;
      })
      .addCase(registerUser.rejected, (s) => {
        s.isLoading = false;
      })
      .addCase(logoutUser.fulfilled, (s) => {
        s.user = null;
        s.isAuthenticated = false;
      })
      .addCase(getProfile.fulfilled, (s, a) => {
        s.user = a.payload;
        s.isAuthenticated = true;
      });
  },
});
export const { setCredentials, updateUser, clearAuth, setLoading } =
  slice.actions;
export default slice.reducer;
