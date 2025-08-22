<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let id: string | undefined = undefined;
  export let type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' = 'text';
  export let value = '';
  export let placeholder = '';
  export let disabled = false;
  export let required = false;
  export let readonly = false;
  export let autocomplete: string | undefined = undefined;
  export let error: string | undefined = undefined;
  export let helperText: string | undefined = undefined;
  export let label: string | undefined = undefined;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let fullWidth = true;
  
  const dispatch = createEventDispatcher<{
    input: string;
    change: string;
    focus: FocusEvent;
    blur: FocusEvent;
  }>();
  
  let inputElement: HTMLInputElement;
  
  // Compute classes based on props
  $: baseClasses = 'block border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200';
  
  $: sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }[size];
  
  $: stateClasses = error 
    ? 'border-error-300 focus:ring-error-500 focus:border-error-500' 
    : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:border-gray-600 dark:focus:border-primary-500';
  
  $: widthClasses = fullWidth ? 'w-full' : '';
  
  $: disabledClasses = disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400' : 'bg-white dark:bg-gray-900 dark:text-white';
  
  $: allClasses = `${baseClasses} ${sizeClasses} ${stateClasses} ${widthClasses} ${disabledClasses}`;
  
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('input', value);
  }
  
  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    dispatch('change', target.value);
  }
  
  function handleFocus(event: FocusEvent) {
    dispatch('focus', event);
  }
  
  function handleBlur(event: FocusEvent) {
    dispatch('blur', event);
  }
  
  // Expose focus method
  export function focus() {
    inputElement?.focus();
  }
  
  // Expose blur method
  export function blur() {
    inputElement?.blur();
  }
</script>

<div class="space-y-1">
  {#if label}
    <label for={id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      {#if required}
        <span class="text-error-500 ml-1">*</span>
      {/if}
    </label>
  {/if}
  
  <input
    bind:this={inputElement}
    {id}
    {type}
    {placeholder}
    {disabled}
    {required}
    {readonly}
    {autocomplete}
    {value}
    class={allClasses}
    on:input={handleInput}
    on:change={handleChange}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown
    on:keyup
    on:keypress
  />
  
  {#if error}
    <p class="text-sm text-error-600 dark:text-error-400 flex items-center mt-1">
      <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      {error}
    </p>
  {:else if helperText}
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
      {helperText}
    </p>
  {/if}
</div>
