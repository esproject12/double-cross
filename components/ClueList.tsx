import React from "react";
import type { WordDefinition, Orientation } from "../types";

interface ClueListProps {
  words: WordDefinition[];
  onClueSelect: (word: WordDefinition) => void;
  activeWordId?: number;
  activeDirection?: Orientation;
}

const ClueList: React.FC<ClueListProps> = ({
  words,
  onClueSelect,
  activeWordId,
  activeDirection,
}) => {
  const acrossClues = words
    .filter((w) => w.orientation === "ACROSS")
    .sort((a, b) => a.id - b.id);
  const downClues = words
    .filter((w) => w.orientation === "DOWN")
    .sort((a, b) => a.id - b.id);

  const ClueItem: React.FC<{ word: WordDefinition }> = ({ word }) => {
    const isActive =
      word.id === activeWordId && word.orientation === activeDirection;
    return (
      <li
        key={`${word.orientation}-${word.id}`}
        className={`cursor-pointer p-1.5 rounded hover:bg-gray-200 text-sm ${
          isActive ? "bg-blue-200 font-semibold" : "bg-gray-50"
        }`}
        // The onClick now correctly calls the prop with the full 'word' object
       // console.log("STEP 1: ClueItem in ClueList was clicked!", word);
        onClick={() => onClueSelect(word)}
      >
        <span className="font-bold mr-1.5">{word.id}.</span>
        {word.clue}
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-h-[300px] md:max-h-[calc(100vh-250px)] overflow-y-auto p-1">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-700 sticky top-0 bg-white py-1 z-10 border-b">
          Across
        </h3>
        <ul className="space-y-1.5 pr-2">
          {acrossClues.map((word) => (
            <ClueItem key={`across-${word.id}`} word={word} />
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-700 sticky top-0 bg-white py-1 z-10 border-b">
          Down
        </h3>
        <ul className="space-y-1.5 pr-2">
          {downClues.map((word) => (
            <ClueItem key={`down-${word.id}`} word={word} />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ClueList;
