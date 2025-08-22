<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$stores/auth';
  import { themeStore } from '$stores/theme';
  import LoginForm from '$components/auth/LoginForm.svelte';
  import AuthLayout from '$components/auth/AuthLayout.svelte';
  
  // Reactive statements
  $: isAuthenticated = $authStore.isAuthenticated;
  $: loading = $authStore.loading;
  $: error = $authStore.error;
  
  // Redirect if already authenticated
  onMount(() => {
    if (isAuthenticated) {
      goto('/dashboard');
    }
  });
  
  // Handle login
  async function handleLogin(event: CustomEvent<{ email: string; password: string }>) {
    const { email, password } = event.detail;
    await authStore.login(email, password);
  }
  
  // Clear error when component unmounts
  onMount(() => {
    return () => {
      authStore.clearError();
    };
  });
</script>

<svelte:head>
  <title>Login - Boarding House Monitor</title>
  <meta name="description" content="Sign in to your Boarding House Monitor account to manage your properties and tenants." />
</svelte:head>

<AuthLayout>
  <div class="w-full max-w-md mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome back
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Sign in to your account to continue
      </p>
    </div>
    
    <!-- Login Form -->
    <LoginForm 
      on:submit={handleLogin}
      {loading}
      {error}
    />
    
    <!-- Footer Links -->
    <div class="mt-8 text-center space-y-4">
      <div class="text-sm">
        <span class="text-gray-600 dark:text-gray-400">Don't have an account?</span>
        <a 
          href="/auth/register" 
          class="ml-1 font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
        >
          Sign up
        </a>
      </div>
      
      <div class="text-sm">
        <a 
          href="/auth/forgot-password" 
          class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
        >
          Forgot your password?
        </a>
      </div>
    </div>
    
    <!-- Demo Credentials (Development Only) -->
    {#if import.meta.env.DEV}
      <div class="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          Demo Credentials
        </h3>
        <div class="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
          <div><strong>Super Admin:</strong> admin@boardinghouse.com / admin123</div>
          <div><strong>House Owner:</strong> owner@boardinghouse.com / owner123</div>
          <div><strong>House Manager:</strong> manager@boardinghouse.com / manager123</div>
        </div>
      </div>
    {/if}
  </div>
</AuthLayout>

<style>
  /* Custom animations for the login page */
  :global(.login-form) {
    animation: slideUp 0.5s ease-out;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
