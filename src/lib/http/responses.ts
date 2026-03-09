import { NextResponse } from "next/server";

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403 });
}

export function badRequestResponse(message = "Invalid request") {
  return NextResponse.json({ message }, { status: 400 });
}