<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$stores/auth';
  import { socketStore } from '$stores/socket';
  import { apiClient } from '$utils/api';
  import DashboardStats from '$components/dashboard/DashboardStats.svelte';
  import RecentActivity from '$components/dashboard/RecentActivity.svelte';
  import QuickActions from '$components/dashboard/QuickActions.svelte';
  import RoomAvailability from '$components/dashboard/RoomAvailability.svelte';
  import Alert from '$components/ui/Alert.svelte';
  
  let loading = true;
  let error: string | null = null;
  let dashboardData: any = null;
  
  $: user = $authStore.user;
  $: isConnected = $socketStore.connected;
  
  onMount(async () => {
    await loadDashboardData();
    
    // Subscribe to real-time updates
    if (user?.roles) {
      const buildingIds = user.roles.map(role => role.buildingId);
      buildingIds.forEach(buildingId => {
        socketStore.subscribeToBuilding(buildingId);
      });
    }
    
    // Listen for real-time updates
    socketStore.onRoomUpdate(handleRoomUpdate);
    socketStore.onBookingUpdate(handleBookingUpdate);
    socketStore.onInventoryAlert(handleInventoryAlert);
  });
  
  async function loadDashboardData() {
    try {
      loading = true;
      error = null;
      
      // Load dashboard statistics
      const [statsResponse, activityResponse] = await Promise.all([
        apiClient.get('/dashboard/stats'),
        apiClient.get('/dashboard/activity')
      ]);
      
      dashboardData = {
        stats: statsResponse.data,
        activity: activityResponse.data
      };
    } catch (err: any) {
      error = err.message || 'Failed to load dashboard data';
      console.error('Dashboard load error:', err);
    } finally {
      loading = false;
    }
  }
  
  function handleRoomUpdate(data: any) {
    console.log('Room update received:', data);
    // Refresh relevant dashboard sections
    loadDashboardData();
  }
  
  function handleBookingUpdate(data: any) {
    console.log('Booking update received:', data);
    // Refresh relevant dashboard sections
    loadDashboardData();
  }
  
  function handleInventoryAlert(data: any) {
    console.log('Inventory alert received:', data);
    // Show notification or update inventory section
  }
</script>

<svelte:head>
  <title>Dashboard - Boarding House Monitor</title>
  <meta name="description" content="Overview of your boarding house operations, occupancy rates, and recent activities." />
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Welcome back, {user?.firstName}! Here's what's happening with your properties.
      </p>
    </div>
    
    <!-- Connection Status -->
    <div class="mt-4 sm:mt-0 flex items-center space-x-2">
      <div class="flex items-center space-x-2">
        <div class="w-2 h-2 rounded-full {isConnected ? 'bg-success-500' : 'bg-error-500'}"></div>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  </div>
  
  <!-- Error Alert -->
  {#if error}
    <Alert type="error" dismissible on:dismiss={() => error = null}>
      {error}
    </Alert>
  {/if}
  
  <!-- Loading State -->
  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each Array(4) as _}
        <div class="card">
          <div class="card-body">
            <div class="animate-pulse">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if dashboardData}
    <!-- Dashboard Content -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Statistics Cards -->
      <div class="lg:col-span-12">
        <DashboardStats stats={dashboardData.stats} />
      </div>
      
      <!-- Quick Actions -->
      <div class="lg:col-span-4">
        <QuickActions />
      </div>
      
      <!-- Room Availability -->
      <div class="lg:col-span-8">
        <RoomAvailability />
      </div>
      
      <!-- Recent Activity -->
      <div class="lg:col-span-12">
        <RecentActivity activities={dashboardData.activity} />
      </div>
    </div>
  {:else}
    <!-- Empty State -->
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data available</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started by adding your first building and rooms.
      </p>
    </div>
  {/if}
</div>

<style>
  /* Dashboard specific animations */
  :global(.dashboard-card) {
    animation: slideUp 0.5s ease-out;
  }
  
  :global(.dashboard-card:nth-child(2)) {
    animation-delay: 0.1s;
  }
  
  :global(.dashboard-card:nth-child(3)) {
    animation-delay: 0.2s;
  }
  
  :global(.dashboard-card:nth-child(4)) {
    animation-delay: 0.3s;
  }
</style>
