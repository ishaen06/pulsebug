import React, { useState, useEffect } from 'react';
import { MessageSquare, Reply, CheckCircle2, Edit2, Send, Check } from 'lucide-react';
import { Comment, User } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ThreadedCommentsProps {
  bugId: number;
  comments?: Comment[];
  onCommentAdded?: () => void;
}

export const ThreadedComments: React.FC<ThreadedCommentsProps> = ({ bugId, comments: initialComments, onCommentAdded }) => {
  const { user } = useAuth();
  const [commentsList, setCommentsList] = useState<Comment[]>(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      const data = await api.getComments(bugId);
      setCommentsList(data);
    } catch (err: any) {
      console.error('Failed to fetch comments:', err);
    }
  };

  useEffect(() => {
    loadComments();
  }, [bugId]);

  useEffect(() => {
    if (initialComments && initialComments.length > 0) {
      setCommentsList(initialComments);
    }
  }, [initialComments]);

  const handleAddRootComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.addComment(bugId, newComment.trim());
      setNewComment('');
      await loadComments();
      if (onCommentAdded) onCommentAdded();
    } catch (err: any) {
      console.error('Failed to add comment:', err);
      setErrorMessage(err.message || 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddReply = async (parentId: number) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.addComment(bugId, replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingToId(null);
      await loadComments();
      if (onCommentAdded) onCommentAdded();
    } catch (err: any) {
      console.error('Failed to add reply:', err);
      setErrorMessage(err.message || 'Failed to post reply.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolve = async (commentId: number, currentResolved: boolean) => {
    try {
      await api.updateComment(commentId, { is_resolved: !currentResolved });
      await loadComments();
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span>Threaded Collaboration ({commentsList.length})</span>
        </div>
      </div>

      {/* Error notification if submission fails */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Existing Comments List */}
      <div className="space-y-4">
        {commentsList.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No discussion notes yet. Start a conversation with @mentions.
          </div>
        ) : (
          commentsList.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border transition-all ${
                comment.is_resolved
                  ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/20'
                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Comment Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {comment.author?.avatar_url ? (
                    <img src={comment.author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                      {comment.author?.full_name.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{comment.author?.full_name}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleResolve(comment.id, comment.is_resolved)}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      comment.is_resolved
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{comment.is_resolved ? 'Discussion Resolved' : 'Mark Resolved'}</span>
                  </button>
                  <button
                    onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                    className="text-xs text-slate-400 hover:text-blue-500 p-1 cursor-pointer"
                    title="Reply in thread"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Comment Body */}
              <div className="mt-2 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {comment.content}
              </div>

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{reply.author?.full_name}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                        {reply.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Thread Reply Input Box */}
              {replyingToId === comment.id && (
                <div className="mt-3 pl-4 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Reply to ${comment.author?.full_name}...`}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddReply(comment.id); }}
                    autoFocus
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={() => handleAddReply(comment.id)}
                    disabled={isSubmitting || !replyContent.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Root Comment Box */}
      <form onSubmit={handleAddRootComment} className="pt-2 flex gap-2">
        <input
          type="text"
          placeholder="Leave a comment or discussion note (type @ to mention a teammate)..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Comment</span>
        </button>
      </form>
    </div>
  );
};
