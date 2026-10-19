// صف من admin_wilaya_stats() (الترحيل 20261019000001)
export type DistrictStats = {
  district_id: number;
  district_name: string;
  inspector_name: string | null;
  teachers: number;
  inspectors: number;
  active_teachers: number;
  lessons: number;
  notes_submitted: number;
  notes_reviewed: number;
  circulars: number;
  suspended: number;
  new_this_week: number;
};

export function summarizeStats(rows: DistrictStats[]) {
  const sum = (k: keyof DistrictStats) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
  return {
    teachers: sum("teachers"),
    activeTeachers: sum("active_teachers"),
    lessons: sum("lessons"),
    notesWaiting: sum("notes_submitted") - sum("notes_reviewed"),
    suspended: sum("suspended"),
    newThisWeek: sum("new_this_week"),
  };
}
