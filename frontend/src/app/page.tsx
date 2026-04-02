import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
          AI 智能体大赛参赛作品
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          前沿融课<span className="text-blue-600">教师助手</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
          帮助高校教师将前沿研究、行业案例与新技术快速融入具体课程，提供从课时包生成到学生问答再到教学复盘的完整闭环
        </p>

        {/* Core Loop */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-12">
          <span className="px-3 py-1 bg-white rounded-lg border">课程画像</span>
          <span>&rarr;</span>
          <span className="px-3 py-1 bg-white rounded-lg border">课时包生成</span>
          <span>&rarr;</span>
          <span className="px-3 py-1 bg-white rounded-lg border">学生问答</span>
          <span>&rarr;</span>
          <span className="px-3 py-1 bg-white rounded-lg border">教师复盘</span>
        </div>

        {/* Entry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/teacher"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-blue-200 transition-colors">
              👨‍🏫
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">教师端</h2>
            <p className="text-sm text-gray-500">创建课程画像、生成结构化课时包、发布给学生</p>
          </Link>
          <Link
            href="/student"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-green-200 transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-green-200 transition-colors">
              🎓
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">学生端</h2>
            <p className="text-sm text-gray-500">选择课时包、围绕课程内容进行智能问答</p>
          </Link>
          <Link
            href="/teacher/review"
            className="block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-purple-200 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-purple-200 transition-colors">
              📊
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">教师复盘</h2>
            <p className="text-sm text-gray-500">高频问题分析、知识盲区识别、教学建议</p>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { icon: "🎯", title: "精准定位", desc: "基于课程画像和前沿方向，精准生成融入方案" },
            { icon: "📚", title: "结构化课时包", desc: "包含教学目标、PPT大纲、讨论题、课后任务等完整结构" },
            { icon: "🔒", title: "课程边界约束", desc: "学生问答严格限制在课时范围内，防止偏离主题" },
            { icon: "📈", title: "教学复盘", desc: "分析学生提问数据，识别高频问题和知识盲区" },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 p-5 bg-white rounded-xl border border-gray-100">
              <div className="text-2xl flex-shrink-0">{f.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
