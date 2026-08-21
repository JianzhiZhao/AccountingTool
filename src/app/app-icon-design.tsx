export function AppIconDesign() {
  return <div style={{
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    background: "linear-gradient(145deg, #fffef7 0%, #f7f8e6 72%)",
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
      background: "linear-gradient(150deg, #fff449 0%, #fed24f 100%)",
      boxShadow: "0 12px 28px rgba(0,0,0,.34)",
    }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: "17%", borderRadius: "100px 0 0 100px", background: "#555119" }} />
      <div style={{ width: "100%", height: "8%", borderRadius: "100px", background: "#555119" }} />
      <div style={{ width: "76%", height: "8%", borderRadius: "100px", background: "#555119" }} />
      <div style={{ width: "88%", height: "8%", borderRadius: "100px", background: "#555119" }} />
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
      background: "linear-gradient(145deg, #b2d959 0%, #7ec151 100%)",
      border: "6px solid #fffef7",
      boxShadow: "0 8px 20px rgba(0,0,0,.36)",
    }}>
      <div style={{ width: "54%", height: "54%", borderRadius: "50%", border: "4px solid rgba(51,91,40,.62)" }} />
    </div>
  </div>;
}
