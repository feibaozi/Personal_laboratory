'use client';

import { useEffect, useState, useCallback } from 'react';
import { useKnowledgeStore } from '@/store';
import EmptyState from '@/components/common/EmptyState';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function KnowledgePage() {
  const {
    documents,
    loading,
    queryResult,
    queryLoading,
    fetchDocuments,
    uploadDocument,
    uploadDocumentFile,
    deleteDocument,
    queryKnowledge,
    clearQueryResult,
  } = useKnowledgeStore();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [profileContext, setProfileContext] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) return;
    setError('');
    setUploading(true);
    try {
      await uploadDocumentFile(selectedFile);
      setUploadOpen(false);
      setSelectedFile(null);
      fetchDocuments();
    } catch (err) {
      setError(String(err));
    }
    setUploading(false);
  }, [selectedFile, uploadDocumentFile, fetchDocuments]);

  const handleTextUpload = useCallback(async () => {
    if (!filename.trim() || !content.trim()) return;
    setError('');
    setUploading(true);
    try {
      await uploadDocument(filename.trim(), content);
      setUploadOpen(false);
      setFilename('');
      setContent('');
      fetchDocuments();
    } catch (err) {
      setError(String(err));
    }
    setUploading(false);
  }, [filename, content, uploadDocument, fetchDocuments]);

  const handleQuery = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setError('');
      try {
        await queryKnowledge(q);
      } catch (err) {
        setError(String(err));
      }
    },
    [queryKnowledge]
  );

  const handleDelete = useCallback(async () => {
    if (deleteId === null) return;
    await deleteDocument(deleteId);
    setDeleteId(null);
    fetchDocuments();
  }, [deleteId, deleteDocument, fetchDocuments]);

  const handleBuildProfile = useCallback(async () => {
    setBuildingProfile(true);
    setError('');
    try {
      const res = await fetch('/api/knowledge/build-profile', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProfileContext(data.context);
      }
    } catch (err) {
      setError(String(err));
    }
    setBuildingProfile(false);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">知识库</h2>
          <p className="text-sm text-zinc-500 mt-1">
            上传简历、项目经历等文档，让 AI 了解你
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBuildProfile}
            disabled={buildingProfile}
            className="px-4 py-2 text-sm bg-zinc-800 text-white border border-zinc-700 rounded-lg font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {buildingProfile ? '分析中...' : '构建档案'}
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            上传文档
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setUploadOpen(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">上传文档</h3>

            {/* Mode Tabs */}
            <div className="flex gap-1 mb-4 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  uploadMode === 'file'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                上传文件
              </button>
              <button
                onClick={() => setUploadMode('text')}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  uploadMode === 'text'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                粘贴文本
              </button>
            </div>

            {uploadMode === 'file' ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">
                    选择文件（支持 .md / .txt / .pdf / .docx）
                  </label>
                  <input
                    type="file"
                    accept=".md,.txt,.pdf,.docx,.doc"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                  />
                  {selectedFile && (
                    <p className="text-xs text-zinc-500 mt-2">
                      已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">文件名</label>
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="my-resume.md"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">内容</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="粘贴你的文档内容..."
                    rows={12}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none font-mono"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-400 mb-4">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUploadOpen(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={uploadMode === 'file' ? handleFileUpload : handleTextUpload}
                disabled={
                  uploading ||
                  (uploadMode === 'file' ? !selectedFile : !filename.trim() || !content.trim())
                }
                className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? '上传中...' : '上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="mb-10">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          已上传文档
        </h3>
        {loading ? (
          <LoadingSpinner text="加载中..." />
        ) : documents.length === 0 ? (
          <EmptyState
            icon="📄"
            title="还没有文档"
            description="上传你的简历或项目经历，让 AI 了解你的背景"
            action={
              <button
                onClick={() => setUploadOpen(true)}
                className="px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
              >
                上传第一份文档
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {doc.file_type === 'md' ? '📝' : '📃'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">{doc.filename}</p>
                    <p className="text-xs text-zinc-500">
                      {doc.content.length} 字符 · {doc.created_at}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(doc.id)}
                  className="text-sm text-zinc-500 hover:text-red-400 transition-colors"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Preview */}
      {profileContext && (
        <div className="mb-10">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            深度档案（AI 解析）
          </h3>
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-xl p-5">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
              {profileContext}
            </pre>
          </div>
        </div>
      )}

      {/* Knowledge Q&A */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          知识库问答
        </h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQuery(question);
                }
              }}
              placeholder="向你的知识库提问，例如：我有哪些量化策略经验？"
              className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() => handleQuery(question)}
              disabled={!question.trim() || queryLoading}
              className="px-5 py-2.5 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {queryLoading ? '查询中...' : '提问'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {queryLoading && <LoadingSpinner text="正在检索知识库..." />}

          {queryResult && !queryLoading && (
            <div>
              {queryResult.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                  <p className="text-sm text-red-400">{queryResult.error}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-zinc-800 rounded-lg mb-4">
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {queryResult.answer || '(未获取到回答)'}
                    </p>
                  </div>

                  {queryResult.sources && queryResult.sources.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">参考来源：</p>
                  <div className="space-y-1">
                    {queryResult.sources.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-zinc-500"
                      >
                        <span className="text-zinc-600">#</span>
                        <span className="text-zinc-400">{s.filename}</span>
                        <span className="text-zinc-600">
                          (相关度: {(s.similarity * 100).toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={clearQueryResult}
                className="mt-4 text-xs text-zinc-600 hover:text-zinc-400"
              >
                清除结果
              </button>
                </>
              )}
            </div>
          )}

          {!queryResult && !queryLoading && (
            <p className="text-sm text-zinc-600 text-center py-8">
              上传文档后，在这里向你的知识库提问
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="删除文档"
        message="删除后将同时清除该文档的所有分块和嵌入向量，确定要删除吗？"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
