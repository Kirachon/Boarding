<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  
  interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
  }
  
  const toasts = writable<ToastMessage[]>([]);
  
  let toastContainer: HTMLDivElement;
  
  onMount(() => {
    // Global toast function
    (window as any).showToast = (message: string, type: ToastMessage['type'] = 'info', title?: string, duration = 5000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: ToastMessage = { id, type, message, title, duration };
      
      toasts.update(current => [...current, toast]);
      
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    };
  });
  
  function removeToast(id: string) {
    toasts.update(current => current.filter(toast => toast.id !== id));
  }
  
  function getToastClasses(type: ToastMessage['type']) {
    const baseClasses = 'max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden';
    
    const typeClasses = {
      success: 'border-l-4 border-success-500',
      error: 'border-l-4 border-error-500',
      warning: 'border-l-4 border-warning-500',
      info: 'border-l-4 border-blue-500'
    };
    
    return `${baseClasses} ${typeClasses[type]}`;
  }
  
  function getIconClasses(type: ToastMessage['type']) {
    const iconClasses = {
      success: 'text-success-400',
      error: 'text-error-400',
      warning: 'text-warning-400',
      info: 'text-blue-400'
    };
    
    return iconClasses[type];
  }
  
  function getIcon(type: ToastMessage['type']) {
    const icons = {
      success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
      info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    };
    
    return icons[type];
  }
</script>

<!-- Toast Container -->
<div
  bind:this={toastContainer}
  class="fixed top-0 right-0 z-50 p-6 space-y-4 pointer-events-none"
  aria-live="assertive"
>
  {#each $toasts as toast (toast.id)}
    <div
      class={getToastClasses(toast.type)}
      style="animation: slideInRight 0.3s ease-out;"
    >
      <div class="p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-6 w-6 {getIconClasses(toast.type)}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getIcon(toast.type)} />
            </svg>
          </div>
          <div class="ml-3 w-0 flex-1 pt-0.5">
            {#if toast.title}
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {toast.title}
              </p>
            {/if}
            <p class="text-sm text-gray-500 dark:text-gray-400 {toast.title ? 'mt-1' : ''}">
              {toast.message}
            </p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button
              class="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              on:click={() => removeToast(toast.id)}
            >
              <span class="sr-only">Close</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
