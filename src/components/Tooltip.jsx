function Tooltip({ content, children }) {
  return (
    <span className="tooltip-shell">
      {children}
      <span className="tooltip-bubble" role="tooltip">
        {content}
      </span>
    </span>
  )
}

export default Tooltip