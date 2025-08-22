<script lang="ts">
  export let progress = 0; // 0-100
  export let indeterminate = true;
  export let color = 'primary';
  
  $: colorClasses = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    error: 'bg-error-600'
  }[color];
</script>

<div class="fixed top-0 left-0 right-0 z-50">
  <div class="h-1 bg-gray-200 dark:bg-gray-700">
    <div
      class="h-full transition-all duration-300 ease-out {colorClasses} {indeterminate ? 'animate-pulse' : ''}"
      style="width: {indeterminate ? '100%' : `${progress}%`}"
    ></div>
  </div>
</div>

<style>
  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .animate-pulse {
    animation: indeterminate 1.5s ease-in-out infinite;
  }
</style>
