<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { z } from 'zod';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Alert from '$components/ui/Alert.svelte';
  
  export let loading = false;
  export let error: string | null = null;
  
  const dispatch = createEventDispatcher<{
    submit: { email: string; password: string };
  }>();
  
  // Form validation schema
  const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required')
  });
  
  // Form state
  let formData = {
    email: '',
    password: ''
  };
  
  let formErrors: Record<string, string> = {};
  let showPassword = false;
  
  // Validate form
  function validateForm() {
    try {
      loginSchema.parse(formData);
      formErrors = {};
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        formErrors = {};
        err.errors.forEach(error => {
          if (error.path[0]) {
            formErrors[error.path[0] as string] = error.message;
          }
        });
      }
      return false;
    }
  }
  
  // Handle form submission
  function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    dispatch('submit', formData);
  }
  
  // Handle input changes
  function handleInputChange(field: string, value: string) {
    formData[field as keyof typeof formData] = value;
    
    // Clear field error when user starts typing
    if (formErrors[field]) {
      delete formErrors[field];
      formErrors = { ...formErrors };
    }
  }
  
  // Toggle password visibility
  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<form on:submit={handleSubmit} class="login-form space-y-6">
  <!-- Global Error Alert -->
  {#if error}
    <Alert type="error" dismissible on:dismiss={() => error = null}>
      {error}
    </Alert>
  {/if}
  
  <!-- Email Field -->
  <div>
    <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Email address
    </label>
    <Input
      id="email"
      type="email"
      placeholder="Enter your email"
      bind:value={formData.email}
      on:input={(e) => handleInputChange('email', e.detail)}
      error={formErrors.email}
      disabled={loading}
      required
      autocomplete="email"
    />
  </div>
  
  <!-- Password Field -->
  <div>
    <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Password
    </label>
    <div class="relative">
      <Input
        id="password"
        type={showPassword ? 'text' : 'password'}
        placeholder="Enter your password"
        bind:value={formData.password}
        on:input={(e) => handleInputChange('password', e.detail)}
        error={formErrors.password}
        disabled={loading}
        required
        autocomplete="current-password"
      />
      
      <!-- Password Toggle Button -->
      <button
        type="button"
        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        on:click={togglePasswordVisibility}
        disabled={loading}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {#if showPassword}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        {/if}
      </button>
    </div>
  </div>
  
  <!-- Remember Me Checkbox -->
  <div class="flex items-center justify-between">
    <div class="flex items-center">
      <input
        id="remember-me"
        name="remember-me"
        type="checkbox"
        class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        disabled={loading}
      />
      <label for="remember-me" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
        Remember me
      </label>
    </div>
  </div>
  
  <!-- Submit Button -->
  <Button
    type="submit"
    variant="primary"
    size="lg"
    fullWidth
    {loading}
    disabled={loading || Object.keys(formErrors).length > 0}
  >
    {#if loading}
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Signing in...
    {:else}
      Sign in
    {/if}
  </Button>
</form>

<style>
  /* Custom focus styles for form elements */
  :global(.login-form input:focus) {
    @apply ring-2 ring-primary-500 border-primary-500;
  }
  
  /* Smooth transitions for form elements */
  :global(.login-form input, .login-form button) {
    @apply transition-all duration-200;
  }
  
  /* Loading state styles */
  :global(.login-form input:disabled) {
    @apply opacity-50 cursor-not-allowed;
  }
</style>
