import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Root landing page: handles initial role-based entry redirection.
 */
export default async function HomePage() {
  const session = await getSession();
  if (session) {
    if (session.role?.toLowerCase() === "admin") {
      redirect("/admin");
    }
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
