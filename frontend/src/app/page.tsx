import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl w-full mx-4 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">前沿融课教师助手</h1>
        <p className="text-lg text-gray-600 mb-12">
          帮助高校教师把前沿研究、行业案例与新技术快速融入具体课程与课时
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/teacher"
            className="block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">👨‍🏫</div>
            <h2 className="text-lg font-semibold text-gray-900">教师端</h2>
            <p className="text-sm text-gray-500 mt-1">创建课程、生成课时包、查看复盘</p>
          </Link>
          <Link
            href="/student"
            className="block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">🎓</div>
            <h2 className="text-lg font-semibold text-gray-900">学生端</h2>
            <p className="text-sm text-gray-500 mt-1">课时问答、延伸阅读</p>
          </Link>
          <Link
            href="/teacher/review"
            className="block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">📊</div>
            <h2 className="text-lg font-semibold text-gray-900">教师复盘</h2>
            <p className="text-sm text-gray-500 mt-1">高频问题、教学建议</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
