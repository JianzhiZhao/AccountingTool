export function AppIconDesign() {
  return <div style={{
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(145deg, #2b1810 0%, #120b08 72%)",
  }}>
    <div style={{
      position: "absolute",
      width: "68%",
      height: "74%",
      left: "16%",
      top: "13%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: "8%",
      paddingLeft: "25%",
      paddingRight: "14%",
      borderRadius: "17%",
      background: "linear-gradient(150deg, #f2b36f 0%, #c76d37 100%)",
      boxShadow: "0 12px 28px rgba(0,0,0,.34)",
    }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: "17%", borderRadius: "100px 0 0 100px", background: "#4a2617" }} />
      <div style={{ width: "100%", height: "8%", borderRadius: "100px", background: "#4a2617" }} />
      <div style={{ width: "76%", height: "8%", borderRadius: "100px", background: "#4a2617" }} />
      <div style={{ width: "88%", height: "8%", borderRadius: "100px", background: "#4a2617" }} />
    </div>
    <div style={{
      position: "absolute",
      right: "10%",
      bottom: "9%",
      width: "35%",
      height: "35%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
      background: "linear-gradient(145deg, #ffad8f 0%, #ff7657 100%)",
      border: "6px solid #1c120e",
      boxShadow: "0 8px 20px rgba(0,0,0,.36)",
    }}>
      <div style={{ width: "54%", height: "54%", borderRadius: "50%", border: "4px solid rgba(74,38,23,.62)" }} />
    </div>
  </div>;
}
