"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { JavelinHidDevice, JavPaperTapeEventDetail } from "@/lib/javelinHidDevice";
import ConnectButton from "@/components/connectButton";
import ConnectionStatus from "@/components/connectionStatus";

interface HesitationEntry {
  translation: string;
  hesitations: number[]; // Array of hesitation times in ms
  strokeTranslations: string[];
}

export default function HesitationTracker() {
  const [hid, setHid] = useState<JavelinHidDevice | null>(null);
  const [hesitationLog, setHesitationLog] = useState<HesitationEntry[]>([]);
  const [hesitationThresholdMs, setHesitationThresholdMs] = useState<number>(3000); // Default 3 seconds
  const [averageOverCount, setAverageOverCount] = useState<number>(5);
  const [minOccurrences, setMinOccurrences] = useState<number>(2);
  const [contextCount, setContextCount] = useState<number>(3);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Use refs for mutable values that don't trigger re-renders but need to be consistent inside event handlers
  const lastStrokeTimeRef = useRef<number | null>(null);
  const hesitationThresholdMsRef = useRef(hesitationThresholdMs);

  useEffect(() => {
    hesitationThresholdMsRef.current = hesitationThresholdMs;
  }, [hesitationThresholdMs]);

  const logDisplayRef = useRef<HTMLDivElement>(null); // For auto-scrolling

  // Memoize the event handler to ensure it doesn't change on re-renders unless dependencies change
  const handlePaperTape = useCallback((ev: CustomEvent<JavPaperTapeEventDetail>) => {
    const currentTime = performance.now();
    const strokeTranslation = ev.detail.translation || "";
    const undoCount = ev.detail.undo || 0; // Default to 0 if undefined

    let hesitation = 0;
    if (lastStrokeTimeRef.current !== null) {
      hesitation = currentTime - lastStrokeTimeRef.current;
    }
    lastStrokeTimeRef.current = currentTime;

    // Filter out hesitations above the threshold
    if (hesitation > hesitationThresholdMsRef.current) {
      hesitation = 0;
    }

    setHesitationLog((prevLog) => {
      const newLog = [...prevLog];
      let strokesToUndo = undoCount;
      const recoveredHesitations: number[] = [];
      const recoveredTranslations: string[] = [];
      let modifiedEntryIndex = -1;

      while (strokesToUndo > 0 && newLog.length > 0) {
        const lastIndex = newLog.length - 1;
        // Deep copy the entry to avoid mutation
        const lastEntry = {
          ...newLog[lastIndex],
          hesitations: [...newLog[lastIndex].hesitations],
          strokeTranslations: [...(newLog[lastIndex].strokeTranslations || [])],
        };
        newLog[lastIndex] = lastEntry;

        // Pop the last hesitation
        const poppedHesitation = lastEntry.hesitations.pop();
        const poppedTranslation = lastEntry.strokeTranslations.pop();

        if (poppedHesitation !== undefined) {
          recoveredHesitations.unshift(poppedHesitation);
        }
        if (poppedTranslation !== undefined) {
          recoveredTranslations.unshift(poppedTranslation);
        }

        modifiedEntryIndex = lastIndex;
        strokesToUndo--;

        // If the entry is now empty, remove it
        if (lastEntry.hesitations.length === 0) {
          newLog.pop();
          modifiedEntryIndex = -1; // We removed the entry, so we can't merge into it
        }
      }

      // If translation is empty, it's an undo command (e.g. * key), so we don't add a new entry.
      if (strokeTranslation !== "") {
        const newHesitations = [...recoveredHesitations, hesitation];
        const newStrokeTranslations = [...recoveredTranslations, strokeTranslation];

        // If we modified the last entry and it still exists, update it (merge logic)
        if (modifiedEntryIndex !== -1 && modifiedEntryIndex === newLog.length - 1) {
          newLog[modifiedEntryIndex].translation = strokeTranslation;
          newLog[modifiedEntryIndex].hesitations.push(...newHesitations);
          newLog[modifiedEntryIndex].strokeTranslations.push(...newStrokeTranslations);
        } else {
          // Otherwise push a new entry
          newLog.push({
            translation: strokeTranslation,
            hesitations: newHesitations,
            strokeTranslations: newStrokeTranslations,
          });
        }
      } else {
        // Undo command. If we modified an entry (removed strokes) but didn't remove it entirely,
        // revert the translation to the previous state.
        if (modifiedEntryIndex !== -1 && modifiedEntryIndex === newLog.length - 1) {
          const entry = newLog[modifiedEntryIndex];
          const previousTranslation = entry.strokeTranslations[entry.strokeTranslations.length - 1];
          if (previousTranslation) {
            entry.translation = previousTranslation;
          }
        }
      }

      return newLog;
    });
  }, []);
  // Effect to initialize JavelinHidDevice and set up event listener
  useEffect(() => {
    const device = new JavelinHidDevice();
    setHid(device);

    // Attach paper_tape listener. JavelinHidDevice's 'on' method handles
    // enabling/disabling events on the hardware based on connection status.
    device.on("paper_tape", handlePaperTape);

    // Cleanup: Remove our listeners
    return () => {
      device.off("paper_tape", handlePaperTape);
    };
  }, [handlePaperTape]); // Depend on handlePaperTape to ensure correct event listener


  // Auto-scroll to bottom of the log
  useEffect(() => {
    if (logDisplayRef.current) {
      logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight;
    }
  }, [hesitationLog]);

  // Load/Save logic
  useEffect(() => {
    const savedSetting = localStorage.getItem("javelin-hesitation-autosave");
    if (savedSetting === "true") {
      setIsAutoSaveEnabled(true);
      const savedLog = localStorage.getItem("javelin-hesitation-log");
      if (savedLog) {
        try {
          setHesitationLog(JSON.parse(savedLog));
        } catch (e) {
          console.error("Failed to load log", e);
        }
      }
    }
    const savedThreshold = localStorage.getItem("javelin-hesitation-threshold");
    if (savedThreshold) setHesitationThresholdMs(Number(savedThreshold));
    const savedAverage = localStorage.getItem("javelin-hesitation-average");
    if (savedAverage) setAverageOverCount(Number(savedAverage));
    const savedMinOccurrences = localStorage.getItem("javelin-hesitation-min-occurrences");
    if (savedMinOccurrences) setMinOccurrences(Number(savedMinOccurrences));
    const savedContext = localStorage.getItem("javelin-hesitation-context");
    if (savedContext) setContextCount(Number(savedContext));
  }, []);

  useEffect(() => {
    localStorage.setItem("javelin-hesitation-autosave", String(isAutoSaveEnabled));
    if (isAutoSaveEnabled) {
      localStorage.setItem("javelin-hesitation-log", JSON.stringify(hesitationLog));
    } else {
      localStorage.removeItem("javelin-hesitation-log");
    }
  }, [isAutoSaveEnabled, hesitationLog]);

  useEffect(() => {
    localStorage.setItem("javelin-hesitation-threshold", String(hesitationThresholdMs));
    localStorage.setItem("javelin-hesitation-average", String(averageOverCount));
    localStorage.setItem("javelin-hesitation-min-occurrences", String(minOccurrences));
    localStorage.setItem("javelin-hesitation-context", String(contextCount));
  }, [hesitationThresholdMs, averageOverCount, minOccurrences, contextCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target === document.body || e.target === document.documentElement)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetSettings = () => {
    setHesitationThresholdMs(3000);
    setAverageOverCount(5);
    setMinOccurrences(1);
    setContextCount(3);
  };

  const recentWordIndices = useMemo(() => {
    const indicesMap = new Map<string, number[]>();
    
    for (let i = hesitationLog.length - 1; i >= 0; i--) {
      const entry = hesitationLog[i];
      const word = entry.translation.trim();
      if (!word) continue;

      if (!indicesMap.has(word)) {
        indicesMap.set(word, []);
      }
      const indices = indicesMap.get(word)!;
      if (indices.length < averageOverCount) {
        indices.push(i);
      }
    }
    return indicesMap;
  }, [hesitationLog, averageOverCount]);

  const topHesitations = useMemo(() => {
    const stats = Array.from(recentWordIndices.entries())
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, indices]) => indices.length >= minOccurrences)
      .map(([word, indices]) => {
        const occurrences = indices.map(idx => hesitationLog[idx].hesitations);
        
        // Calculate average for each stroke index
        const maxStrokes = Math.max(...occurrences.map((o) => o.length));
        const avgStrokes: number[] = [];

        for (let i = 0; i < maxStrokes; i++) {
          let sum = 0;
          let count = 0;
          for (const occ of occurrences) {
            if (i < occ.length) {
              sum += occ[i];
              count++;
            }
          }
          avgStrokes.push(count > 0 ? sum / count : 0);
        }

        return {
          word,
          avgFirstStroke: avgStrokes[0] || 0,
          avgStrokes,
        };
      });

    // Sort by first stroke hesitation descending
    return stats
      .sort((a, b) => b.avgFirstStroke - a.avgFirstStroke)
      .slice(0, 20);
  }, [recentWordIndices, hesitationLog, minOccurrences]);

  const hoveredContexts = useMemo(() => {
    if (!hoveredWord) return [];
    
    const indices = recentWordIndices.get(hoveredWord);
    if (!indices) return [];

    return indices.map(i => {
        const prev: string[] = [];
        for (let j = contextCount; j >= 1; j--) {
          const entry = hesitationLog[i - j];
          if (entry) prev.push(entry.translation);
        }

        const next: string[] = [];
        for (let j = 1; j <= contextCount; j++) {
          const entry = hesitationLog[i + j];
          if (entry) next.push(entry.translation);
        }

        return {
          prev,
          current: hesitationLog[i],
          next,
        };
    });
  }, [hoveredWord, recentWordIndices, hesitationLog, contextCount]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Hesitation Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tracks hesitation between strokes.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use this tool to identify words that require more practice.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus hid={hid}/>
          <ConnectButton hid={hid} onConnected={(device) => console.log("Connected to:", device?.productName)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between relative z-20 px-1">
        <div className="relative">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="text-sm font-medium">Settings</span>
          </button>

          {isSettingsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 p-4 z-20 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Configuration</h3>
                  <button onClick={resetSettings} className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded transition-colors">Reset Defaults</button>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="threshold" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Hesitation</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Hesitations longer than this gets ignored.</p>
                  <div className="relative">
                    <input
                      id="threshold"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={hesitationThresholdMs}
                      onChange={(e) => setHesitationThresholdMs(Number(e.target.value))}
                      min="100"
                      step="100"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">ms</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="averageCount" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Average Over</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Number of recent attempts to average.</p>
                  <div className="relative">
                    <input
                      id="averageCount"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={averageOverCount}
                      onChange={(e) => setAverageOverCount(Math.max(1, Number(e.target.value)))}
                      min="1"
                      step="1"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">wd</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="minOccurrences" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Occurrences</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Minimum times a word must appear to be ranked.</p>
                  <div className="relative">
                    <input
                      id="minOccurrences"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={minOccurrences}
                      onChange={(e) => setMinOccurrences(Math.max(1, Number(e.target.value)))}
                      min="1"
                      step="1"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">times</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="contextCount" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History Context</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Number of surrounding words in the history popup.</p>
                  <div className="relative">
                    <input
                      id="contextCount"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={contextCount}
                      onChange={(e) => setContextCount(Math.max(0, Number(e.target.value)))}
                      min="0"
                      step="1"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">wd</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 font-mono">
            Strokes tracked: <span className="font-bold text-gray-900 dark:text-white">{hesitationLog.length}</span>
          </div>
          <button
            onClick={() => setHesitationLog([])}
            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded transition-colors"
          >
            Clear Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Live Log
              <div className="relative group">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div className="absolute left-0 bottom-full mb-2 w-80 p-4 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-21 border border-gray-700">
                  <p className="text-gray-300 leading-relaxed">
                    The numbers represent the hesitation for each stroke. The values are comma-separated, meaning the first number corresponds to the first stroke in the word, the second number to the second, and so on.
                  </p>
                </div>
              </div>
            </h2>
          </div>
          <div ref={logDisplayRef} className="w-full h-96 p-4 border border-gray-800 rounded-xl bg-black text-green-400 font-mono text-sm overflow-y-auto shadow-inner">
            {hesitationLog.length === 0 ? (
              <p className="opacity-50 italic">Start typing on your Javelin device to track hesitations...</p>
            ) : (
              hesitationLog.map((entry, index) => (
                <div key={index} className="mb-1 hover:bg-gray-900/50 px-1 -mx-1 rounded">
                  <span className="font-bold text-green-300">{entry.translation}</span>
                  <span className="text-gray-500 mx-1">:</span>
                  <span className="text-green-500/80">{entry.hesitations.map(h => h === 0 ? "N/A" : `${Math.round(h)}ms`).join(', ')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center h-7">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Hesitations <span className="text-sm font-normal text-gray-500 ml-1">(Last {averageOverCount})</span></h2>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              <input
                type="checkbox"
                checked={isAutoSaveEnabled}
                onChange={(e) => setIsAutoSaveEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span>Save Session</span>
            </label>
          </div>
          <div className="w-full h-96 border border-gray-800 rounded-xl bg-black text-green-400 overflow-hidden shadow-inner flex flex-col">
            {topHesitations.length === 0 ? (
              <p className="text-gray-500 italic p-4">No data yet...</p>
            ) : (
              <div className="flex flex-col h-full">
                <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 grid grid-cols-12 text-xs uppercase tracking-wider font-semibold text-gray-400 backdrop-blur-sm sticky top-0 z-10">
                  <div className="col-span-4">Word</div>
                  <div className="col-span-8">Avg Hesitation</div>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <tbody>
                      {topHesitations.map((item, idx) => (
                        <tr
                          key={item.word}
                          className={`border-b border-gray-800/50 hover:bg-gray-900 transition-colors ${idx % 2 === 0 ? 'bg-black' : 'bg-black/50'}`}
                          onMouseEnter={(e) => {
                            lastMousePos.current = { x: e.clientX, y: e.clientY };
                            setHoveredWord(item.word);
                          }}
                          onMouseMove={(e) => {
                            lastMousePos.current = { x: e.clientX, y: e.clientY };
                            if (tooltipRef.current) {
                              tooltipRef.current.style.top = `${e.clientY + 15}px`;
                              tooltipRef.current.style.left = `${e.clientX + 15}px`;
                            }
                          }}
                          onMouseLeave={() => setHoveredWord(null)}
                        >
                          <td className="px-4 py-2.5 font-medium text-green-300 w-1/3">{item.word}</td>
                          <td className="px-4 py-2.5 text-green-500/90">
                            {item.avgStrokes.map(t => Math.round(t) === 0 ? "N/A" : Math.round(t)).join(', ')} <span className="text-xs text-gray-600 ml-1">ms</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {hoveredWord && (
        <div
          ref={tooltipRef}
          className="fixed z-50 p-4 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl text-xs pointer-events-none"
          style={{ top: lastMousePos.current.y + 15, left: lastMousePos.current.x + 15 }}
        >
          <div className="font-bold mb-3 text-white border-b border-gray-700 pb-2 text-sm">History for &quot;{hoveredWord}&quot;</div>
          {hoveredContexts.map((ctx, idx) => (
            <div key={idx} className="whitespace-nowrap mb-2 last:mb-0 flex items-center">
              <span className="text-gray-500">{ctx.prev.join(" ")}</span>
              <span className="text-white mx-2 font-bold bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{ctx.current.translation}</span>
              <span className="text-gray-500">{ctx.next.join(" ")}</span>
              <span className="ml-auto pl-4 text-green-400 font-mono">
                {ctx.current.hesitations.map((h) => h === 0 ? "N/A" : Math.round(h) + "ms").join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}