import { redirect } from "next/navigation";

// The site opens on sign-in (/app shows it until the visitor has an account). The product introduction lives at /about.
export default function HomePage() {
  redirect("/app?lang=zh");
}
