"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RichAnswer } from "@/components/rich-answer";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { WorkspacePage } from "@/components/workspace-shell";
import {
  api,
  type Course,
  type FolderContentsResponse,
  type LearningDirectoryItem,
  type LearningNotebookItem,
  type QuestionFolderItem,
} from "@/lib/api";
import { pick } from "@/lib/i18n";

type SortOrder = "desc" | "asc";

function formatFolderLabel(folder: QuestionFolderItem) {
  return `${"  ".repeat(Math.max(0, folder.depth - 1))}${folder.name}`;
}

export default function StudentQuestionHistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [folders, setFolders] = useState<QuestionFolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState("");
  const [contents, setContents] = useState<FolderContentsResponse | null>(null);
  const [notebook, setNotebook] = useState<LearningNotebookItem | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [newFolderName, setNewFolderName] = useState("");
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [newNotebookText, setNewNotebookText] = useState("");
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "student") return;
    api.listCourses().then((courseList) => {
      setCourses(courseList);
      setSelectedCourseId((prev) => prev || courseList[0]?.id || "");
    }).catch(() => setCourses([]));
  }, [user]);

  const loadContents = async (folderId = currentFolderId, courseId = selectedCourseId, order = sortOrder) => {
    if (!courseId) return;
    const [folderList, folderContents] = await Promise.all([
      api.listQuestionFolders(courseId).catch(() => []),
      folderId
        ? api.getQuestionFolderContents(folderId, { sortBy: "updated_at", sortOrder: order }).catch(() => null)
        : api.getRootQuestionFolderContents({ courseId, sortBy: "updated_at", sortOrder: order }).catch(() => null),
    ]);
    setFolders(folderList);
    if (folderContents) setContents(folderContents);
  };

  useEffect(() => {
    if (!selectedCourseId) return;
    setCurrentFolderId("");
    setNotebook(null);
    void loadContents("", selectedCourseId, sortOrder);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return;
    void loadContents(currentFolderId, selectedCourseId, sortOrder);
  }, [currentFolderId, sortOrder]);

  const selectedCourse = useMemo(() => courses.find((item) => item.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const currentPath = useMemo(() => contents?.breadcrumbs || [], [contents]);
  const currentFolder = useMemo(() => folders.find((item) => item.id === currentFolderId) || null, [currentFolderId, folders]);

  const groupedItems = useMemo(() => {
    const items = contents?.items || [];
    return {
      folders: items.filter((item) => item.item_type === "folder"),
      notebooks: items.filter((item) => item.item_type === "notebook"),
      questions: items.filter((item) => item.item_type === "question"),
    };
  }, [contents]);

  const handleCreateFolder = async () => {
    if (!selectedCourseId || !newFolderName.trim()) return;
    setBusyKey("create-folder");
    setMessage("");
    try {
      await api.createQuestionFolder({
        course_id: selectedCourseId,
        name: newFolderName.trim(),
        parent_folder_id: currentFolderId,
      });
      setNewFolderName("");
      await loadContents();
      setMessage(pick(language, "子文件夹已创建。", "Folder created."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "创建文件夹失败。", "Failed to create folder."));
    } finally {
      setBusyKey("");
    }
  };

  const handleCreateNotebook = async () => {
    if (!selectedCourseId || !newNotebookTitle.trim()) return;
    setBusyKey("create-notebook");
    setMessage("");
    try {
      const created = await api.createLearningNotebook({
        course_id: selectedCourseId,
        parent_folder_id: currentFolderId,
        title: newNotebookTitle.trim(),
        content_text: newNotebookText,
      });
      setNewNotebookTitle("");
      setNewNotebookText("");
      setNotebook(created);
      await loadContents();
      setMessage(pick(language, "记事簿已创建。", "Notebook created."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "创建记事簿失败。", "Failed to create notebook."));
    } finally {
      setBusyKey("");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const confirmed = window.confirm(pick(language, "删除文件夹将同时删除其下所有子文件夹、记事簿和问答记录，是否继续？", "Deleting this folder will also remove all nested folders, notebooks, and Q&A records. Continue?"));
    if (!confirmed) return;
    setBusyKey(`delete-folder-${folderId}`);
    try {
      await api.deleteQuestionFolder(folderId, true);
      if (currentFolderId === folderId) setCurrentFolderId("");
      await loadContents(currentFolderId === folderId ? "" : currentFolderId);
      setMessage(pick(language, "文件夹已删除。", "Folder deleted."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "删除文件夹失败。", "Failed to delete folder."));
    } finally {
      setBusyKey("");
    }
  };

  const handleRenameFolder = async (folder: QuestionFolderItem) => {
    const nextName = window.prompt(pick(language, "请输入新的文件夹名称", "Enter a new folder name"), folder.name);
    if (!nextName || !nextName.trim() || nextName.trim() === folder.name) return;
    setBusyKey(`rename-folder-${folder.id}`);
    try {
      await api.updateQuestionFolder(folder.id, { name: nextName.trim(), description: folder.description });
      await loadContents();
      setMessage(pick(language, "文件夹已重命名。", "Folder renamed."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "重命名文件夹失败。", "Failed to rename folder."));
    } finally {
      setBusyKey("");
    }
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    const confirmed = window.confirm(pick(language, "确认删除这个记事簿吗？", "Delete this notebook?"));
    if (!confirmed) return;
    setBusyKey(`delete-notebook-${notebookId}`);
    try {
      await api.deleteLearningNotebook(notebookId);
      if (notebook?.id === notebookId) setNotebook(null);
      await loadContents();
      setMessage(pick(language, "记事簿已删除。", "Notebook deleted."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "删除记事簿失败。", "Failed to delete notebook."));
    } finally {
      setBusyKey("");
    }
  };

  const openNotebook = async (notebookId: string) => {
    setBusyKey(`open-notebook-${notebookId}`);
    try {
      const detail = await api.getLearningNotebook(notebookId);
      setNotebook(detail);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "加载记事簿失败。", "Failed to load notebook."));
    } finally {
      setBusyKey("");
    }
  };

  const saveNotebook = async () => {
    if (!notebook) return;
    setBusyKey("save-notebook");
    try {
      const saved = await api.updateLearningNotebook(notebook.id, {
        title: notebook.title,
        content_text: notebook.content_text,
        is_starred: notebook.is_starred,
      });
      setNotebook(saved);
      await loadContents();
      setMessage(pick(language, "记事簿已保存。", "Notebook saved."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "保存记事簿失败。", "Failed to save notebook."));
    } finally {
      setBusyKey("");
    }
  };

  const uploadNotebookImages = async (files: FileList | null) => {
    if (!notebook || !files || files.length === 0) return;
    setBusyKey("upload-images");
    try {
      await api.uploadLearningNotebookImages(notebook.id, Array.from(files));
      const detail = await api.getLearningNotebook(notebook.id);
      setNotebook(detail);
      await loadContents();
      setMessage(pick(language, "图片已上传。", "Images uploaded."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "上传图片失败。", "Failed to upload images."));
    } finally {
      setBusyKey("");
    }
  };

  const moveQuestion = async (questionId: string, folderId: string) => {
    setBusyKey(`move-${questionId}`);
    try {
      await api.assignQuestionFolder(questionId, folderId);
      await loadContents();
      setMessage(pick(language, "问答记录已移动。", "Q&A record moved."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick(language, "移动问答记录失败。", "Failed to move question."));
    } finally {
      setBusyKey("");
    }
  };

  if (!user || user.role !== "student") {
    return <WorkspacePage tone="student"><div className="section-card rounded-[28px] p-8 text-center text-slate-500">{pick(language, "正在加载学习问答记录...", "Loading Q&A archive...")}</div></WorkspacePage>;
  }

  return (
    <WorkspacePage tone="student" className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">{pick(language, "学习问答记录", "Learning Q&A Records")}</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">{pick(language, "多级文件夹整理、记事簿沉淀与最近更新排序", "Nested folders, notebooks, and recent-first sorting")}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{pick(language, "你可以在任意目录中继续建立子文件夹，混合管理问答记录和学习笔记，并按最近更新时间快速定位最近整理过的内容。", "Create subfolders inside any folder, mix Q&A records with study notes, and find recently updated content first.")}</p>

        <label className="mt-6 block space-y-2 text-sm">
          <span className="font-semibold text-slate-700">{pick(language, "课程", "Course")}</span>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3">
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>

        <div className="mt-5 rounded-[28px] border border-slate-200 bg-white/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">{pick(language, "当前位置", "Current Path")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <button onClick={() => { setCurrentFolderId(""); setNotebook(null); }} className="ui-pill rounded-full px-3 py-1.5">{pick(language, "根目录", "Root")}</button>
                {currentPath.map((item) => (
                  <button key={item.id} onClick={() => { setCurrentFolderId(item.id); setNotebook(null); }} className="ui-pill rounded-full px-3 py-1.5">
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            <Link href="/student/qa" className="ui-pill rounded-full px-4 py-2 text-sm font-semibold">{pick(language, "去提问", "Ask Questions")}</Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder={pick(language, "新建子文件夹名称", "New subfolder name")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
              <button onClick={() => void handleCreateFolder()} disabled={busyKey === "create-folder"} className="button-primary rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{pick(language, "新建子文件夹", "Create Folder")}</button>
            </div>
            <div className="space-y-3">
              <input value={newNotebookTitle} onChange={(e) => setNewNotebookTitle(e.target.value)} placeholder={pick(language, "新建记事簿标题", "New notebook title")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
              <textarea value={newNotebookText} onChange={(e) => setNewNotebookText(e.target.value)} rows={3} placeholder={pick(language, "可先写下摘要或整理提纲", "Optional opening notes")} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm" />
              <button onClick={() => void handleCreateNotebook()} disabled={busyKey === "create-notebook"} className="button-primary rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{pick(language, "新建记事簿", "Create Notebook")}</button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-slate-700">{pick(language, "排序", "Sort")}</span>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="rounded-full border border-slate-300 bg-white px-3 py-2">
              <option value="desc">{pick(language, "按更新时间，最近优先", "Updated time, newest first")}</option>
              <option value="asc">{pick(language, "按更新时间，最早优先", "Updated time, oldest first")}</option>
            </select>
            {currentFolder ? <button onClick={() => setCurrentFolderId(currentFolder.parent_folder_id || "")} className="ui-pill rounded-full px-3 py-2">{pick(language, "返回上一级", "Go Up")}</button> : null}
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-5 rounded-[28px] border border-slate-200 bg-white/70 p-5">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "全部文件夹", "All Folders")}</p>
          <div className="mt-3 space-y-2">
            {folders.length === 0 ? <p className="text-sm text-slate-500">{pick(language, "当前课程还没有文件夹。", "No folders yet.")}</p> : folders.map((folder) => (
              <div key={folder.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <button onClick={() => { setCurrentFolderId(folder.id); setNotebook(null); }} className="text-left font-semibold text-slate-800">{formatFolderLabel(folder)}</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => void handleRenameFolder(folder)} disabled={busyKey === `rename-folder-${folder.id}`} className="text-slate-500">{pick(language, "重命名", "Rename")}</button>
                  <button onClick={() => void handleDeleteFolder(folder.id)} disabled={busyKey === `delete-folder-${folder.id}`} className="text-rose-600">{pick(language, "删除", "Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
          <p className="text-sm font-semibold text-slate-500">{pick(language, "目录内容", "Folder Contents")}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{currentFolder?.name || selectedCourse?.name || pick(language, "根目录", "Root")}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{pick(language, "文件夹、记事簿和学习问答记录会一起展示，并统一按更新时间排序。", "Folders, notebooks, and Q&A records are shown together and sorted by update time.")}</p>

          <div className="mt-6 space-y-4">
            {[...groupedItems.folders, ...groupedItems.notebooks, ...groupedItems.questions].length === 0 ? <div className="section-card rounded-[24px] p-6 text-sm text-slate-500">{pick(language, "当前目录还没有内容。", "This folder is empty.")}</div> : null}

            {groupedItems.folders.map((item) => (
              <DirectoryCard key={item.id} item={item} onOpenFolder={() => { setCurrentFolderId(item.id); setNotebook(null); }} />
            ))}

            {groupedItems.notebooks.map((item) => (
              <DirectoryCard key={item.id} item={item} onOpenNotebook={() => void openNotebook(item.id)} onDelete={() => void handleDeleteNotebook(item.id)} />
            ))}

            {groupedItems.questions.map((item) => (
              <div key={item.id} className="section-card rounded-[26px] p-5">
                <p className="text-xs font-semibold text-slate-500">{pick(language, "学习问答记录", "Q&A Record")} · {item.updated_at}</p>
                <h4 className="mt-2 text-lg font-bold text-slate-900">{item.question?.title || item.name}</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.question?.question_text}</p>
                {item.question?.ai_answer_content ? <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-3"><p className="text-xs font-semibold text-slate-500">AI</p><RichAnswer content={item.question.ai_answer_content} className="mt-2" /></div> : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-500">{pick(language, "移动到", "Move to")}</span>
                  <select value={item.question?.folder_id || ""} onChange={(e) => void moveQuestion(item.id, e.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-2">
                    <option value="">{pick(language, "根目录", "Root")}</option>
                    {folders.map((folder) => <option key={folder.id} value={folder.id}>{formatFolderLabel(folder)}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {notebook ? (
          <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{pick(language, "记事簿编辑", "Notebook Editor")}</p>
                <p className="mt-1 text-sm text-slate-500">{pick(language, "支持文本记录与图片上传，修改后会更新所在目录的更新时间。", "Supports text notes and image uploads. Saving updates the folder's modified time.")}</p>
              </div>
              <button onClick={() => void saveNotebook()} disabled={busyKey === "save-notebook"} className="button-primary rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{pick(language, "保存记事簿", "Save Notebook")}</button>
            </div>
            <input value={notebook.title} onChange={(e) => setNotebook({ ...notebook, title: e.target.value })} className="mt-5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold" />
            <textarea value={notebook.content_text} onChange={(e) => setNotebook({ ...notebook, content_text: e.target.value })} rows={10} className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7" />
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm">
              <span>{pick(language, "上传图片", "Upload Images")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void uploadNotebookImages(e.target.files)} />
            </label>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {notebook.images.map((image) => (
                <div key={image.id} className="rounded-[22px] border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-slate-800">{image.file_name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => void api.openProtectedFile(image.download_url, image.file_name)} className="ui-pill rounded-full px-3 py-1.5">{pick(language, "查看", "Open")}</button>
                    <button onClick={() => void api.deleteLearningNotebookImage(image.id).then(async () => { const detail = await api.getLearningNotebook(notebook.id); setNotebook(detail); await loadContents(); })} className="ui-pill rounded-full px-3 py-1.5 text-rose-600">{pick(language, "删除", "Delete")}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </WorkspacePage>
  );
}

function DirectoryCard({
  item,
  onOpenFolder,
  onOpenNotebook,
  onDelete,
}: {
  item: LearningDirectoryItem;
  onOpenFolder?: () => void;
  onOpenNotebook?: () => void;
  onDelete?: () => void;
}) {
  const { language } = useLanguage();
  const isFolder = item.item_type === "folder";
  return (
    <div className="section-card rounded-[26px] p-5">
      <p className="text-xs font-semibold text-slate-500">{isFolder ? pick(language, "文件夹", "Folder") : pick(language, "记事簿", "Notebook")} · {item.updated_at}</p>
      <h4 className="mt-2 text-lg font-bold text-slate-900">{item.name}</h4>
      {item.summary ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.summary}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {isFolder ? <button onClick={onOpenFolder} className="ui-pill rounded-full px-4 py-2 text-sm">{pick(language, "进入目录", "Open Folder")}</button> : <button onClick={onOpenNotebook} className="ui-pill rounded-full px-4 py-2 text-sm">{pick(language, "打开记事簿", "Open Notebook")}</button>}
        {!isFolder && onDelete ? <button onClick={onDelete} className="ui-pill rounded-full px-4 py-2 text-sm text-rose-600">{pick(language, "删除", "Delete")}</button> : null}
      </div>
    </div>
  );
}
