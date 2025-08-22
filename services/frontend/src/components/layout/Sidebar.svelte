<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$stores/auth';
  import type { User } from '$types/auth';
  
  export let open = false;
  export let user: User | null = null;
  
  const dispatch = createEventDispatcher<{
    close: void;
  }>();
  
  // Navigation items
  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z M3 7l9-4 9 4',
      roles: ['super_admin', 'house_owner', 'house_manager', 'house_viewer']
    },
    {
      name: 'Buildings',
      href: '/buildings',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      roles: ['super_admin', 'house_owner', 'house_manager', 'house_viewer']
    },
    {
      name: 'Rooms',
      href: '/rooms',
      icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11',
      roles: ['super_admin', 'house_owner', 'house_manager', 'house_viewer']
    },
    {
      name: 'Tenants',
      href: '/tenants',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
      roles: ['super_admin', 'house_owner', 'house_manager', 'house_viewer']
    },
    {
      name: 'Bookings',
      href: '/bookings',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      roles: ['super_admin', 'house_owner', 'house_manager', 'house_viewer']
    },
    {
      name: 'Expenses',
      href: '/expenses',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1',
      roles: ['super_admin', 'house_owner', 'house_manager']
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      roles: ['super_admin', 'house_owner', 'house_manager']
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      roles: ['super_admin', 'house_owner', 'house_manager']
    }
  ];
  
  // Admin items
  const adminItems = [
    {
      name: 'Users',
      href: '/admin/users',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
      roles: ['super_admin', 'house_owner']
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      roles: ['super_admin']
    }
  ];
  
  $: currentPath = $page.url.pathname;
  
  // Check if user has access to navigation item
  function hasAccess(item: any): boolean {
    if (!user?.roles) return false;
    
    return user.roles.some(role => 
      item.roles.includes(role.role) || role.role === 'super_admin'
    );
  }
  
  // Check if current path matches item
  function isActive(href: string): boolean {
    if (href === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    return currentPath.startsWith(href);
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

<!-- Sidebar -->
<div class="flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 {open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out fixed lg:static inset-y-0 left-0 z-50">
  <!-- Logo -->
  <div class="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
        <span class="text-white font-bold text-sm">BH</span>
      </div>
      <span class="text-lg font-semibold text-gray-900 dark:text-white">
        Boarding House
      </span>
    </div>
    
    <!-- Close button for mobile -->
    <button
      class="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
      on:click={handleClose}
      aria-label="Close sidebar"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
  
  <!-- Navigation -->
  <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
    <!-- Main Navigation -->
    <div class="space-y-1">
      {#each navigationItems as item}
        {#if hasAccess(item)}
          <a
            href={item.href}
            class="group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {
              isActive(item.href)
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
            }"
            on:click={handleClose}
          >
            <svg class="mr-3 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
            </svg>
            {item.name}
          </a>
        {/if}
      {/each}
    </div>
    
    <!-- Admin Section -->
    {#if user?.roles?.some(role => ['super_admin', 'house_owner'].includes(role.role))}
      <div class="pt-6">
        <div class="px-3 mb-2">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Administration
          </h3>
        </div>
        <div class="space-y-1">
          {#each adminItems as item}
            {#if hasAccess(item)}
              <a
                href={item.href}
                class="group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 {
                  isActive(item.href)
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                }"
                on:click={handleClose}
              >
                <svg class="mr-3 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                </svg>
                {item.name}
              </a>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </nav>
  
  <!-- User Info -->
  <div class="flex-shrink-0 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
        <span class="text-white text-sm font-medium">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {user?.firstName} {user?.lastName}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
          {user?.email}
        </p>
      </div>
    </div>
  </div>
</div>
