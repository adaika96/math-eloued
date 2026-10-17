import { TopicView } from "./TopicView";

export default async function ForumTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TopicView id={id} />;
}
