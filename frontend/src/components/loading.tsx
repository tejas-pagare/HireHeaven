import React from "react";

const Loading = ({ className = "" }: { className?: string }) => {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 py-24 ${className}`}
      role="status"
      aria-label="Loading"
    >
      <svg
        className="size-14"
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="4"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="90 150"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      <span className="sr-only">Loading…</span>
    </div>
  );
};

export default Loading;
