// src/components/TagInput.jsx
import { useState } from 'react';

const SUGGESTED_TAGS = [
  'Fiction', 'Non-Fiction', 'Fantasy', 'Sci-Fi',
  'Self-Help', 'Business', 'History', 'Poetry',
  'Romance', 'Thriller', 'Biography', 'Philosophy',
];

export function TagInput({ tags = [], onChange }) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag) => {
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    onChange([...tags, cleaned]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = SUGGESTED_TAGS.filter(s =>
    s.toLowerCase().includes(inputValue.toLowerCase()) &&
    !tags.includes(s.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 px-3 py-1 bg-moss/15 text-moss text-xs font-sans rounded-none"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-moss/60 hover:text-moss transition ml-1"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Add a tag (press Enter)"
          className="
            w-full px-4 py-3
            bg-background border border-foreground-tertiary/30
            rounded-none text-sm font-sans text-foreground
            placeholder-foreground-tertiary/50
            focus:outline-none focus:border-indigo
            transition duration-200
          "
        />

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-background-secondary border border-foreground-tertiary/20 z-20 max-h-40 overflow-y-auto">
            {filteredSuggestions.map(suggestion => (
              <button
                key={suggestion}
                onMouseDown={() => addTag(suggestion)}
                className="w-full text-left px-4 py-2 text-sm font-sans text-foreground hover:bg-background transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-foreground-tertiary">
        Press Enter or comma to add. Backspace removes the last tag.
      </p>
    </div>
  );
}

