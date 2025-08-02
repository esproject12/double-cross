// Krossword-main/App.tsx (Final version with CSS Grid layout and full logging)

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { fetchPreGeneratedCrossword } from "./services/geminiService";
import type {
  CrosswordData,
  UserGrid,
  CellPosition,
  Orientation,
  WordDefinition,
  CellCheckGrid,
  CellCheckState,
} from "./types";
import CrosswordGrid from "./components/CrosswordGrid";
import ClueList from "./components/ClueList";
import Toolbar from "./components/Toolbar";
import Timer from "./components/Timer";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useWindowSize } from "./hooks/useWindowSize";
import ClueBar from "./components/ClueBar";
import OnScreenKeyboard from "./components/OnScreenKeyboard";

const getTodayDateString = (): string => {
  const now = new Date();
  const istDateString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  const istDate = new Date(istDateString);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface CachedCrossword {
  date: string;
  data: CrosswordData;
}

const SAMPLE_PUZZLE_DATE_STRING = "2024-07-28";

const CrosswordGame: React.FC<{
  initialData: CrosswordData;
  error?: string | null;
}> = ({ initialData, error }) => {
  console.log("[CrosswordGame] Component rendering or re-rendering...");

  const isMobile = useMediaQuery("(max-width: 768px)");
  useWindowSize();
  console.log(`[CrosswordGame] isMobile: ${isMobile}`);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const mobileMainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("--- Running Layout Diagnosis ---");
      if (mainContainerRef.current) {
        const parentHeight = window.getComputedStyle(
          mainContainerRef.current
        ).height;
        console.log(`[DIAGNOSIS] Parent container height: ${parentHeight}`);
      } else {
        console.error("[DIAGNOSIS] Parent container ref is NULL.");
      }
      if (isMobile && mobileMainRef.current) {
        const childHeight = window.getComputedStyle(
          mobileMainRef.current
        ).height;
        console.log(`[DIAGNOSIS] Mobile <main> child height: ${childHeight}`);
      } else if (isMobile) {
        console.error(
          "[DIAGNOSIS] isMobile is true, but mobile <main> ref is NULL."
        );
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isMobile]);

  console.log("[CrosswordGame] Initializing state...");
  const [crosswordData] = useState<CrosswordData>(initialData);
  const [userGrid, setUserGrid] = useState<UserGrid>(() =>
    initialData.solutionGrid.map((row) => row.map((cell) => (cell ? "" : null)))
  );
  const [cellCheckGrid, setCellCheckGrid] = useState<CellCheckGrid>(() =>
    initialData.solutionGrid.map((row) =>
      row.map((cell) => (cell ? ("unchecked" as CellCheckState) : null))
    )
  );
  const [activeCell, setActiveCell] = useState<CellPosition | null>(() => {
    const firstWord = initialData.words?.sort((a, b) => a.id - b.id)[0];
    if (firstWord) return firstWord.startPosition;
    for (let r = 0; r < initialData.gridSize; r++) {
      for (let c = 0; c < initialData.gridSize; c++) {
        if (initialData.solutionGrid[r][c]) return { row: r, col: c };
      }
    }
    return null;
  });
  const [activeDirection, setActiveDirection] = useState<Orientation>(() => {
    const firstWord = initialData.words?.sort((a, b) => a.id - b.id)[0];
    return firstWord?.orientation || "ACROSS";
  });
  const [isPuzzleSolved, setIsPuzzleSolved] = useState<boolean>(false);
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  console.log("[CrosswordGame] State initialized.");

  const findWordAtCell = useCallback(
    (
      cell: CellPosition,
      direction: Orientation
    ): WordDefinition | undefined => {
      if (!crosswordData || !cell) return undefined;
      return crosswordData.words.find((word) => {
        if (word.orientation !== direction) return false;
        if (direction === "ACROSS") {
          return (
            word.startPosition.row === cell.row &&
            cell.col >= word.startPosition.col &&
            cell.col < word.startPosition.col + word.length
          );
        } else {
          return (
            word.startPosition.col === cell.col &&
            cell.row >= word.startPosition.row &&
            cell.row < word.startPosition.row + word.length
          );
        }
      });
    },
    [crosswordData]
  );
  const activeWord = useMemo(() => {
    if (!activeCell) return null;
    return findWordAtCell(activeCell, activeDirection);
  }, [activeCell, activeDirection, findWordAtCell]);
  const startTimer = () => {
    if (!isTimerRunning && !isPuzzleSolved) setIsTimerRunning(true);
  };
  const checkPuzzleSolved = useCallback(() => {
    if (!userGrid) return false;
    for (let r = 0; r < crosswordData.gridSize; r++) {
      for (let c = 0; c < crosswordData.gridSize; c++) {
        if (
          crosswordData.solutionGrid[r]?.[c] &&
          userGrid[r]?.[c]?.toUpperCase() !==
            crosswordData.solutionGrid[r]?.[c]?.toUpperCase()
        ) {
          return false;
        }
      }
    }
    return true;
  }, [userGrid, crosswordData]);
  useEffect(() => {
    if (checkPuzzleSolved()) {
      setIsPuzzleSolved(true);
      setIsTimerRunning(false);
    }
  }, [userGrid, checkPuzzleSolved]);
  useEffect(() => {
    if (isTimerRunning && !isPuzzleSolved) {
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isPuzzleSolved]);
  const getWordPath = useCallback((word: WordDefinition): CellPosition[] => {
    const path: CellPosition[] = [];
    for (let i = 0; i < word.length; i++) {
      if (word.orientation === "ACROSS") {
        path.push({
          row: word.startPosition.row,
          col: word.startPosition.col + i,
        });
      } else {
        path.push({
          row: word.startPosition.row + i,
          col: word.startPosition.col,
        });
      }
    }
    return path;
  }, []);
  const findNextEditableCell = useCallback(
    (
      word: WordDefinition,
      fromCell: CellPosition | null,
      searchForward: boolean = true
    ): CellPosition | null => {
      if (!userGrid) return null;
      const wordPath = getWordPath(word);
      let startIndex = fromCell
        ? wordPath.findIndex(
            (p) => p.row === fromCell.row && p.col === fromCell.col
          )
        : -1;
      if (searchForward) {
        for (let i = startIndex + 1; i < wordPath.length; i++) {
          const pos = wordPath[i];
          if (userGrid[pos.row][pos.col] === "") return pos;
        }
      } else {
        for (let i = startIndex - 1; i >= 0; i--) {
          const pos = wordPath[i];
          if (userGrid[pos.row][pos.col] === "") return pos;
        }
      }
      return null;
    },
    [userGrid, getWordPath]
  );
  const moveToNextCell = () => {
    if (!activeCell || !activeWord) return;
    const wordPath = getWordPath(activeWord);
    const currentIndex = wordPath.findIndex(
      (p) => p.row === activeCell.row && p.col === activeCell.col
    );
    if (currentIndex !== -1 && currentIndex < wordPath.length - 1) {
      setActiveCell(wordPath[currentIndex + 1]);
    }
  };
  const moveToPrevCell = () => {
    if (!activeCell || !activeWord) return;
    const wordPath = getWordPath(activeWord);
    const currentIndex = wordPath.findIndex(
      (p) => p.row === activeCell.row && p.col === activeCell.col
    );
    if (currentIndex > 0) {
      setActiveCell(wordPath[currentIndex - 1]);
    }
  };
  const handleCellChange = (row: number, col: number, value: string) => {
    if (!userGrid || isPuzzleSolved) return;
    startTimer();
    const upperValue = value.substring(0, 1).toUpperCase();
    if (userGrid[row][col] === upperValue && upperValue !== "") {
      moveToNextCell();
      return;
    }
    const newUserGrid = userGrid.map((r, rIdx) =>
      rIdx === row ? r.map((c, cIdx) => (cIdx === col ? upperValue : c)) : r
    );
    setUserGrid(newUserGrid);
    if (cellCheckGrid) {
      const newCheckGrid = cellCheckGrid.map((r, rIdx) =>
        rIdx === row
          ? r.map((c, cIdx) =>
              cIdx === col ? ("unchecked" as CellCheckState) : c
            )
          : r
      );
      setCellCheckGrid(newCheckGrid);
    }
    if (upperValue !== "" && activeWord) {
      const nextEmptyCell = findNextEditableCell(activeWord, { row, col });
      if (nextEmptyCell) {
        setActiveCell(nextEmptyCell);
      } else {
        moveToNextCell();
      }
    }
  };
  const handleCellClick = (row: number, col: number) => {
    if (crosswordData.solutionGrid[row][col] === null) return;
    const isSameCell = activeCell?.row === row && activeCell?.col === col;
    let newDirection = activeDirection;
    if (isSameCell) {
      newDirection = activeDirection === "ACROSS" ? "DOWN" : "ACROSS";
      if (!findWordAtCell({ row, col }, newDirection)) {
        newDirection = activeDirection;
      }
    }
    setActiveCell({ row, col });
    setActiveDirection(newDirection);
  };
  const handleClueSelect = (word: WordDefinition) => {
    const firstEmpty = findNextEditableCell(word, { row: -1, col: -1 }, true);
    setActiveDirection(word.orientation);
    setActiveCell(firstEmpty || word.startPosition);
  };
  const getCluesByDirection = (direction: Orientation) => {
    return crosswordData.words
      .filter((w) => w.orientation === direction)
      .sort((a, b) => a.id - b.id);
  };
  const handleClueNavigation = (forward: boolean) => {
    if (!activeWord) return;
    const currentClues = getCluesByDirection(activeDirection);
    const currentIndex = currentClues.findIndex((w) => w.id === activeWord.id);
    if (currentIndex !== -1) {
      const nextIndex =
        (currentIndex + (forward ? 1 : -1) + currentClues.length) %
        currentClues.length;
      handleClueSelect(currentClues[nextIndex]);
    }
  };
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (isPuzzleSolved) return;
    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
      startTimer();
      return;
    }
    event.preventDefault();
    switch (event.key) {
      case "ArrowUp":
        setActiveDirection("DOWN");
        moveToPrevCell();
        break;
      case "ArrowDown":
        setActiveDirection("DOWN");
        moveToNextCell();
        break;
      case "ArrowLeft":
        setActiveDirection("ACROSS");
        moveToPrevCell();
        break;
      case "ArrowRight":
        setActiveDirection("ACROSS");
        moveToNextCell();
        break;
      case "Backspace":
        startTimer();
        if (userGrid?.[row]?.[col]) {
          handleCellChange(row, col, "");
        } else {
          moveToPrevCell();
        }
        break;
      case "Enter":
      case " ":
        handleCellClick(row, col);
        break;
      default:
        break;
    }
  };
  const handleOnScreenKeyPress = (key: string) => {
    if (!activeCell || isPuzzleSolved) return;
    startTimer();
    if (key === "BACKSPACE") {
      if (userGrid?.[activeCell.row]?.[activeCell.col]) {
        handleCellChange(activeCell.row, activeCell.col, "");
      } else {
        moveToPrevCell();
      }
    } else {
      handleCellChange(activeCell.row, activeCell.col, key);
    }
  };
  const handleCheckPuzzle = () => {
    if (!userGrid) return;
    const newCheckGrid = userGrid.map((row, rIdx) =>
      row.map((cell, cIdx) => {
        if (crosswordData.solutionGrid[rIdx][cIdx] === null) return null;
        if (!cell) return "unchecked";
        return cell.toUpperCase() === crosswordData.solutionGrid[rIdx][cIdx]
          ? "correct"
          : "incorrect";
      })
    );
    setCellCheckGrid(newCheckGrid);
  };
  const handleRevealWord = () => {
    if (!activeWord || !userGrid || !cellCheckGrid) return;
    startTimer();
    let newUserGrid = [...userGrid];
    let newCheckGrid = [...cellCheckGrid];
    for (let i = 0; i < activeWord.length; i++) {
      let r = activeWord.startPosition.row;
      let c = activeWord.startPosition.col;
      if (activeWord.orientation === "ACROSS") c += i;
      else r += i;
      if (r < crosswordData.gridSize && c < crosswordData.gridSize) {
        newUserGrid[r] = [...newUserGrid[r]];
        newUserGrid[r][c] = crosswordData.solutionGrid[r][c];
        newCheckGrid[r] = [...newCheckGrid[r]];
        newCheckGrid[r][c] = "correct";
      }
    }
    setUserGrid(newUserGrid);
    setCellCheckGrid(newCheckGrid);
  };
  const handleRevealPuzzle = () => {
    startTimer();
    setUserGrid(crosswordData.solutionGrid.map((r) => [...r]));
    setCellCheckGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? "correct" : null))
      )
    );
    setIsPuzzleSolved(true);
  };
  const handleClearPuzzle = () => {
    setUserGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? "" : null))
      )
    );
    setCellCheckGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? ("unchecked" as CellCheckState) : null))
      )
    );
    setIsPuzzleSolved(false);
    setTime(0);
    setIsTimerRunning(false);
  };

  if (!activeCell) {
    console.error("[CrosswordGame] Rendering null because activeCell is null.");
    return (
      <div className="flex justify-center items-center h-screen">
        Initializing... (or activeCell is null)
      </div>
    );
  }

  console.log("[CrosswordGame] About to render main layout...");
  return (
    <div
      ref={mainContainerRef}
      style={{ height: "var(--app-height, 100vh)" }}
      className="w-screen bg-gray-50 flex flex-col"
    >
      <header className="text-center py-2 px-2 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700 tracking-tight">
          Dodo Krossword
        </h1>
        <p className="text-base text-gray-600 mt-1 hidden sm:block">
          {crosswordData.title}
        </p>
        {error && (
          <p className="text-sm text-red-500 mt-1 bg-red-100 p-1 rounded-md shadow">
            Note: {error}
          </p>
        )}
      </header>

      {isMobile ? (
        // --- FINAL, ROBUST MOBILE LAYOUT using CSS Grid ---
        <div className="flex-grow grid grid-rows-[auto,1fr,auto] gap-2 px-2 pb-2 min-h-0">
          {/* Row 1: Timer */}
          <div className="w-full flex justify-center flex-shrink-0">
            <Timer time={time} />
          </div>

          {/* Row 2: Grid (This will take up all available space and center its content) */}
          <div className="w-full flex items-center justify-center min-h-0">
            <CrosswordGrid
              crosswordData={crosswordData}
              userGrid={userGrid}
              activeCell={activeCell}
              activeDirection={activeDirection}
              cellCheckGrid={cellCheckGrid}
              onCellChange={handleCellChange}
              onCellClick={handleCellClick}
              onCellKeyDown={handleKeyDown}
              isMobile={isMobile}
            />
          </div>

          {/* Row 3: Clue Bar and Keyboard */}
          <div className="w-full flex flex-col gap-2 flex-shrink-0">
            <ClueBar
              activeWord={activeWord}
              activeDirection={activeDirection}
              onPrevClue={() => handleClueNavigation(false)}
              onNextClue={() => handleClueNavigation(true)}
            />
            <OnScreenKeyboard
              onKeyPress={handleOnScreenKeyPress}
              onCheckPuzzle={handleCheckPuzzle}
              onRevealWord={handleRevealWord}
              onRevealPuzzle={handleRevealPuzzle}
              onClearPuzzle={handleClearPuzzle}
              isPuzzleSolved={isPuzzleSolved}
            />
          </div>
        </div>
      ) : (
        // --- DESKTOP LAYOUT ---
        <main className="flex flex-col lg:flex-row gap-4 md:gap-6 items-start justify-center flex-grow p-4 overflow-y-auto">
          <div className="w-full lg:w-auto flex flex-col items-center">
            <div className="w-full max-w-md flex justify-between items-center mb-3 gap-2">
              <div
                className="p-2 border border-gray-300 rounded-md bg-white shadow-sm text-sm text-gray-700 min-h-[4em] flex items-center justify-center text-center flex-grow"
                role="status"
                aria-live="polite"
              >
                <span className="font-semibold mr-2">
                  {activeWord ? `${activeWord.id} ${activeDirection}: ` : ""}
                </span>
                {activeWord?.clue || "Select a cell to begin."}
              </div>
              <Timer time={time} />
            </div>
            <CrosswordGrid
              crosswordData={crosswordData}
              userGrid={userGrid}
              activeCell={activeCell}
              activeDirection={activeDirection}
              cellCheckGrid={cellCheckGrid}
              onCellChange={handleCellChange}
              onCellClick={handleCellClick}
              onCellKeyDown={handleKeyDown}
              isMobile={isMobile}
            />
            <Toolbar
              onCheckPuzzle={handleCheckPuzzle}
              onRevealWord={handleRevealWord}
              onRevealPuzzle={handleRevealPuzzle}
              onClearPuzzle={handleClearPuzzle}
              isPuzzleSolved={isPuzzleSolved}
            />
          </div>
          <div className="w-full lg:flex-1 bg-white p-3 rounded-lg shadow-md overflow-y-auto">
            {isPuzzleSolved && (
              <div
                className="p-3 mb-3 bg-green-100 text-green-700 rounded-md text-center font-semibold text-lg flex items-center justify-center"
                role="alert"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Congratulations! You solved the puzzle in{" "}
                {Math.floor(time / 60)}m {time % 60}s!
              </div>
            )}
            <ClueList
              words={crosswordData.words}
              onClueSelect={handleClueSelect}
              activeWordId={activeWord?.id}
              activeDirection={activeDirection}
            />
          </div>
        </main>
      )}
    </div>
  );
};

const App: React.FC = () => {
  console.log("[App] Component rendering or re-rendering...");

  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log("[App] useEffect for data loading is running.");
    const load = async () => {
      setIsLoading(true);
      const today = getTodayDateString();
      const cachedPuzzleKey = `crossword_${today}`;
      try {
        const cachedItem = localStorage.getItem(cachedPuzzleKey);
        if (cachedItem) {
          const parsedCache: CachedCrossword = JSON.parse(cachedItem);
          if (parsedCache.date === today && parsedCache.data) {
            console.log("Loading puzzle from localStorage cache for", today);
            setCrosswordData(parsedCache.data);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse cache, clearing it.", e);
        localStorage.clear();
      }
      try {
        const data = await fetchPreGeneratedCrossword(today);
        setCrosswordData(data);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("crossword_")) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem(
          cachedPuzzleKey,
          JSON.stringify({ date: today, data })
        );
      } catch (err) {
        try {
          console.warn(
            `Could not load puzzle for ${today}, falling back to sample.`
          );
          const sampleData = await fetchPreGeneratedCrossword(
            SAMPLE_PUZZLE_DATE_STRING
          );
          setCrosswordData(sampleData);
          setError(
            `Today's puzzle (${today}) was not found. Displaying a sample puzzle.`
          );
        } catch (sampleErr) {
          setError("Failed to load any puzzles. Please try again later.");
          console.error(
            "Critical: Failed to load even the sample puzzle.",
            sampleErr
          );
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (crosswordData) {
        const today = getTodayDateString();
        const titleDate = crosswordData.title.split(" - ")[1];
        if (titleDate && titleDate !== today) {
          console.log(
            `New day detected! Puzzle date is ${titleDate}, today is ${today}. Reloading page.`
          );
          window.location.reload();
        }
      }
    }, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, [crosswordData]);

  console.log(
    `[App] Current state: isLoading=${isLoading}, error=${error}, crosswordData exists=${!!crosswordData}`
  );

  if (isLoading) {
    console.log("[App] Rendering Loading state...");
    return (
      <div className="flex justify-center items-center h-screen text-xl text-gray-700">
        Loading Daily Dodo Krossword...
      </div>
    );
  }
  if (error && !crosswordData) {
    console.log(`[App] Rendering Error state: ${error}`);
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-600 p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Error Loading Puzzle</h2>
        <p className="text-sm text-gray-700">{error}</p>
      </div>
    );
  }
  if (crosswordData) {
    console.log("[App] Rendering CrosswordGame component...");
    return <CrosswordGame initialData={crosswordData} error={error} />;
  }

  console.error(
    "[App] Rendering final fallback error. This should not happen."
  );
  return (
    <div className="flex justify-center items-center h-screen text-xl text-red-700">
      Something went wrong preparing the puzzle.
    </div>
  );
};

export default App;
