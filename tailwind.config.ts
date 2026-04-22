import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        desktop: "#008080",
        panel: "#c0c0c0",
        shadow: "#808080",
        highlight: "#ffffff",
        accent: "#000080",
      },
      fontFamily: {
        ui: ["Tahoma", "Geneva", "sans-serif"],
        body: ["Times New Roman", "serif"],
      },
      boxShadow: {
        window: "2px 2px 0 #000000",
      },
    },
  },
  plugins: [],
};

export default config;
