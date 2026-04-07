function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Dashboard sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-selected={activeTab === tab.id}
          className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default Tabs