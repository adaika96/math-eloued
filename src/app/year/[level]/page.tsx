import { notFound } from "next/navigation";
import { YearLessons } from "./YearLessons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function YearPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const lv = Number(level);
  if (![1, 2, 3, 4].includes(lv)) notFound();
  return <YearLessons level={lv as 1 | 2 | 3 | 4} />;
}
