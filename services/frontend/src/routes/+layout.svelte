<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$stores/auth';
  import { themeStore } from '$stores/theme';
  import { socketStore } from '$stores/socket';
  import Navbar from '$components/layout/Navbar.svelte';
  import Sidebar from '$components/layout/Sidebar.svelte';
  import Toast from '$components/ui/Toast.svelte';
  import LoadingBar from '$components/ui/LoadingBar.svelte';
  
  let sidebarOpen = false;
  let isLoading = false;
  
  // Reactive statements
  $: isAuthenticated = $authStore.isAuthenticated;
  $: currentUser = $authStore.user;
  $: isDarkMode = $themeStore.isDark;
  $: isAuthPage = $page.route.id?.startsWith('/(auth)');
  
  // Handle page navigation loading
  $: {
    if ($page.url) {
      isLoading = false;
    }
  }
  
  onMount(() => {
    // Initialize theme
    themeStore.initialize();
    
    // Initialize auth from localStorage
    authStore.initialize();
    
    // Initialize socket connection if authenticated
    if (isAuthenticated) {
      socketStore.connect($authStore.token);
    }
    
    // Handle navigation loading
    const handleNavigationStart = () => {
      isLoading = true;
    };
    
    const handleNavigationEnd = () => {
      isLoading = false;
    };
    
    // Listen for navigation events
    window.addEventListener('beforeunload', handleNavigationStart);
    
    return () => {
      window.removeEventListener('beforeunload', handleNavigationStart);
      socketStore.disconnect();
    };
  });
  
  // Handle sidebar toggle
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }
  
  // Handle sidebar close
  function closeSidebar() {
    sidebarOpen = false;
  }
  
  // Handle theme toggle
  function toggleTheme() {
    themeStore.toggle();
  }
</script>

<svelte:head>
  <title>
    {#if $page.data?.title}
      {$page.data.title} - Boarding House Monitor
    {:else}
      Boarding House Monitor
    {/if}
  </title>
  
  {#if $page.data?.description}
    <meta name="description" content={$page.data.description} />
  {/if}
</svelte:head>

<!-- Loading Bar -->
{#if isLoading}
  <LoadingBar />
{/if}

<!-- Main App Container -->
<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
  {#if isAuthenticated && !isAuthPage}
    <!-- Authenticated Layout -->
    <div class="flex h-screen overflow-hidden">
      <!-- Sidebar -->
      <Sidebar 
        bind:open={sidebarOpen} 
        on:close={closeSidebar}
        user={currentUser}
      />
      
      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Top Navigation -->
        <Navbar 
          on:toggleSidebar={toggleSidebar}
          on:toggleTheme={toggleTheme}
          user={currentUser}
          {isDarkMode}
        />
        
        <!-- Page Content -->
        <main class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div class="container-custom section-padding">
            <slot />
          </div>
        </main>
      </div>
    </div>
    
    <!-- Mobile Sidebar Overlay -->
    {#if sidebarOpen}
      <div 
        class="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
        on:click={closeSidebar}
        on:keydown={(e) => e.key === 'Escape' && closeSidebar()}
        role="button"
        tabindex="0"
        aria-label="Close sidebar"
      ></div>
    {/if}
  {:else}
    <!-- Unauthenticated Layout (Auth pages) -->
    <div class="min-h-screen flex flex-col">
      <!-- Simple header for auth pages -->
      {#if isAuthPage}
        <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div class="container-custom py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span class="text-white font-bold text-sm">BH</span>
                </div>
                <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                  Boarding House Monitor
                </h1>
              </div>
              
              <button
                on:click={toggleTheme}
                class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
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
            </div>
          </div>
        </header>
      {/if}
      
      <!-- Auth page content -->
      <main class="flex-1">
        <slot />
      </main>
      
      <!-- Simple footer for auth pages -->
      {#if isAuthPage}
        <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div class="container-custom py-4">
            <div class="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>&copy; 2024 Boarding House Monitor. All rights reserved.</p>
            </div>
          </div>
        </footer>
      {/if}
    </div>
  {/if}
</div>

<!-- Global Toast Notifications -->
<Toast />

<style>
  /* Ensure smooth transitions */
  :global(html) {
    scroll-behavior: smooth;
  }
  
  /* Custom scrollbar for main content */
  main::-webkit-scrollbar {
    width: 6px;
  }
  
  main::-webkit-scrollbar-track {
    background: transparent;
  }
  
  main::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }
  
  main::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }
</style>
