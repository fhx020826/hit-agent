"use client";

import { useEffect, useMemo, useState } from "react";

import { AvatarBadge } from "@/components/avatar-badge";
import { useLanguage } from "@/components/language-provider";
import { RichAnswer } from "@/components/rich-answer";
import {
  api,
  type CurrentUser,
  type DiscussionAttachment,
  type DiscussionMessageItem,
  type DiscussionSearchResult,
  type DiscussionSpaceDetail,
  type DiscussionSpaceSummary,
} from "@/lib/api";
import { pick } from "@/lib/i18n";

export function DiscussionWorkspace({ user }: { user: CurrentUser }) {
  void user;
  const { language } = useLanguage();
  const [spaces, setSpaces] = useState<DiscussionSpaceSummary[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState("");
  const [activeSpace, setActiveSpace] = useState<DiscussionSpaceDetail | null>(null);
  const [messages, setMessages] = useState<DiscussionMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<DiscussionAttachment[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [mentionAi, setMentionAi] = useState(false);
  const [message, setMessage] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchSenderUserId, setSearchSenderUserId] = useState("");
  const [searchSenderType, setSearchSenderType] = useState("");
  const [searchResult, setSearchResult] = useState<DiscussionSearchResult | null>(null);

  useEffect(() => {
    api.listDiscussionSpaces().then((result) => {
      setSpaces(result);
      if (result[0]) setActiveSpaceId((prev) => prev || result[0].id);
    }).catch(() => setSpaces([]));
  }, []);

  useEffect(() => {
    if (!activeSpaceId) return;
    Promise.all([
      api.getDiscussionSpace(activeSpaceId),
      api.listDiscussionMessages(activeSpaceId),
    ]).then(([detail, result]) => {
      setActiveSpace(detail);
      setMessages(result.items);
      setSearchResult(null);
      setSearchSenderUserId("");
      setSearchKeyword("");
      setSearchSenderType("");
    }).catch(() => {
      setActiveSpace(null);
      setMessages([]);
    });
  }, [activeSpaceId]);

  const activeMaterials = useMemo(() => activeSpace?.recent_materials || [], [activeSpace]);
  const searchableMembers = useMemo(
    () => (activeSpace?.members || []).filter((member) => member.role_in_space !== "ai"),
    [activeSpace],
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files || !activeSpaceId) return;
    try {
      const result = await api.uploadDiscussionAttachments(activeSpaceId, Array.from(files));
      setAttachments((prev) => [...prev, ...result]);
      setMessage(pick(language, "附件上传成功。", "Attachments uploaded."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "附件上传失败", "Attachment upload failed"));
    }
  };

  const handleSend = async () => {
    if (!activeSpaceId) return;
    try {
      const result = await api.sendDiscussionMessage({
        space_id: activeSpaceId,
        content,
        is_anonymous: anonymous,
        mention_ai: mentionAi,
        attachment_ids: attachments.map((item) => item.id),
      });
      setMessages((prev) => [...prev, ...result]);
      setContent("");
      setAttachments([]);
      setMessage(pick(language, "消息已发送。", "Message sent."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "发送失败", "Send failed"));
    }
  };

  const handleSearch = async () => {
    if (!activeSpaceId) return;
    try {
      const result = await api.searchDiscussionMessages({
        space_id: activeSpaceId,
        keyword: searchKeyword || undefined,
        sender_user_id: searchSenderUserId || undefined,
        sender_type: searchSenderType || undefined,
      });
      setSearchResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "搜索失败", "Search failed"));
    }
  };

  return (
    <main className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "课程讨论空间", "Discussion Spaces")}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">{pick(language, "围绕课程与班级的讨论空间", "A discussion space for each course and class")}</h2>
        </div>

        <div className="mt-5 space-y-3">
          {spaces.length === 0 ? (
            <div className="section-card rounded-[24px] p-5 text-sm text-slate-500">{pick(language, "当前还没有可用的讨论空间。", "There are no discussion spaces yet.")}</div>
          ) : spaces.map((space) => (
            <button key={space.id} onClick={() => setActiveSpaceId(space.id)} className={`w-full rounded-[24px] px-4 py-4 text-left transition ${activeSpaceId === space.id ? "ui-tab-active" : "ui-pill"}`}>
              <p className="font-semibold text-slate-900">{space.space_name}</p>
              <p className="mt-2 text-xs text-slate-500">{space.class_name} · {pick(language, "成员", "Members")} {space.member_count}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 section-card rounded-[24px] p-5">
          <p className="text-sm font-semibold text-slate-900">{pick(language, "聊天记录查询", "Search Messages")}</p>
          <div className="mt-4 space-y-3">
            <input value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder={pick(language, "按关键词搜索聊天内容", "Search chat content by keyword")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
            <select value={searchSenderUserId} onChange={(e) => setSearchSenderUserId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm">
              <option value="">{pick(language, "按成员姓名筛选实名发言", "Filter identified messages by member")}</option>
              {searchableMembers.map((member) => (
                <option key={`${member.user_id}-${member.role_in_space}`} value={member.user_id}>
                  {member.display_name} · {member.role_in_space}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {["", "teacher", "student", "ai"].map((item) => (
                <button key={item || "all"} onClick={() => setSearchSenderType(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${searchSenderType === item ? "ui-pill-active" : "ui-pill"}`}>
                  {item ? item.toUpperCase() : pick(language, "全部角色", "All Roles")}
                </button>
              ))}
            </div>
            <button onClick={() => void handleSearch()} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{pick(language, "搜索消息", "Search")}</button>
          </div>
          {searchResult ? (
            <div className="mt-4 space-y-3">
              {searchResult.items.length === 0 ? <p className="text-sm text-slate-500">{pick(language, "没有找到匹配消息。", "No matching messages found.")}</p> : searchResult.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.sender_display_name}</p>
                    <span className="text-xs text-slate-500">{item.created_at}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-slate-600">{item.content || pick(language, "附件消息", "Attachment message")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass-panel rounded-[32px] px-5 py-6 md:px-6">
        {activeSpace ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">{activeSpace.course_name}</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{activeSpace.space_name}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{pick(language, "支持实名/匿名发言、文件交流和 AI 群内答疑。", "Supports identified or anonymous posts, file sharing, and AI-guided discussion.")}</p>
              </div>
              <div className="rounded-[24px] bg-white/75 px-4 py-3 text-sm text-slate-600">
                <p>{pick(language, "班级：", "Class: ")}{activeSpace.class_name}</p>
                <p>{pick(language, "成员数：", "Members: ")}{activeSpace.member_count}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-[24px] border border-slate-200 bg-white/65 p-4">
                  {messages.map((item) => (
                    <div key={item.id} className={`rounded-[22px] px-4 py-4 ${item.sender_type === "ai" ? "border border-[var(--active-border)] bg-[var(--active-surface)]" : "border border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <AvatarBadge name={item.sender_display_name} avatarPath={item.is_anonymous ? "" : item.sender_avatar_path} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.sender_display_name}</p>
                          <p className="text-xs text-slate-500">{item.created_at} · {item.sender_type.toUpperCase()}</p>
                        </div>
                      </div>
                      <RichAnswer content={item.content || pick(language, "附件消息", "Attachment message")} className="mt-3 text-sm leading-7 text-slate-700" />
                      {item.ai_sources.length > 0 ? <p className="mt-3 text-xs text-slate-500">{pick(language, "依据：", "Sources: ")}{item.ai_sources.join("；")}</p> : null}
                      {item.attachments.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <button key={attachment.id} onClick={() => void api.openProtectedFile(attachment.download_url, attachment.file_name)} className="ui-pill rounded-full px-3 py-1.5 text-xs font-semibold">
                              {attachment.file_name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="section-card rounded-[24px] p-5">
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder={pick(language, "输入消息；如果希望 AI 助教参与，可以勾选下方开关或直接在内容里写 @AI 助教。", "Enter a message. If you want AI to join, enable the switch below or mention @AI in the text.")} className="w-full rounded-[22px] border border-slate-300 bg-white px-4 py-4 text-sm leading-7" />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">
                      {pick(language, "上传图片 / 文档", "Upload files")}
                      <input type="file" multiple className="hidden" onChange={(e) => void handleUpload(e.target.files)} />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                      {pick(language, "匿名发送", "Send anonymously")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={mentionAi} onChange={(e) => setMentionAi(e.target.checked)} />
                      {pick(language, "请 AI 回答", "Ask AI to reply")}
                    </label>
                    <button onClick={() => void handleSend()} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">{pick(language, "发送", "Send")}</button>
                  </div>
                  {attachments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{item.file_name}</span>)}
                    </div>
                  ) : null}
                  {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="section-card rounded-[24px] p-5">
                  <p className="text-lg font-bold text-slate-900">{pick(language, "空间成员", "Members")}</p>
                  <div className="mt-4 space-y-3">
                    {activeSpace.members.map((member) => (
                      <button key={`${member.user_id}-${member.role_in_space}`} onClick={() => { setSearchSenderUserId(member.role_in_space === "ai" ? "" : member.user_id); void handleSearch(); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                        <AvatarBadge name={member.display_name} avatarPath={member.avatar_path} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{member.display_name}</p>
                          <p className="text-xs text-slate-500">{member.role_in_space}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="section-card rounded-[24px] p-5">
                  <p className="text-lg font-bold text-slate-900">{pick(language, "最近共享资料", "Recent Shared Materials")}</p>
                  <div className="mt-4 space-y-3">
                    {activeMaterials.length === 0 ? <p className="text-sm text-slate-500">{pick(language, "当前没有共享资料。", "There are no shared materials right now.")}</p> : activeMaterials.map((item) => (
                      <button key={item.id} onClick={() => void api.openProtectedFile(item.download_url, item.filename)} className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{item.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.file_type || pick(language, "未知类型", "Unknown type")} · {item.created_at}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : <div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "请选择一个课程讨论空间。", "Choose a discussion space.")}</div>}
      </section>
    </main>
  );
}
