import React from "react";

const Loading = () => {
  return (
    <div className="flex-col gap-4 w-full flex items-center justify-center mt-40">
      <svg className="w-20 h-20" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" fill="none">
        <circle cx="25" cy="25" r="20" stroke="url(#gradient)" strokeWidth="4" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
        </circle>
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--jl-primary)"/>
            <stop offset="100%" stopColor="var(--jl-primary-dark)"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default Loading;
