import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs:    ['14px', { lineHeight: '1.2' }],
        sm:    ['17px', { lineHeight: '1.3' }],
        base:  ['19px', { lineHeight: '1.5' }],
        lg:    ['22px', { lineHeight: '1.3' }],
        xl:    ['24px', { lineHeight: '1.2' }],
        '2xl': ['29px', { lineHeight: '1.1' }],
        '3xl': ['36px', { lineHeight: '1.1' }],
        '4xl': ['43px', { lineHeight: '1'   }],
      },
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-dark": "var(--panel-dark)",
        cyan: "rgb(var(--cyan-rgb) / <alpha-value>)",
        gold: "rgb(var(--gold-rgb) / <alpha-value>)",
        "text-primary": "var(--text-primary)",
        "text-muted": "var(--text-muted)",
        "neon-green": "var(--neon-green)",
        "neon-red": "var(--neon-red)",
        "warn-orange": "var(--warn-orange)",
        "bar-empty": "var(--bar-empty)",
      },
      fontFamily: {
        mono: ["'Space Mono'", "'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        cyan: "0 0 10px rgb(var(--cyan-rgb) / 0.2)",
        "cyan-lg": "0 0 20px rgb(var(--cyan-rgb) / 0.35)",
        "cyan-inset": "inset 0 0 30px rgb(var(--cyan-rgb) / 0.05)",
        gold: "0 0 10px rgb(var(--gold-rgb) / 0.3)",
      },
      animation: {
        "scan-line": "scan 8s linear infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        blink: "blink 1s infinite",
        "fade-in": "fadeIn 0.3s ease",
      },
      keyframes: {
        scan: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 5px rgb(var(--cyan-rgb) / 0.1)" },
          "50%": { boxShadow: "0 0 20px rgb(var(--cyan-rgb) / 0.4)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
