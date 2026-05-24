import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../../utils/socketContext";
import api from "../../utils/api";

const ChatInput = ({ roomId, currentUserGithub, partnerGithub }) => {
  const [text, setText] = useState("");
  const [showRepoHelper, setShowRepoHelper] = useState(false);
  const { sendMessage, emitTyping, emitStopTyping } = useSocket();
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // @ mention autocomplete state
  const [mentionState, setMentionState] = useState("idle"); // idle | picking_user | picking_repo
  const [mentionQuery, setMentionQuery] = useState("");
  const [repos, setRepos] = useState([]);
  const [repoQuery, setRepoQuery] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const dropdownRef = useRef(null);

  // Build list of available GitHub usernames
  const githubUsers = [];
  if (currentUserGithub) githubUsers.push(currentUserGithub);
  if (partnerGithub && partnerGithub !== currentUserGithub) githubUsers.push(partnerGithub);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleSend = useCallback(() => {
    if (!text.trim() || !roomId) return;
    const clientMessageId = generateId();
    sendMessage(roomId, text.trim(), clientMessageId);
    setText("");
    setMentionState("idle");
    emitStopTyping(roomId);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [text, roomId, sendMessage, emitStopTyping]);

  const handleKeyDown = (e) => {
    if (mentionState !== "idle") {
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState("idle");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      if (mentionState !== "idle") {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);

    // Check for @ mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Find the last @ that could be a mention trigger
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if we're in repo selection mode (username/...)
      const slashIndex = afterAt.indexOf("/");

      if (slashIndex !== -1) {
        // We have @username/ — check if the username matches one of our github users
        const typedUsername = afterAt.slice(0, slashIndex);
        const matchedUser = githubUsers.find(
          (u) => u.toLowerCase() === typedUsername.toLowerCase()
        );

        if (matchedUser) {
          const afterSlash = afterAt.slice(slashIndex + 1);
          // Only show repo picker if there's no space (still typing repo name)
          if (!/\s/.test(afterSlash)) {
            if (selectedUsername !== matchedUser || mentionState !== "picking_repo") {
              setSelectedUsername(matchedUser);
              fetchRepos(matchedUser);
            }
            setRepoQuery(afterSlash);
            setMentionStartPos(lastAtIndex);
            setMentionState("picking_repo");
          } else {
            setMentionState("idle");
          }
        } else {
          setMentionState("idle");
        }
      } else {
        // No slash yet — show username picker
        if (!/\s/.test(afterAt) && githubUsers.length > 0) {
          setMentionQuery(afterAt);
          setMentionStartPos(lastAtIndex);
          setMentionState("picking_user");
        } else {
          setMentionState("idle");
        }
      }
    } else {
      setMentionState("idle");
    }

    // Typing indicator
    emitTyping(roomId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitStopTyping(roomId), 2000);
  };

  const fetchRepos = async (username) => {
    if (!username) return;
    setLoadingRepos(true);
    try {
      const res = await api.get(`/chat/github/repos/${encodeURIComponent(username)}`);
      setRepos(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch repos:", err);
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  const selectUsername = (username) => {
    // Replace @query with @username/
    const before = text.slice(0, mentionStartPos);
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const after = text.slice(cursorPos);
    const newText = `${before}@${username}/${after}`;
    setText(newText);
    setSelectedUsername(username);
    setMentionState("picking_repo");
    setRepoQuery("");
    fetchRepos(username);

    // Focus and set cursor after the /
    setTimeout(() => {
      const newCursorPos = before.length + 1 + username.length + 1; // @username/
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const selectRepo = (repoName) => {
    // Replace @username/query with @username/repoName
    const before = text.slice(0, mentionStartPos);
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const after = text.slice(cursorPos);
    const newText = `${before}@${selectedUsername}/${repoName} ${after}`;
    setText(newText);
    setMentionState("idle");

    setTimeout(() => {
      const newCursorPos = before.length + 1 + selectedUsername.length + 1 + repoName.length + 1;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setMentionState("idle");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insertRepoMention = () => {
    setShowRepoHelper(!showRepoHelper);
  };

  const insertRepoText = (format) => {
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    setText(`${before}${format}${after}`);
    setShowRepoHelper(false);
    inputRef.current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData("text");
    if (pasted) {
      const githubUrlMatch = pasted.match(
        /https?:\/\/github\.com\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)(\/.*)?/
      );
      if (githubUrlMatch) {
        e.preventDefault();
        const owner = githubUrlMatch[1];
        const repo = githubUrlMatch[2];
        const path = githubUrlMatch[3]
          ? githubUrlMatch[3].replace(/^\/(?:tree|blob)\/[^/]+/, "")
          : "";
        const mention = `@${owner}/${repo}${path}`;
        const cursorPos = inputRef.current?.selectionStart || text.length;
        const before = text.slice(0, cursorPos);
        const after = text.slice(cursorPos);
        setText(`${before}${mention}${after}`);
      }
    }
  };

  // Filter usernames by query
  const filteredUsers = githubUsers.filter((u) =>
    u.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Filter repos by query
  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoQuery.toLowerCase())
  );

  // Language color mapping
  const langColors = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
    Java: "#b07219", "C++": "#f34b7d", Go: "#00ADD8", Rust: "#dea584",
    Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF",
    HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", Dart: "#00B4AB",
  };

  return (
    <div className="border-t border-white/5 p-3 bg-[#0f1729]/50 relative">
      {/* @ Mention Dropdown */}
      {mentionState !== "idle" && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-3 right-3 mb-2 max-h-64 overflow-y-auto rounded-xl bg-[#1a2236] border border-white/10 shadow-2xl shadow-black/50 animate-fade-in-up z-50"
        >
          {mentionState === "picking_user" && (
            <>
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  Select GitHub Username
                </p>
              </div>
              {filteredUsers.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-slate-500">No GitHub usernames available</p>
                  <p className="text-[10px] text-slate-600 mt-1">Add GitHub username in profile settings</p>
                </div>
              ) : (
                filteredUsers.map((username) => (
                  <button
                    key={username}
                    onClick={() => selectUsername(username)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                        {username}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {username === currentUserGithub ? "You" : "Chat Partner"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </>
          )}

          {mentionState === "picking_repo" && (
            <>
              <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  Select Repository — @{selectedUsername}
                </p>
                <button
                  onClick={() => setMentionState("idle")}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {loadingRepos ? (
                <div className="flex items-center justify-center py-6">
                  <span className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  <span className="text-xs text-slate-500 ml-2">Loading repos...</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-slate-500">
                    {repoQuery ? "No matching repositories" : "No public repositories found"}
                  </p>
                </div>
              ) : (
                filteredRepos.slice(0, 20).map((repo) => (
                  <button
                    key={repo.name}
                    onClick={() => selectRepo(repo.name)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z" />
                      </svg>
                      <span className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors truncate">
                        {repo.name}
                      </span>
                      {repo.language && (
                        <span className="flex items-center gap-1 ml-auto text-[10px] text-slate-500 flex-shrink-0">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: langColors[repo.language] || "#8b949e" }}
                          />
                          {repo.language}
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1 pl-6">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 pl-6">
                      {repo.stargazers_count > 0 && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                          ⭐ {repo.stargazers_count}
                        </span>
                      )}
                      {repo.forks_count > 0 && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                          🔱 {repo.forks_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* Repo helper dropdown (original) */}
      {showRepoHelper && (
        <div className="mb-2 p-2 rounded-xl bg-white/[0.04] border border-white/10 animate-fade-in-up">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider font-medium">
            Insert Repository Reference
          </p>
          <div className="space-y-1">
            <button
              onClick={() => insertRepoText("@username/repository")}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z" />
              </svg>
              <span className="font-mono text-purple-300">@username/repository</span>
              <span className="text-slate-600 ml-auto">Repository</span>
            </button>
            <button
              onClick={() => insertRepoText("@username/repository/path/to/file")}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-mono text-purple-300">@username/repo/path</span>
              <span className="text-slate-600 ml-auto">File</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            💡 Type <span className="font-mono text-purple-400">@</span> to autocomplete GitHub usernames and repos
          </p>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Action Buttons */}
        <div className="flex gap-1">
          <button
            onClick={insertRepoMention}
            className={`p-2 rounded-lg transition-colors ${
              showRepoHelper
                ? "bg-purple-500/20 text-purple-300"
                : "hover:bg-white/5 text-slate-500 hover:text-slate-300"
            }`}
            title="Insert repo mention"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message... Use @ to mention repos"
            rows={1}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none input-glow transition-all resize-none max-h-28 overflow-y-auto"
            style={{ minHeight: "42px" }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            text.trim()
              ? "btn-gradient shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
              : "bg-white/5 text-slate-600 cursor-not-allowed"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
