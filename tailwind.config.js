/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      colors: {
        // CS2 inspired color palette
        cs2: {
          primary: "#FF6B35",
          secondary: "#004E7C",
          accent: "#FFA500",
          background: "#1E1E1E",
          surface: "#2D2D2D",
          text: "#FFFFFF",
          textSecondary: "#B0B0B0",
        },
        // Weapon rarity colors
        rarity: {
          consumer: "#B0C3D9",
          industrial: "#5E98D9",
          milSpec: "#4B69FF",
          restricted: "#8847FF",
          classified: "#D32CE6",
          covert: "#EB4B4B",
          contraband: "#E4AE39",
        },
      },
      animation: {
        "flip-card": "flipCard 0.6s ease-in-out",
        "card-match": "cardMatch 0.4s ease-in-out",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        flipCard: {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        cardMatch: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      fontFamily: {
        game: ["Orbitron", "monospace"],
      },
      spacing: {
        72: "18rem",
        84: "21rem",
        96: "24rem",
      },
    },
  },
  plugins: [],
};
