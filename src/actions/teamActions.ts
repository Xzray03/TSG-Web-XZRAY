"use server";

import { client as sanityClient } from "@/sanity/client";
import { getTeamMembers } from "@/sanity/queries";

export async function getGenerationsAction(): Promise<string[]> {
  try {
    const categories = await sanityClient.fetch(`*[_type == "teamCategory"] | order(order asc) { name, slug }`);
    const generations = categories
      .map((cat: any) => cat.slug?.current || cat.name)
      .filter(Boolean);
    return generations;
  } catch (error) {
    console.error("Error fetching generations:", error);
    return [];
  }
}

export async function getTeamMembersAction() {
  try {
    const members = await getTeamMembers();
    return members;
  } catch (error) {
    console.error("Error fetching team members:", error);
    return [];
  }
}
