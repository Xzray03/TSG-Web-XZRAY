import { NextResponse } from "next/server";
import { getTeamMembers } from "@/sanity/queries";

export async function GET() {
  try {
    const members = await getTeamMembers();
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json([], { status: 200 });
  }
}