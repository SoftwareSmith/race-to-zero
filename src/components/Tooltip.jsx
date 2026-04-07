function Tooltip({ content, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-72 -translate-x-1/2 -translate-y-1 rounded-2xl border border-stone-800 bg-stone-950/98 px-4 py-3 text-left text-sm leading-6 text-stone-100 opacity-0 shadow-[0_20px_45px_rgba(28,25,23,0.3)] transition duration-150 group-hover:-translate-x-1/2 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:-translate-x-1/2 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        role="tooltip"
      >
        {content}
      </span>
    </span>
  )
}

export default Tooltip