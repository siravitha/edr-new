"use client";
import { createContext,useContext } from "react";
import type { Activity } from "@/lib/system-log";
export const SystemActivityContext=createContext<(activity:Activity)=>Promise<boolean>>(async()=>false);
export const useSystemActivity=()=>useContext(SystemActivityContext);
