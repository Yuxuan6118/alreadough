import { redirect } from "next/navigation";

// English visitors open on the English sign-in page. The product introduction lives at /en/about.
export default function EnglishHomePage() {
  redirect("/app?lang=en");
}
