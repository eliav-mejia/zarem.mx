// Tailwind (CDN) theme shared by every page. Load right after https://cdn.tailwindcss.com.
// Minimal fashion palette: white, near-black ink and greys. The school's navy and orange appear only as small accents.
// Mirrors :root in /css/site.css.
tailwind.config = {
    theme: {
        extend: {
            colors: {
                ink: { DEFAULT: '#111111', 700: '#3d3d3d', 500: '#6b6b6b', 400: '#8c8c8c', 300: '#b5b5b5' },
                line: '#e6e6e6',
                paper: { DEFAULT: '#ffffff', 50: '#f7f7f5', 100: '#efefec' },
                florida: { marino: '#1b2a4a', naranja: '#e8742a', cafe: '#4a3426' },
            },
            fontFamily: {
                logo: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
                sans: ['Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
            },
            letterSpacing: { label: '0.08em', wide2: '0.18em' },
        },
    },
};
