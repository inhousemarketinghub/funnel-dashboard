import { redirect } from "next/navigation";

// Team & Invites merged into Manage Access → Members tab. Keep the old URL
// working for bookmarks / existing links.
export default function TeamRedirect() {
  redirect("/projects/access");
}
