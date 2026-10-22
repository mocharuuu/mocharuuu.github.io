export default function SearchInput({ value, onChange, placeholder, className = "", style }) {
  return (
    <div className={`search-input ${className}`.trim()} style={style}>
      <input className="text" placeholder={placeholder} aria-label={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="search-clear" aria-label="Clear search"
          onClick={() => onChange("")}>
          ×
        </button>
      )}
    </div>
  );
}
