import { configureStore } from "@reduxjs/toolkit";
import auth from "./slices/authSlice";
import admin from "./slices/adminSlice";
export const store = configureStore({ reducer: { auth, admin } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
