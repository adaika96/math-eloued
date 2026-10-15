import { notFound } from "next/navigation";
import { YearLessons } from "./YearLessons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function YearPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const lv = Number(level);
  if (lv !== 1 && lv !== 2) notFound();
  return <YearLessons level={lv} />;
}
