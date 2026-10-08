// Tailwind (CDN) theme shared by every page. Load right after https://cdn.tailwindcss.com.
// Palette: blue tones only — midnight (text, dark sections) · sapphire (buttons) · steel (accents) · ice (soft sections).
// Mirrors :root in /css/site.css.
tailwind.config = {
    theme: {
        extend: {
            colors: {
                noche: { DEFAULT: '#0b1b34', 900: '#071226', 800: '#10264a', line: '#dbe3ee' },
                zafiro: { DEFAULT: '#1e3a6e', 600: '#264985', 500: '#2f5aa3' },
                acero: { DEFAULT: '#4a6fa5', 600: '#5a6b85', 400: '#7d8ea8', 300: '#8fb0dc' },
                hielo: { 50: '#f6f9fd', 100: '#ebf1f9', 200: '#d6e3f2', 300: '#bcd0ea' },
            },
            fontFamily: {
                display: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
                sans: ['Manrope', 'system-ui', 'sans-serif'],
            },
        },
    },
};
