<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '$stores/auth';
  import { socketStore } from '$stores/socket';
  import type { User } from '$types/auth';
  import Button from '$components/ui/Button.svelte';
  
  export let user: User | null = null;
  export let isDarkMode = false;
  
  const dispatch = createEventDispatcher<{
    toggleSidebar: void;
    toggleTheme: void;
  }>();
  
  let showUserMenu = false;
  let showNotifications = false;
  
  $: isConnected = $socketStore.connected;
  
  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
    showNotifications = false;
  }
  
  function toggleNotifications() {
    showNotifications = !showNotifications;
    showUserMenu = false;
  }
  
  function handleLogout() {
    authStore.logout();
  }
  
  function handleToggleSidebar() {
    dispatch('toggleSidebar');
  }
  
  function handleToggleTheme() {
    dispatch('toggleTheme');
  }
  
  // Close menus when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.user-menu') && !target.closest('.notifications-menu')) {
      showUserMenu = false;
      showNotifications = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
  <div class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
    <!-- Left side -->
    <div class="flex items-center space-x-4">
      <!-- Mobile menu button -->
      <button
        type="button"
        class="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        on:click={handleToggleSidebar}
        aria-label="Open sidebar"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <!-- Search bar -->
      <div class="hidden md:block">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search rooms, tenants..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
    
    <!-- Right side -->
    <div class="flex items-center space-x-4">
      <!-- Connection status -->
      <div class="hidden sm:flex items-center space-x-2">
        <div class="w-2 h-2 rounded-full {isConnected ? 'bg-success-500' : 'bg-error-500'}"></div>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
      
      <!-- Theme toggle -->
      <button
        type="button"
        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        on:click={handleToggleTheme}
        aria-label="Toggle theme"
      >
        {#if isDarkMode}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>
      
      <!-- Notifications -->
      <div class="relative notifications-menu">
        <button
          type="button"
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors relative"
          on:click={toggleNotifications}
          aria-label="View notifications"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM10.07 2.82l-.9.9a2 2 0 000 2.83L12 9.38l2.83-2.83a2 2 0 000-2.83l-.9-.9a2 2 0 00-2.83 0z" />
          </svg>
          <!-- Notification badge -->
          <span class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-error-400 ring-2 ring-white dark:ring-gray-800"></span>
        </button>
        
        <!-- Notifications dropdown -->
        {#if showNotifications}
          <div class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div class="p-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Notifications</h3>
              
              <!-- Notification items -->
              <div class="space-y-3">
                <div class="flex items-start space-x-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div class="flex-shrink-0">
                    <div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900 dark:text-white">
                      Room 101 is now available
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      2 minutes ago
                    </p>
                  </div>
                </div>
                
                <div class="flex items-start space-x-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div class="flex-shrink-0">
                    <div class="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900 dark:text-white">
                      Low stock: Toilet paper
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      1 hour ago
                    </p>
                  </div>
                </div>
              </div>
              
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" size="sm" fullWidth>
                  View all notifications
                </Button>
              </div>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- User menu -->
      <div class="relative user-menu">
        <button
          type="button"
          class="flex items-center space-x-3 p-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          on:click={toggleUserMenu}
          aria-label="User menu"
        >
          <div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <span class="text-white text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div class="hidden md:block text-left">
            <p class="text-gray-900 dark:text-white font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <p class="text-gray-500 dark:text-gray-400 text-xs">
              {user?.roles?.[0]?.role?.replace('_', ' ') || 'User'}
            </p>
          </div>
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <!-- User dropdown -->
        {#if showUserMenu}
          <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div class="py-1">
              <a
                href="/profile"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                on:click={() => showUserMenu = false}
              >
                Your Profile
              </a>
              <a
                href="/settings"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                on:click={() => showUserMenu = false}
              >
                Settings
              </a>
              <div class="border-t border-gray-200 dark:border-gray-700"></div>
              <button
                type="button"
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                on:click={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>
