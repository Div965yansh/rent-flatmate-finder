import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { createChatSocket, disconnectChatSocket } from '../services/socket';

/**
 * Phase 8 Step 3: Frontend Chat Experience
 *
 * Dedicated chat interface for authorized tenants and property owners
 * of accepted interest inquiries.
 */
export default function ChatPage() {
  const { interestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  // Chat messages & pagination
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Error & Status
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

  // Composer
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Interest & Listing metadata for header
  const [interestMeta, setInterestMeta] = useState(location.state?.interest || null);

  // Scroll references
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialScrolledRef = useRef(false);

  // 1. Resolve Interest & Listing metadata if not passed in navigation state
  useEffect(() => {
    let isMounted = true;

    async function fetchInterestMetadata() {
      if (interestMeta || !user || !interestId) return;

      try {
        const endpoint = user.role === 'OWNER' ? '/interests/inbox' : '/interests/mine';
        const res = await api.get(endpoint);
        const allInterests = res.data.interests || [];
        const match = allInterests.find((i) => i.id === interestId);
        if (isMounted && match) {
          setInterestMeta(match);
        }
      } catch {
        // Non-blocking: Chat messages will still load or handle access authorization
      }
    }

    fetchInterestMetadata();

    return () => {
      isMounted = false;
    };
  }, [interestId, interestMeta, user]);

  // 2. Fetch Initial Message History via REST
  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!interestId) return;

      try {
        const res = await api.get(`/messages/${interestId}?page=1&limit=50`);
        if (!isMounted) return;
        setMessages(res.data.messages || []);
        setPagination(
          res.data.pagination || {
            page: 1,
            limit: 50,
            total: (res.data.messages || []).length,
            hasMore: false,
          }
        );
      } catch (err) {
        if (!isMounted) return;
        const status = err.response?.status;
        setErrorStatus(status);
        if (status === 403) {
          setError("You don't have access to this conversation.");
        } else if (status === 404) {
          setError('Conversation not found.');
        } else if (status === 401) {
          setError('Your session has expired. Please log in again.');
        } else {
          setError(err.response?.data?.error || 'Failed to load conversation history.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [interestId]);

  // 3. Load Older Messages (Pagination)
  const handleLoadOlderMessages = async () => {
    if (loadingOlder || !pagination.hasMore) return;

    try {
      setLoadingOlder(true);
      const nextPage = pagination.page + 1;
      const res = await api.get(`/messages/${interestId}?page=${nextPage}&limit=50`);
      const olderMessages = res.data.messages || [];

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const deduplicatedOlder = olderMessages.filter((m) => !existingIds.has(m.id));
        return [...deduplicatedOlder, ...prev];
      });

      setPagination(res.data.pagination || { ...pagination, page: nextPage, hasMore: false });
    } catch {
      setSendError('Failed to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  // 4. Socket.io Realtime Connection & Lifecycle
  useEffect(() => {
    if (!token || !interestId) return;

    const socket = createChatSocket(token);
    if (!socket) return;

    const joinConversationRoom = () => {
      socket.emit('conversation:join', { interestId }, (ack) => {
        if (ack?.error) {
          const code = ack.error.code;
          if (code === 'FORBIDDEN') {
            setError("You don't have access to this conversation.");
            setErrorStatus(403);
          } else if (code === 'NOT_FOUND') {
            setError('Conversation not found.');
            setErrorStatus(404);
          } else if (code === 'UNAUTHORIZED') {
            setError('Your session has expired. Please log in again.');
            setErrorStatus(401);
          } else {
            setError(ack.error.message || 'Unable to join conversation.');
          }
        }
      });
    };

    const onConnect = () => {
      setConnectionStatus('connected');
      joinConversationRoom();
    };

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    const onConnectError = () => {
      setConnectionStatus('disconnected');
    };

    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };

    const onNewMessage = (newMsg) => {
      if (!newMsg || newMsg.interestId !== interestId) return;

      // Strict message ID deduplication
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });

      // Conditional auto-scroll if near bottom
      const container = messagesContainerRef.current;
      if (container) {
        const threshold = 160;
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
        if (isNearBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 30);
        }
      }
    };

    // Attach listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    if (socket.io) {
      socket.io.on('reconnect_attempt', onReconnectAttempt);
    }
    socket.on('message:new', onNewMessage);

    // Initial state trigger
    if (socket.connected) {
      joinConversationRoom();
    } else {
      socket.connect();
    }

    // Cleanup on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      if (socket.io) {
        socket.io.off('reconnect_attempt', onReconnectAttempt);
      }
      socket.off('message:new', onNewMessage);
      disconnectChatSocket();
    };
  }, [token, interestId]);

  // 5. Initial Auto-scroll to bottom once messages load
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      initialScrolledRef.current = true;
    }
  }, [loading, messages.length]);

  // 6. Send Message handler
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();

    const trimmed = messageText.trim();
    if (!trimmed || sending) return;

    if (trimmed.length > 2000) {
      setSendError('Message cannot exceed 2000 characters');
      return;
    }

    const socket = createChatSocket(token);
    if (!socket || !socket.connected) {
      setSendError('Cannot send message: not connected to realtime server.');
      return;
    }

    setSending(true);
    setSendError('');

    socket.emit('message:send', { interestId, body: trimmed }, (response) => {
      setSending(false);

      if (response?.error) {
        setSendError(response.error.message || 'Message could not be sent.');
        return;
      }

      if (response?.success && response.message) {
        setMessageText('');
        // Deduplicate and append authoritative server message
        setMessages((prev) => {
          if (prev.some((m) => m.id === response.message.id)) {
            return prev;
          }
          return [...prev, response.message];
        });

        // Always scroll to bottom after user sends their own message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        setSendError('Message could not be sent.');
      }
    });
  };

  // Keyboard navigation for composer: Enter sends, Shift+Enter adds newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Participant & Listing details calculation for header
  const isOwner = user?.role === 'OWNER';
  let participantName = 'Chat Participant';
  let listingTitle = 'Rental Property';
  let listingLocation = '';
  let listingRent = null;

  if (interestMeta) {
    if (isOwner) {
      participantName = interestMeta.tenant?.name || 'Prospective Tenant';
    } else {
      participantName = interestMeta.listing?.owner?.name || 'Property Owner';
    }
    listingTitle = interestMeta.listing?.title || 'Rental Property';
    listingLocation = interestMeta.listing?.location || '';
    listingRent = interestMeta.listing?.rent;
  } else if (messages.length > 0) {
    const otherMsg = messages.find((m) => m.senderId !== user?.id);
    if (otherMsg?.sender?.name) {
      participantName = otherMsg.sender.name;
    }
  }

  // 7. Render Error Screen if conversation access fails
  if (error && !loading) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-8 text-center space-y-5 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 text-2xl font-bold">
            {errorStatus === 403 ? '🔒' : errorStatus === 404 ? '🔍' : '⚠️'}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {errorStatus === 403
                ? 'Access Restricted'
                : errorStatus === 404
                ? 'Conversation Not Found'
                : 'Unable to Load Chat'}
            </h1>
            <p className="text-sm text-slate-600 mt-2">{error}</p>
            {errorStatus === 403 && (
              <p className="text-xs text-slate-500 mt-1">
                Chat conversations are only accessible between the prospective tenant and listing
                owner after an interest inquiry has been accepted.
              </p>
            )}
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {errorStatus === 401 ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Log In Again
              </button>
            ) : (
              <Link
                to="/inbox"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                ← Return to Inquiries
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 8. Main Chat Layout
  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4">
      <div className="flex flex-col h-[calc(100vh-10rem)] min-h-[520px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* ================= HEADER ================= */}
        <header className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/inbox"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all text-xs font-semibold shrink-0 cursor-pointer"
              title="Return to Inquiries"
              aria-label="Back to inquiries"
            >
              ← Back
            </Link>

            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0">
              {participantName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 truncate">{participantName}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  {isOwner ? 'Tenant' : 'Owner'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                <span className="text-indigo-600 font-medium">{listingTitle}</span>
                {listingLocation ? ` • 📍 ${listingLocation}` : ''}
                {listingRent ? ` • ₹${Number(listingRent).toLocaleString()}/mo` : ''}
              </p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {connectionStatus === 'connected' && (
              <div
                id="socket-status-connected"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Connected</span>
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div
                id="socket-status-connecting"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Connecting...</span>
              </div>
            )}
            {connectionStatus === 'reconnecting' && (
              <div
                id="socket-status-reconnecting"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Reconnecting...</span>
              </div>
            )}
            {connectionStatus === 'disconnected' && (
              <div
                id="socket-status-disconnected"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-medium text-rose-700"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
        </header>

        {/* ================= RECONNECTING BANNER ================= */}
        {connectionStatus === 'reconnecting' && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between shrink-0">
            <span>Connection lost. Attempting to reconnect...</span>
          </div>
        )}

        {/* ================= MESSAGES AREA ================= */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50"
          aria-live="polite"
        >
          {/* Pagination: Load older messages button */}
          {pagination.hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                id="load-older-messages-btn"
                disabled={loadingOlder}
                onClick={handleLoadOlderMessages}
                className="px-4 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {loadingOlder ? 'Loading older messages...' : '↑ Load older messages'}
              </button>
            </div>
          )}

          {/* Loading Initial Messages Skeleton */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-2xl">
                💬
              </div>
              <h2 className="text-base font-bold text-slate-900">No messages yet</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Start the conversation with <strong className="text-slate-700">{participantName}</strong> regarding{' '}
                <strong className="text-indigo-600">{listingTitle}</strong>.
              </p>
            </div>
          ) : (
            /* Chronological Message List */
            messages.map((msg) => {
              const isCurrentUser = msg.senderId === user?.id;
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  id={`chat-message-${msg.id}`}
                  className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-xs ${
                      isCurrentUser
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200'
                    }`}
                  >
                    {!isCurrentUser && (
                      <span className="text-[11px] font-bold text-indigo-600 block mb-1">
                        {msg.sender?.name || participantName}
                      </span>
                    )}

                    {/* Plain Text Safety: Strictly escapes HTML */}
                    <p className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed">
                      {msg.body}
                    </p>

                    <span
                      className={`text-[10px] block text-right mt-1.5 ${
                        isCurrentUser ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {formattedTime}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom Anchor for Auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* ================= COMPOSER ================= */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0 space-y-2">
          {/* Send Error Notice */}
          {sendError && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <span>{sendError}</span>
              <button
                type="button"
                onClick={() => setSendError('')}
                className="text-rose-500 hover:text-rose-700 ml-2 font-bold cursor-pointer"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-end gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <textarea
                id="chat-message-input"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                maxLength={2000}
                rows={2}
                disabled={sending || !!error}
                className="w-full resize-none rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50"
                aria-label="Type a message"
              />
              <div className="flex justify-between items-center px-1 text-[10px] text-slate-400">
                <span>Shift+Enter for newline</span>
                <span className={messageText.length > 1800 ? 'text-amber-600 font-semibold' : ''}>
                  {messageText.length} / 2000
                </span>
              </div>
            </div>

            <button
              id="chat-send-btn"
              type="submit"
              disabled={
                sending ||
                !messageText.trim() ||
                messageText.length > 2000 ||
                !!error ||
                connectionStatus === 'disconnected'
              }
              className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              aria-label="Send message"
            >
              {sending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">Sending</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <span>➤</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
