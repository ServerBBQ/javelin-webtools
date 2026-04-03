"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { JavelinHidDevice, JavPaperTapeEventDetail } from "@/lib/javelinHidDevice";
import ConnectButton from "@/components/connectButton";
import ConnectionStatus from "@/components/connectionStatus";

interface PaperTapeEntry {
  translation: string;
  outline: string[];
}

interface NgramEntry {
  count: number;
  outlines: string[];
}

const ITEM_HEIGHT = 72;
const CONTAINER_HEIGHT = 500;
const VIRTUAL_SCROLL_BUFFER_ITEMS = 5; // Number of items to render above and below the visible viewport


function getNgramText(n: number, log: PaperTapeEntry[]){
  let index = log.length - 1;
  const output: string[] = [];
  for (let i = 0; i < n; i++){
    if (index < 0) {
      return null;
    }
    
    const undo = log[index].outline.length -1;
    output.unshift(log[index].translation);

    if (undo) {
      i += undo;
      index -= undo;

      // Ends on a partial stroke
      if (i > n || undo >= n) {
        return null;
      }
    }
    index--;
  }


  return output.join(" ");
}

function getNgramOutlines(n: number, log: PaperTapeEntry[]) {
  let index = log.length - 1;
  const output: string[] = [];
  for (let i = 0; i < n; i++) {
    if (index < 0) return null;

    const entry = log[index];
    const undo = entry.outline.length - 1;
    output.unshift(entry.outline.join("/"));

    if (undo > 0) {
      i += undo;
      index -= undo;
      if (i > n || undo >= n) return null;
    }
    index--;
  }

  return output.join(" ");
}

export default function BriefSuggestions() {
  const [hid, setHid] = useState<JavelinHidDevice | null>(null);
  const [nGrams, setNgrams] = useState<Record<string, NgramEntry>>({});
  const [minCount, setMinCount] = useState<number>(2);
  const [maxNgram, setMaxNgram] = useState<number>(4);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const paperTapeLogRef = useRef<PaperTapeEntry[]>([]);
  const [hiddenOutlines, setHiddenOutlines] = useState<string[]>([]);
  const hiddenOutlineInputRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [saveTrigger, setSaveTrigger] = useState(0);

  const maxNgramRef = useRef(maxNgram);
  useEffect(() => {
    maxNgramRef.current = maxNgram;
  }, [maxNgram]);

  // Load/Save settings
  useEffect(() => {
    const savedSetting = localStorage.getItem("javelin-briefs-autosave");
    if (savedSetting === "true") {
      setIsAutoSaveEnabled(true);
      try {
        const savedNGrams = localStorage.getItem("javelin-briefs-ngrams");
        if (savedNGrams) setNgrams(JSON.parse(savedNGrams));
        const savedLog = localStorage.getItem("javelin-briefs-log");
        if (savedLog) paperTapeLogRef.current = JSON.parse(savedLog);
        const savedHidden = localStorage.getItem("javelin-briefs-hidden");
        if (savedHidden) setHiddenOutlines(JSON.parse(savedHidden));
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
    const savedMin = localStorage.getItem("javelin-briefs-min-count");
    if (savedMin) setMinCount(Number(savedMin));
    const savedMax = localStorage.getItem("javelin-briefs-max-ngram");
    if (savedMax) setMaxNgram(Number(savedMax));
  }, []);

  useEffect(() => {
    localStorage.setItem("javelin-briefs-min-count", String(minCount));
  }, [minCount]);

  useEffect(() => {
    localStorage.setItem("javelin-briefs-max-ngram", String(maxNgram));
  }, [maxNgram]);

  useEffect(() => {
    localStorage.setItem("javelin-briefs-autosave", String(isAutoSaveEnabled));
    if (isAutoSaveEnabled) {
      localStorage.setItem("javelin-briefs-ngrams", JSON.stringify(nGrams));
      localStorage.setItem("javelin-briefs-log", JSON.stringify(paperTapeLogRef.current));
      localStorage.setItem("javelin-briefs-hidden", JSON.stringify(hiddenOutlines));
    } else {
      localStorage.removeItem("javelin-briefs-ngrams");
      localStorage.removeItem("javelin-briefs-log");
      localStorage.removeItem("javelin-briefs-hidden");
    }
  }, [isAutoSaveEnabled, nGrams, hiddenOutlines, saveTrigger]);

  const resetSettings = () => {
    setMinCount(2);
    setMaxNgram(4);
  };

  const updateNgrams = useCallback((log: PaperTapeEntry[], delta: number) => {
    const logSnapshot = [...log];
    setNgrams((prev) => {
      const next = { ...prev };
      // Track combinations from 2 up to the current maxNgram value
      for (let n = 2; n <= maxNgramRef.current; n++) {
        const text = getNgramText(n, logSnapshot);
        if (text) {
          const entry = { ...(next[text] || { count: 0, outlines: [] }) };
          entry.count = Math.max(0, entry.count + delta);

          if (delta > 0) {
            const outlines = getNgramOutlines(n, logSnapshot);
            if (outlines && !entry.outlines.includes(outlines)) {
              entry.outlines = [...entry.outlines, outlines];
            }
          }

          if (entry.count <= 0) {
            delete next[text];
          } else {
            next[text] = entry;
          }
        }
      }
      return next;
    });
  }, []);

  const handlePaperTape = useCallback((ev: CustomEvent<JavPaperTapeEventDetail>) => {
    const strokeTranslation = ev.detail.translation || "";
    const outline = ev.detail.outline;
    const undoCount = ev.detail.undo || 0;

    const newLog = [...paperTapeLogRef.current];

    if (undoCount > 0 && strokeTranslation == "" && newLog.length > 0){
      // undo command
      updateNgrams(newLog, -1);
      newLog.pop();
    } else {
      const paperTapeEntry: PaperTapeEntry = {
        translation: strokeTranslation,
        outline: [outline],
      };

      // append prevous strokes
      if (undoCount > 0 && newLog.length > 0) {
        paperTapeEntry.outline.unshift(...newLog[newLog.length - 1].outline);
      }
      
      newLog.push(paperTapeEntry);
      updateNgrams(newLog, 1);
    }

    paperTapeLogRef.current = newLog;
    // Trigger a re-render for autosave/UI updates if necessary, 
    // though nGrams state change usually handles this.
    setSaveTrigger(prev => prev + 1);
  }, [updateNgrams]);

  const toggleHiddenOutline = useCallback((outline: string) => {
    setHiddenOutlines(prev => 
      prev.includes(outline) 
        ? prev.filter(o => o !== outline) 
        : [...prev, outline]
    );
  }, []);

  const handleAddHiddenOutline = useCallback(() => {
    const value = hiddenOutlineInputRef.current?.value.trim();
    if (value) {
      toggleHiddenOutline(value);
      if (hiddenOutlineInputRef.current) {
        hiddenOutlineInputRef.current.value = "";
      }
    }
  }, [toggleHiddenOutline]);

  const topNGrams = useMemo(() => {
    return Object.entries(nGrams)
      .filter(([, entry]) => {
        if (entry.count < minCount) return false;
        return !entry.outlines.some(variant => 
          variant.split(" ").some(stroke => hiddenOutlines.includes(stroke))
        );
      })
      .sort(([, a], [, b]) => b.count - a.count);
  }, [nGrams, minCount, hiddenOutlines]);

  // Calculate visible items for virtual scrolling to increase performance when there are many frequent phrases
  const { startIndex, visibleNGrams } = useMemo(() => {    
    const itemsInView = Math.ceil(CONTAINER_HEIGHT / ITEM_HEIGHT);
    const firstVisibleIndex = Math.floor(scrollTop / ITEM_HEIGHT);

    const actualStartIndex = Math.max(0, firstVisibleIndex - VIRTUAL_SCROLL_BUFFER_ITEMS);
    const actualEndIndex = Math.min(
      topNGrams.length,
      firstVisibleIndex + itemsInView + VIRTUAL_SCROLL_BUFFER_ITEMS
    );
    return {
      startIndex: actualStartIndex,
      visibleNGrams: topNGrams.slice(actualStartIndex, actualEndIndex),
    };
  }, [topNGrams, scrollTop]);

  useEffect(() => {
    const device = new JavelinHidDevice();
    setHid(device);

    device.on("paper_tape", handlePaperTape);

    return () => {
      device.off("paper_tape", handlePaperTape);
    };
  }, [handlePaperTape]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Brief Suggestions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tracks frequently used phrases to help you identify new briefs to add to your dictionary.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">By default, it tracks phrases of 2 to 4 Strokes.</p>
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
                  <label htmlFor="minCount" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Occurrences</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Phrases must appear this many times to show up.</p>
                  <div className="relative">
                    <input
                      id="minCount"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={minCount}
                      onChange={(e) => setMinCount(Math.max(1, Number(e.target.value)))}
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="maxNgram" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Stroke Combinations</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Track phrases up to this many strokes long.</p>
                  <div className="relative">
                    <input
                      id="maxNgram"
                      type="number"
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={maxNgram}
                      onChange={(e) => setMaxNgram(Math.max(2, Number(e.target.value)))}
                      min="2"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 font-mono">
            Unique ngrams: <span className="font-bold text-gray-900 dark:text-white">{Object.keys(nGrams).length}</span>
          </div>
          <button
            onClick={() => {
              setNgrams({});
              paperTapeLogRef.current = [];
              setSaveTrigger(prev => prev + 1);
            }}
            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded transition-colors"
          >
            Clear Data
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center h-7">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Frequent Phrases</h2>
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
        <div className="w-full h-[500px] border border-gray-800 rounded-xl bg-black text-green-400 overflow-hidden shadow-inner flex flex-col">
          {topNGrams.length === 0 ? (
            <p className="text-gray-500 italic p-4">No phrases found meeting the threshold yet...</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 grid grid-cols-12 text-xs uppercase tracking-wider font-semibold text-gray-400 backdrop-blur-sm sticky top-0 z-10">
                <div className="col-span-10">Phrase</div>
                <div className="col-span-2 text-right">Count</div>
              </div>
              <div 
                className="overflow-y-auto flex-1 relative"
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              >
                {/* Phantom element to set total scrollable height */}
                <div style={{ height: `${topNGrams.length * ITEM_HEIGHT}px`, position: 'relative' }}>
                  {visibleNGrams.map(([gram, entry], idx) => {
                    const absoluteIdx = startIndex + idx;
                    return (
                      <div
                        key={gram}
                        style={{
                          position: 'absolute',
                          top: absoluteIdx * ITEM_HEIGHT,
                          height: ITEM_HEIGHT,
                          width: '100%',
                        }}
                        className={`grid grid-cols-12 items-center border-b border-gray-800/50 hover:bg-gray-900 transition-colors px-4 ${absoluteIdx % 2 === 0 ? 'bg-black' : 'bg-black/50'}`}
                      >
                        <div className="col-span-10 font-medium text-green-300">
                          <div className="truncate">{gram}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                            {entry.outlines.map((variant, vIdx) => (
                              <span key={vIdx}>
                                {vIdx > 0 && " | "}
                                {variant.split(" ").map((stroke, sIdx) => (
                                  <span key={sIdx}>
                                    {sIdx > 0 && " "}
                                    <button 
                                      onClick={() => toggleHiddenOutline(stroke)}
                                      className="hover:underline hover:text-red-400 transition-colors"
                                      title={`Hide phrases using "${stroke}"`}
                                    >
                                      {stroke}
                                    </button>
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-2 text-blue-400 font-bold text-right">
                          {entry.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Outlines Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center h-7">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hidden Outlines</h2>
        </div>
        <div className="w-full p-4 border border-gray-800 rounded-xl bg-black shadow-inner">
          <div className="flex flex-wrap gap-2 mb-4">
            {hiddenOutlines.length === 0 ? (
              <span className="text-gray-500 italic text-sm">No outlines hidden yet. Click an outline in the table above to hide it.</span>
            ) : (
              hiddenOutlines.map(outline => (
                <span key={outline} className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-green-400 rounded-lg text-xs font-mono border border-gray-700">
                  {outline}
                  <button onClick={() => toggleHiddenOutline(outline)} className="hover:text-red-400 ml-1 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input 
              ref={hiddenOutlineInputRef}
              type="text"
              placeholder="Add outline..."
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddHiddenOutline();
                }
              }}
            />
            <button 
              onClick={handleAddHiddenOutline}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
