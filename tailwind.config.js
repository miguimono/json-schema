/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    colors: {
      'currentColor': '#F6F6F6',
      'secondaryColor': '#019DF4',
      'white': '#FFFFFF',
      'black': '#000000',
      gray: {
        100: '#F6F6F6',
        200: '#D3D4D3',
        300: '#B6B7B7',
        400: '#86888C',
        500: '#50535A',
        600: '#313235',
      },
      blue: {
        300: '#019DF4',
        600: '#0b2739'
      },
      green: {
        300: '#5cb615',
      },
      purple: {
        100: '#DEBCE4',
        300: '#A13EA1',
        600: '#642A72'
      },
      magenta: {
        300: '#E63780'
      },
      orange: {
        300: '#EC6248'
      },
      yellow: {
        300: '#F28D15'
      }
    },
    fontFamily:{
      'brandnormal':['telefonicabrand'],
    },
    fontWeight:{
      'bold': 700,
      'extralight':200,
      'light':300,
      'regular':400,
    },
    extend: {},
    important:true,
  },
  plugins: [],
}
