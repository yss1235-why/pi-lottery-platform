
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pi Network Brand Colors
        pi: {
          50: '#fef7ee',
          100: '#fdedd7',
          200: '#fad7ae',
          300: '#f7ba7a',
          400: '#f39344',
          500: '#f0741f',
          600: '#e15915',
          700: '#bb4314',
          800: '#953618',
          900: '#792f16',
          950: '#41160a',
        },
        // Custom Brand Colors for Lottery
        lottery: {
          primary: '#f59e0b', // Amber-500
          secondary: '#3b82f6', // Blue-500
          accent: '#8b5cf6', // Violet-500
          success: '#10b981', // Emerald-500
          warning: '#f59e0b', // Amber-500
          error: '#ef4444', // Red-500
          gold: '#fbbf24', // Amber-400
          silver: '#9ca3af', // Gray-400
          bronze: '#d97706', // Amber-600
        },
        // Dark theme colors
        dark: {
          bg: {
            primary: '#0f172a', // Slate-900
            secondary: '#1e293b', // Slate-800
            tertiary: '#334155', // Slate-700
          },
          text: {
            primary: '#f8fafc', // Slate-50
            secondary: '#cbd5e1', // Slate-300
            muted: '#64748b', // Slate-500
          },
          border: {
            primary: '#334155', // Slate-700
            secondary: '#475569', // Slate-600
          }
        }
      },
      fontFamily: {
        sans: [
          'Inter', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto', 
          'Oxygen', 
          'Ubuntu', 
          'Cantarell', 
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Consolas',
          'Monaco',
          'Courier New',
          'monospace'
        ],
        display: [
          'Poppins',
          'Inter',
          'sans-serif'
        ]
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-yellow': '0 0 20px rgba(245, 158, 11, 0.5)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.5)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.9)', opacity: '0' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'lottery-pattern': 'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Cpath d="M20 20c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20zm-30-20c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10-10-4.477-10-10z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'width': 'width',
        'colors-shadow': 'color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '900': '900ms',
        '1200': '1200ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'bounce-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      screens: {
        'xs': '475px',
        '3xl': '1680px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      aspectRatio: {
        'lottery-card': '4 / 3',
        'prize-card': '3 / 2',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for lottery-specific utilities
    function({ addUtilities, addComponents, theme }) {
      const newUtilities = {
        '.text-gradient': {
          'background': 'linear-gradient(45deg, #f59e0b, #d97706)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.text-gradient-blue': {
          'background': 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.text-gradient-purple': {
          'background': 'linear-gradient(45deg, #8b5cf6, #7c3aed)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          'background': 'rgba(0, 0, 0, 0.2)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': `${theme('colors.gray.400')} ${theme('colors.gray.200')}`,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: theme('colors.gray.200'),
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme('colors.gray.400'),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme('colors.gray.500'),
          },
        }
      }

      const newComponents = {
        '.btn': {
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.lg'),
          fontWeight: theme('fontWeight.medium'),
          fontSize: theme('fontSize.sm'),
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid transparent',
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          }
        },
        '.btn-primary': {
          background: 'linear-gradient(45deg, #f59e0b, #d97706)',
          color: theme('colors.white'),
          '&:hover': {
            background: 'linear-gradient(45deg, #d97706, #b45309)',
            transform: 'scale(1.05)',
          }
        },
        '.btn-secondary': {
          background: 'rgba(59, 130, 246, 0.1)',
          color: theme('colors.blue.400'),
          border: `1px solid ${theme('colors.blue.500')}`,
          '&:hover': {
            background: 'rgba(59, 130, 246, 0.2)',
          }
        },
        '.card': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: theme('borderRadius.2xl'),
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: theme('spacing.6'),
        },
        '.lottery-card': {
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
          backdropFilter: 'blur(20px)',
          borderRadius: theme('borderRadius.3xl'),
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: theme('spacing.6'),
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme('boxShadow.card-hover'),
          }
        },
        '.prize-badge': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: theme('spacing.8'),
          height: theme('spacing.8'),
          borderRadius: '50%',
          fontSize: theme('fontSize.sm'),
          fontWeight: theme('fontWeight.bold'),
          color: theme('colors.white'),
        },
        '.prize-badge-1st': {
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        },
        '.prize-badge-2nd': {
          background: 'linear-gradient(135deg, #d1d5db, #9ca3af)',
        },
        '.prize-badge-3rd': {
          background: 'linear-gradient(135deg, #d97706, #b45309)',
        },
        '.prize-badge-other': {
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        }
      }

      addUtilities(newUtilities)
      addComponents(newComponents)
    }
  ],
}
