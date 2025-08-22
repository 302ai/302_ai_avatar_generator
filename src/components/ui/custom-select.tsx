import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  renderExtra?: (isPlaying: boolean) => React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: CustomSelectOption[];
  disabled?: boolean;
  className?: string;
  playingVoiceId?: string | null;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select an option",
  options,
  disabled = false,
  className,
  playingVoiceId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  // Get the selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => {
            let next = prev;
            do {
              next = next < options.length - 1 ? next + 1 : next;
            } while (next < options.length - 1 && options[next]?.disabled);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => {
            let next = prev;
            do {
              next = next > 0 ? next - 1 : next;
            } while (next > 0 && options[next]?.disabled);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            const option = options[highlightedIndex];
            if (!option.disabled) {
              handleOptionClick(option.value);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, highlightedIndex, options]);

  const handleOptionClick = (optionValue: string) => {
    const option = options.find((opt) => opt.value === optionValue);
    if (option?.disabled) return; // 阻止选择被禁用的选项

    onValueChange(optionValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setHighlightedIndex(-1);
      }
    }
  };

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
          "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className={cn("truncate", !selectedOption && "text-muted-foreground")}
        >
          {selectedOption
            ? selectedOption.label === "Custom"
              ? t("voice.voiceClone.custom")
              : selectedOption.label
            : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Options dropdown */}
      {isOpen && (
        <div
          ref={optionsRef}
          className={cn(
            "absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none",
                !option.disabled &&
                  "hover:bg-accent hover:text-accent-foreground",
                !option.disabled &&
                  "focus:bg-accent focus:text-accent-foreground",
                !option.disabled &&
                  highlightedIndex === index &&
                  "bg-accent text-accent-foreground",
                option.value === value && "font-medium",
                option.disabled && "cursor-not-allowed opacity-50"
              )}
              onClick={() =>
                !option.disabled && handleOptionClick(option.value)
              }
              onMouseEnter={() =>
                !option.disabled && setHighlightedIndex(index)
              }
            >
              <span
                className="flex-1 truncate"
                title={
                  option.label === "Custom"
                    ? t("voice.voiceClone.custom")
                    : option.label
                }
              >
                {option.label === "Custom"
                  ? t("voice.voiceClone.custom")
                  : option.label}
              </span>
              {option.renderExtra && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="ml-2"
                >
                  {option.renderExtra(
                    playingVoiceId === option.value ||
                      playingVoiceId === `custom:${option.value}`
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
