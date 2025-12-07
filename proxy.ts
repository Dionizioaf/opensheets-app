import { auth } from "@/lib/auth/config";
import { NextRequest, NextResponse } from "next/server";

// Rotas protegidas que requerem autenticação
const PROTECTED_ROUTES = [
  "/ajustes",
  "/anotacoes",
  "/calendario",
  "/cartoes",
  "/categorias",
  "/contas",
  "/dashboard",
  "/insights",
  "/lancamentos",
  "/orcamentos",
  "/pagadores",
];

// Rotas públicas (não requerem autenticação)
const PUBLIC_AUTH_ROUTES = ["/login", "/signup"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Validate actual session, not just cookie existence
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const isAuthenticated = !!session?.user;

  // Redirect authenticated users away from login/signup pages
  if (isAuthenticated && PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users trying to access protected routes
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to protected and auth routes
  matcher: [
    "/ajustes/:path*",
    "/anotacoes/:path*",
    "/calendario/:path*",
    "/cartoes/:path*",
    "/categorias/:path*",
    "/contas/:path*",
    "/dashboard/:path*",
    "/insights/:path*",
    "/lancamentos/:path*",
    "/orcamentos/:path*",
    "/pagadores/:path*",
    "/login",
    "/signup",
  ],
};
