import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StudentLeasesPage({ params }: Props) {
  const { id } = await params;
  const studentId = Number(id);

  if (!Number.isFinite(studentId) || studentId <= 0) {
    notFound();
  }

  redirect(`/lease?studentId=${studentId}`);
}
