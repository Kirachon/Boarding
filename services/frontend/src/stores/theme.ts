import { writable } from 'svelte/store';

export interface ThemeState {
  isDark: boolean;
  systemPreference: boolean;
}

const initialState: ThemeState = {
  isDark: false,
  systemPreference: true
};

function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeState>(initialState);

  return {
    subscribe,
    
    // Initialize theme from localStorage and system preference
    initialize: () => {
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        let isDark = false;
        let systemPreference = true;
        
        if (savedTheme === 'dark') {
          isDark = true;
          systemPreference = false;
        } else if (savedTheme === 'light') {
          isDark = false;
          systemPreference = false;
        } else {
          // Use system preference
          isDark = systemPrefersDark;
          systemPreference = true;
        }
        
        // Apply theme to document
        document.documentElement.classList.toggle('dark', isDark);
        
        set({ isDark, systemPreference });
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
          update(state => {
            if (state.systemPreference) {
              document.documentElement.classList.toggle('dark', e.matches);
              return { ...state, isDark: e.matches };
            }
            return state;
          });
        };
        
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        
        // Cleanup function would be called in component onDestroy
        return () => {
          mediaQuery.removeEventListener('change', handleSystemThemeChange);
        };
      }
    },
    
    // Toggle between light and dark theme
    toggle: () => {
      update(state => {
        const newIsDark = !state.isDark;
        
        if (typeof window !== 'undefined') {
          document.documentElement.classList.toggle('dark', newIsDark);
          localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
        }
        
        return {
          isDark: newIsDark,
          systemPreference: false
        };
      });
    },
    
    // Set specific theme
    setTheme: (theme: 'light' | 'dark' | 'system') => {
      update(state => {
        let isDark = false;
        let systemPreference = false;
        
        if (theme === 'system') {
          systemPreference = true;
          if (typeof window !== 'undefined') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            localStorage.removeItem('theme');
          }
        } else {
          isDark = theme === 'dark';
          if (typeof window !== 'undefined') {
            localStorage.setItem('theme', theme);
          }
        }
        
        if (typeof window !== 'undefined') {
          document.documentElement.classList.toggle('dark', isDark);
        }
        
        return { isDark, systemPreference };
      });
    },
    
    // Get current theme as string
    getCurrentTheme: (): 'light' | 'dark' | 'system' => {
      let currentState: ThemeState;
      subscribe(state => currentState = state)();
      
      if (currentState.systemPreference) {
        return 'system';
      }
      return currentState.isDark ? 'dark' : 'light';
    }
  };
}

export const themeStore = createThemeStore();
