export default function Loading({ isLoading }) {
  if (!isLoading) return null;

  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  };

  const boxStyle = {
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  };

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <lord-icon
          src="https://cdn.lordicon.com/xjovhxra.json"
          trigger="loop"
          colors="primary:#08c18a"
          style={{ width: "120px", height: "120px" }}
        ></lord-icon>
      </div>
    </div>
  );
}
