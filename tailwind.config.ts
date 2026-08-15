import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        letterboxd: {
          green: "#00e054",
          orange: "#ff8000",
          blue: "#40bcf4",
          dark: "#14181c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
