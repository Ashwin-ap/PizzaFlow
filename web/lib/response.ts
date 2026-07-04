import { NextResponse } from "next/server";

/**
 * Single response envelope + error-code registry (PRD §11.1 / §11.2).
 * Every API route returns via these helpers.
 */

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  MENU_ITEM_NOT_FOUND: 422,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string[]>;
  };
}

/** Success envelope. */
export function ok<T>(data: T, init?: { status?: number }): NextResponse {
  const body: ApiSuccess<T> = { success: true, data };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

/** Paginated success envelope (admin lists). */
export function paginated<T>(
  data: T[],
  p: { total: number; page: number; limit: number },
): NextResponse {
  const totalPages = p.limit > 0 ? Math.ceil(p.total / p.limit) : 0;
  const body: ApiPaginated<T> = {
    success: true,
    data,
    pagination: { ...p, totalPages },
  };
  return NextResponse.json(body, { status: 200 });
}

/**
 * Error envelope. HTTP status defaults to the code's canonical status; override
 * for the AI_UNAVAILABLE 200-with-fallback case. `fields` only on VALIDATION_ERROR.
 */
export function err(
  code: ErrorCode,
  message: string,
  opts?: { fields?: Record<string, string[]>; status?: number },
): NextResponse {
  const error: ApiError["error"] = { code, message };
  if (code === "VALIDATION_ERROR" && opts?.fields) error.fields = opts.fields;
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: opts?.status ?? ERROR_STATUS[code] });
}
