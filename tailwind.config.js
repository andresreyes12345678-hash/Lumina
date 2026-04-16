/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./stage.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'lumina-dark': '#0f172a',
                'lumina-gray': '#1e293b',
            },
            fontFamily: {
                sans: ['Poppins', 'Open Sans', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
