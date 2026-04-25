/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#10b981",
          500: "#0f766e",
          600: "#115e59",
          700: "#134e4a",
          800: "#0c3a37",
          900: "#042f2e",
        },
        mint: {
          50:  "#f0fdf6",
          100: "#dcfce9",
          200: "#bbf7d2",
          300: "#86efac",
          500: "#22c55e",
        },
        sky2: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
        },
        coral: {
          50:  "#fff5f4",
          100: "#ffe4e1",
          400: "#ff7a6b",
          500: "#f25c4a",
          600: "#d94232",
        },
        sun: {
          50:  "#fffaeb",
          100: "#fff1c2",
          400: "#facc15",
          500: "#eab308",
        },
        ink: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          400: "#94a3b8",
          600: "#475569",
          800: "#1e293b",
          900: "#0f172a",
        },
        butter: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        blush: {
          50:  "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
        },
        lavender: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
        },
        cream: {
          50:  "#fdfcf6",
          100: "#fbf7e8",
          200: "#f6efd0",
          300: "#eee1a6",
        },
        charcoal: {
          700: "#262626",
          800: "#1a1a1a",
          900: "#0d0d0d",
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(19, 78, 74, 0.22)",
        card: "0 4px 20px -8px rgba(15, 23, 42, 0.10)",
        glow: "0 0 0 4px rgba(15, 118, 110, 0.15)",
      },
      backgroundImage: {
        'mesh': "radial-gradient(at 10% 6%, rgba(252,231,243,0.65) 0px, transparent 50%), radial-gradient(at 92% 12%, rgba(254,243,199,0.6) 0px, transparent 50%), radial-gradient(at 50% 92%, rgba(233,213,255,0.55) 0px, transparent 50%)",
        'brand-gradient': "linear-gradient(135deg, #134e4a 0%, #0f766e 55%, #10b981 100%)",
        'sunny': "linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)",
        'candy': "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)",
        'lilac': "linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)",
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scanline: {
          '0%, 100%': { top: '8%' },
          '50%':      { top: '88%' },
        },
      },
      animation: {
        floaty: 'floaty 4s ease-in-out infinite',
        pulseSoft: 'pulseSoft 2.5s ease-in-out infinite',
        slideUp: 'slideUp 0.4s ease-out',
        scanline: 'scanline 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
