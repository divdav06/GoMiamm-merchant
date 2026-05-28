import { redirect } from "next/navigation";

// Root marketing/landing page is the merchant-portal mainsite. The app
// itself only cares about authed → /dashboard, otherwise → /login.
// Middleware enforces the same boundary on every /dashboard request.
export default function Home() {
  redirect("/login");
}
