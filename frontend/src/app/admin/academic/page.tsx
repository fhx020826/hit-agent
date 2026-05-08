"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import {
  api,
  type AcademicCourseItem,
  type AdminAcademicEnrollmentItem,
  type AdminAcademicStudentItem,
  type AdminAcademicTeacherItem,
  type CourseOfferingItem,
  type DemoAccountExport,
} from "@/lib/api";

export default function AdminAcademicPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [teachers, setTeachers] = useState<AdminAcademicTeacherItem[]>([]);
  const [students, setStudents] = useState<AdminAcademicStudentItem[]>([]);
  const [courses, setCourses] = useState<AcademicCourseItem[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingItem[]>([]);
  const [enrollments, setEnrollments] = useState<AdminAcademicEnrollmentItem[]>([]);
  const [exportData, setExportData] = useState<DemoAccountExport | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [nextTeachers, nextStudents, nextCourses, nextOfferings, nextEnrollments] = await Promise.all([
      api.adminListTeachers().catch(() => []),
      api.adminListStudents().catch(() => []),
      api.adminListAcademicCourses().catch(() => []),
      api.adminListOfferings().catch(() => []),
      api.adminListEnrollments().catch(() => []),
    ]);
    setTeachers(nextTeachers);
    setStudents(nextStudents);
    setCourses(nextCourses);
    setOfferings(nextOfferings);
    setEnrollments(nextEnrollments);
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    let cancelled = false;
    void (async () => {
      const [nextTeachers, nextStudents, nextCourses, nextOfferings, nextEnrollments] = await Promise.all([
        api.adminListTeachers().catch(() => []),
        api.adminListStudents().catch(() => []),
        api.adminListAcademicCourses().catch(() => []),
        api.adminListOfferings().catch(() => []),
        api.adminListEnrollments().catch(() => []),
      ]);
      if (cancelled) return;
      setTeachers(nextTeachers);
      setStudents(nextStudents);
      setCourses(nextCourses);
      setOfferings(nextOfferings);
      setEnrollments(nextEnrollments);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || user.role !== "admin") return <main className="section-card rounded-[24px] p-6">Loading...</main>;

  return (
    <main className="space-y-4">
      <section className="section-card rounded-[24px] p-5">
        <h1 className="text-xl font-bold">Registrar Simulation</h1>
        <p className="mt-2 text-sm text-slate-600">
          The platform seeds teacher accounts, student accounts, courses, teaching assignments, and enrollments through a backend registrar simulation.
          Teachers and students do not create their own course relationships.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="button-primary px-4 py-2"
            onClick={async () => {
              const result = await api.adminSeedDemoSchool();
              setMessage(result.message);
              await refresh();
            }}
          >
            Generate Demo Academic Data
          </button>
          <button
            className="ui-pill px-4 py-2"
            onClick={async () => {
              await api.adminResetDemoSchool();
              setMessage("Demo academic data has been reset.");
              setExportData(null);
              await refresh();
            }}
          >
            Reset Demo Academic Data
          </button>
          <button
            className="ui-pill px-4 py-2"
            onClick={async () => {
              setExportData(await api.adminExportDemoAccounts());
            }}
          >
            Export Accounts
          </button>
        </div>
        {message ? <div className="mt-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</div> : null}
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">Teachers</h2>
        <div className="space-y-2 text-sm">
          {teachers.map((teacher) => (
            <div key={teacher.user_id} className="rounded-xl border px-3 py-2">
              {teacher.account} | {teacher.display_name} | {teacher.department || "N/A"} | Courses {teacher.course_count}
            </div>
          ))}
        </div>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">Students</h2>
        <div className="space-y-2 text-sm">
          {students.slice(0, 20).map((student) => (
            <div key={student.user_id} className="rounded-xl border px-3 py-2">
              {student.account} | {student.display_name} | {student.class_name || "N/A"} | Courses {student.course_count}
            </div>
          ))}
        </div>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">Teaching Assignments</h2>
        <div className="space-y-2 text-sm">
          {offerings.map((offering) => (
            <div key={offering.id} className="rounded-xl border px-3 py-2">
              {offering.academic_course_name} | {offering.teacher_name || "Unassigned"} | {offering.semester || "N/A"} | Students {offering.enrolled_count}
            </div>
          ))}
        </div>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">Enrollments</h2>
        <div className="space-y-2 text-sm">
          {enrollments.slice(0, 30).map((item) => (
            <div key={item.enrollment_id} className="rounded-xl border px-3 py-2">
              {item.student_name} | {item.course_name} | {item.teacher_name} | {item.semester}
            </div>
          ))}
        </div>
      </section>

      <section className="section-card rounded-[24px] p-5">
        <h2 className="mb-3 font-semibold">Courses</h2>
        <div className="space-y-2 text-sm">
          {courses.map((course) => (
            <div key={course.id} className="rounded-xl border px-3 py-2">
              {course.name} | {course.code} | {course.department || "Demo Department"}
            </div>
          ))}
        </div>
      </section>

      {exportData ? (
        <section className="section-card rounded-[24px] p-5">
          <h2 className="mb-3 font-semibold">Account Export Preview</h2>
          <div className="space-y-2 text-sm">
            {exportData.teachers.slice(0, 6).map((teacher) => (
              <div key={teacher.account} className="rounded-xl border px-3 py-2">
                Teacher | {teacher.account} | Password {teacher.initial_password} | {teacher.courses.join(", ")}
              </div>
            ))}
            {exportData.students.slice(0, 10).map((student) => (
              <div key={student.account} className="rounded-xl border px-3 py-2">
                Student | {student.account} | Password {student.initial_password} | {student.courses.join(", ")}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
