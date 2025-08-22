<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$stores/auth';
  import { socketStore } from '$stores/socket';
  import { apiClient, API_ENDPOINTS } from '$utils/api';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Alert from '$components/ui/Alert.svelte';
  import RoomCard from '$components/rooms/RoomCard.svelte';
  import RoomFilters from '$components/rooms/RoomFilters.svelte';
  import CreateRoomModal from '$components/rooms/CreateRoomModal.svelte';
  
  let loading = true;
  let error: string | null = null;
  let rooms: any[] = [];
  let pagination: any = null;
  let showCreateModal = false;
  let viewMode: 'grid' | 'list' = 'grid';
  
  // Filters
  let filters = {
    search: '',
    status: '',
    type: '',
    buildingId: '',
    minRate: '',
    maxRate: '',
    floor: ''
  };
  
  let currentPage = 1;
  const pageSize = 12;
  
  $: user = $authStore.user;
  
  onMount(async () => {
    await loadRooms();
    
    // Subscribe to real-time room updates
    socketStore.onRoomUpdate(handleRoomUpdate);
  });
  
  async function loadRooms() {
    try {
      loading = true;
      error = null;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });
      
      const response = await apiClient.get(`${API_ENDPOINTS.ROOMS.LIST}?${params}`);
      rooms = response.data.rooms;
      pagination = response.data.pagination;
    } catch (err: any) {
      error = err.message || 'Failed to load rooms';
      console.error('Rooms load error:', err);
    } finally {
      loading = false;
    }
  }
  
  function handleRoomUpdate(data: any) {
    console.log('Room update received:', data);
    // Update the specific room in the list
    const roomIndex = rooms.findIndex(room => room.room_id === data.roomId);
    if (roomIndex !== -1) {
      rooms[roomIndex] = { ...rooms[roomIndex], ...data.data };
      rooms = [...rooms]; // Trigger reactivity
    }
  }
  
  function handleFilterChange() {
    currentPage = 1;
    loadRooms();
  }
  
  function handlePageChange(page: number) {
    currentPage = page;
    loadRooms();
  }
  
  function handleCreateRoom() {
    showCreateModal = true;
  }
  
  function handleRoomCreated() {
    showCreateModal = false;
    loadRooms();
  }
  
  function toggleViewMode() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
  }
  
  // Check if user can create rooms
  $: canCreateRooms = user?.roles?.some(role => 
    ['super_admin', 'house_owner', 'house_manager'].includes(role.role)
  ) || false;
</script>

<svelte:head>
  <title>Rooms - Boarding House Monitor</title>
  <meta name="description" content="Manage your boarding house rooms, view availability, and track occupancy status." />
</svelte:head>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Rooms
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Manage your boarding house rooms and track availability
      </p>
    </div>
    
    <div class="mt-4 sm:mt-0 flex items-center space-x-3">
      <!-- View Mode Toggle -->
      <div class="flex rounded-lg border border-gray-300 dark:border-gray-600">
        <button
          class="px-3 py-2 text-sm font-medium rounded-l-lg transition-colors {
            viewMode === 'grid' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }"
          on:click={() => viewMode = 'grid'}
          aria-label="Grid view"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          class="px-3 py-2 text-sm font-medium rounded-r-lg transition-colors {
            viewMode === 'list' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }"
          on:click={() => viewMode = 'list'}
          aria-label="List view"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      <!-- Create Room Button -->
      {#if canCreateRooms}
        <Button variant="primary" on:click={handleCreateRoom}>
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </Button>
      {/if}
    </div>
  </div>
  
  <!-- Filters -->
  <RoomFilters bind:filters on:change={handleFilterChange} />
  
  <!-- Error Alert -->
  {#if error}
    <Alert type="error" dismissible on:dismiss={() => error = null}>
      {error}
    </Alert>
  {/if}
  
  <!-- Loading State -->
  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each Array(8) as _}
        <div class="card">
          <div class="card-body">
            <div class="animate-pulse space-y-4">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if rooms.length > 0}
    <!-- Rooms Grid/List -->
    <div class="grid {viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'} gap-6">
      {#each rooms as room (room.room_id)}
        <RoomCard {room} {viewMode} />
      {/each}
    </div>
    
    <!-- Pagination -->
    {#if pagination && pagination.totalPages > 1}
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700 dark:text-gray-300">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} rooms
        </div>
        
        <div class="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev}
            on:click={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          
          {#each Array(Math.min(5, pagination.totalPages)) as _, i}
            {@const page = i + 1}
            <Button
              variant={page === pagination.page ? 'primary' : 'outline'}
              size="sm"
              on:click={() => handlePageChange(page)}
            >
              {page}
            </Button>
          {/each}
          
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNext}
            on:click={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Empty State -->
    <div class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No rooms found</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {filters.search || Object.values(filters).some(v => v) 
          ? 'Try adjusting your search criteria.' 
          : 'Get started by creating your first room.'}
      </p>
      {#if canCreateRooms && !Object.values(filters).some(v => v)}
        <div class="mt-6">
          <Button variant="primary" on:click={handleCreateRoom}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Room
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Create Room Modal -->
{#if showCreateModal}
  <CreateRoomModal
    on:close={() => showCreateModal = false}
    on:created={handleRoomCreated}
  />
{/if}
