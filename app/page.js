"use client";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState("duckduckgo");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // ---- Premium Features States ----
  const [searchTime, setSearchTime] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [theme, setTheme] = useState("system"); // 'system', 'light', 'dark'
  const [copiedLink, setCopiedLink] = useState(null);
  
  const historyRef = useRef(null);

  // ---- Summariser states ----
  const [summarisingIndex, setSummarisingIndex] = useState(null);
  const [summaryMap, setSummaryMap] = useState({});

  // Initialize theme & history on mount
  useEffect(() => {
    // Load History
    const savedHistory = localStorage.getItem("searchlifyHistory");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    // Load Theme preference
    const savedTheme = localStorage.getItem("searchlifyTheme");
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme("system");
    }

    // Close history dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyTheme = (newTheme) => {
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark-theme");
      document.documentElement.classList.remove("light-theme");
    } else if (newTheme === "light") {
      document.documentElement.classList.add("light-theme");
      document.documentElement.classList.remove("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme", "light-theme");
    }
  };

  const toggleTheme = () => {
    let nextTheme = "light";
    if (theme === "light") nextTheme = "dark";
    if (theme === "dark") nextTheme = "system";
    
    setTheme(nextTheme);
    localStorage.setItem("searchlifyTheme", nextTheme);
    applyTheme(nextTheme);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setShowHistory(true);
  };

  const addToHistory = (searchQuery) => {
    if (!searchQuery.trim()) return;
    const newHistory = [searchQuery, ...history.filter(q => q !== searchQuery)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem("searchlifyHistory", JSON.stringify(newHistory));
  };

  const clearHistory = (e) => {
    e.stopPropagation();
    setHistory([]);
    localStorage.removeItem("searchlifyHistory");
    setShowHistory(false);
  };

  const selectHistoryItem = (item) => {
    setQuery(item);
    setShowHistory(false);
    // trigger search with new query
    performSearch(item);
  };

  const handleSearch = () => {
    performSearch(query);
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSummaryMap({});
    setShowHistory(false);
    addToHistory(searchQuery);

    const startTime = performance.now();

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, engine }),
      });
      const data = await response.json();
      
      const endTime = performance.now();
      setSearchTime(((endTime - startTime) / 1000).toFixed(2));

      if (data.results && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setError("No results found or invalid response format");
      }
    } catch (err) {
      setError("Failed to fetch results. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarise = async (index, snippet) => {
    if (!snippet || snippet.length < 50) {
      setSummaryMap(prev => ({ ...prev, [index]: "Text too short to summarise." }));
      return;
    }
    setSummarisingIndex(index);
    try {
      const resp = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snippet, maxLength: 80 }),
      });
      const data = await resp.json();
      setSummaryMap(prev => ({
        ...prev,
        [index]: data.summary || "Could not generate summary.",
      }));
    } catch (err) {
      setSummaryMap(prev => ({
        ...prev,
        [index]: "Error contacting summariser.",
      }));
    } finally {
      setSummarisingIndex(null);
    }
  };

  const copyToClipboard = async (link, index) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(index);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  };

  const handleClear = () => {
    setQuery("");
  };

  return (
    <main className="search-app-container">
      {/* Theme Toggle Button */}
      <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
        {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
      </button>

      <div className="searchbar">
        <div className="logo-section">
          <div className="logo-badge">AI</div>
          <h1 className="txt">Searchlify</h1>
        </div>
        <h3 className="txt2">Your Personal AI Powered Search Engine</h3>

        <div className="search-box-unified">
          <div className="input-wrapper" ref={historyRef}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              className="searchlify-input"
              onChange={handleChange}
              onFocus={() => setShowHistory(true)}
              value={query}
              type="text"
              placeholder="Ask anything..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            
            {/* Search History Dropdown */}
            {showHistory && history.length > 0 && (
              <div className="history-dropdown">
                <div className="history-header">
                  <span>Recent Searches</span>
                  <button onClick={clearHistory} className="clear-history-btn">Clear</button>
                </div>
                {history.map((item, idx) => (
                  <div key={idx} className="history-item" onClick={() => selectHistoryItem(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="history-icon">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {query && (
              <button className="clear-btn" onClick={handleClear} aria-label="Clear query">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          <div className="controls-row">
            <div className="select-wrapper">
              <select className="engine-select" onChange={(e) => setEngine(e.target.value)} value={engine}>
                <option value="duckduckgo">🦆 DuckDuckGo</option>
                <option value="yahoo">🟪 Yahoo</option>
                <option value="wikipedia">📖 Wikipedia</option>
                <option value="wikidata">🗂️ Wikidata</option>
                <option value="searchlify">⚡ Searchlify</option>
                <option value="scholar">🎓 Google Scholar</option>
              </select>
            </div>

            <button className="btn" onClick={handleSearch} disabled={loading}>
              {loading ? (
                <span className="spinner-wrapper">
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3"></circle>
                  </svg>
                  <span>Searching</span>
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Metadata Badge */}
      {!loading && results.length > 0 && (
        <div className="metadata-badge fade-in">
          Found {results.length} results in {searchTime}s
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="skeleton-container">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton-card">
              <div className="skeleton-header"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-text-line"></div>
              <div className="skeleton-text-line short"></div>
            </div>
          ))}
        </div>
      )}

      <div className="results">
        {results.map((result, index) => {
          const domain = getDomain(result.link);
          return (
            <div key={index} className="result-card fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="result-header-row">
                {domain && (
                  <div className="result-meta">
                    <img
                      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                      alt=""
                      className="result-favicon"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <span className="result-domain">{domain}</span>
                  </div>
                )}
                
                {/* Copy Link Button */}
                <button 
                  className="copy-btn" 
                  onClick={() => copyToClipboard(result.link, index)}
                  aria-label="Copy link"
                  title="Copy Link"
                >
                  {copiedLink === index ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="copied-icon">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              </div>

              <h2 className="result-title">
                <a href={result.link} target="_blank" rel="noopener noreferrer">
                  {result.title}
                </a>
              </h2>
              <p className="result-snippet">{result.snippet}</p>
              <a href={result.link} target="_blank" rel="noopener noreferrer" className="links">
                {result.link}
              </a>

              {/* ---- Summarise button & area ---- */}
              <div className="summarise-container">
                <button
                  onClick={() => handleSummarise(index, result.snippet)}
                  disabled={summarisingIndex === index}
                  className="summarise-btn"
                >
                  {summarisingIndex === index ? (
                    <span className="summarise-loading">
                      <svg className="spinner mini" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3"></circle>
                      </svg>
                      Summarising…
                    </span>
                  ) : (
                    <>✨ Summarise with AI</>
                  )}
                </button>

                {summaryMap[index] && (
                  <div className="summary-box fade-in">
                    <div className="summary-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span>AI Insights</span>
                    </div>
                    <div className="summary-content">{summaryMap[index]}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}