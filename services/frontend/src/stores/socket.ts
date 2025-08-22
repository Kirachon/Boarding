import { writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';

export interface SocketState {
  connected: boolean;
  socket: Socket | null;
  error: string | null;
  reconnectAttempts: number;
}

const initialState: SocketState = {
  connected: false,
  socket: null,
  error: null,
  reconnectAttempts: 0
};

function createSocketStore() {
  const { subscribe, set, update } = writable<SocketState>(initialState);
  
  let socket: Socket | null = null;
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  return {
    subscribe,
    
    // Connect to socket server
    connect: (token: string) => {
      if (socket?.connected) {
        return;
      }
      
      socket = io(SOCKET_URL, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
      
      // Connection successful
      socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
        update(state => ({
          ...state,
          connected: true,
          socket,
          error: null,
          reconnectAttempts: 0
        }));
      });
      
      // Connection error
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        update(state => ({
          ...state,
          connected: false,
          error: error.message,
          reconnectAttempts: state.reconnectAttempts + 1
        }));
      });
      
      // Disconnection
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        update(state => ({
          ...state,
          connected: false,
          error: reason === 'io server disconnect' ? 'Server disconnected' : null
        }));
      });
      
      // Reconnection attempt
      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Socket reconnection attempt ${attemptNumber}`);
        update(state => ({
          ...state,
          reconnectAttempts: attemptNumber
        }));
      });
      
      // Reconnection successful
      socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
        update(state => ({
          ...state,
          connected: true,
          error: null,
          reconnectAttempts: 0
        }));
      });
      
      // Reconnection failed
      socket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed');
        update(state => ({
          ...state,
          connected: false,
          error: 'Failed to reconnect to server'
        }));
      });
      
      // Welcome message
      socket.on('connected', (data) => {
        console.log('Socket welcome message:', data);
      });
      
      // Error handling
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        update(state => ({
          ...state,
          error: error.message || 'Socket error occurred'
        }));
      });
      
      // Update store with socket instance
      update(state => ({
        ...state,
        socket
      }));
    },
    
    // Disconnect from socket server
    disconnect: () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      
      set(initialState);
    },
    
    // Subscribe to room updates
    subscribeToRoom: (roomId: number) => {
      if (socket?.connected) {
        socket.emit('subscribe:room', roomId);
      }
    },
    
    // Unsubscribe from room updates
    unsubscribeFromRoom: (roomId: number) => {
      if (socket?.connected) {
        socket.emit('unsubscribe:room', roomId);
      }
    },
    
    // Subscribe to building updates
    subscribeToBuilding: (buildingId: number) => {
      if (socket?.connected) {
        socket.emit('subscribe:building', buildingId);
      }
    },
    
    // Listen for room updates
    onRoomUpdate: (callback: (data: any) => void) => {
      if (socket) {
        socket.on('room:updated', callback);
        socket.on('room:availability_changed', callback);
      }
    },
    
    // Listen for booking updates
    onBookingUpdate: (callback: (data: any) => void) => {
      if (socket) {
        socket.on('booking:updated', callback);
      }
    },
    
    // Listen for inventory alerts
    onInventoryAlert: (callback: (data: any) => void) => {
      if (socket) {
        socket.on('inventory:low_stock_alert', callback);
      }
    },
    
    // Listen for notifications
    onNotification: (callback: (data: any) => void) => {
      if (socket) {
        socket.on('notification', callback);
      }
    },
    
    // Listen for system announcements
    onSystemAnnouncement: (callback: (data: any) => void) => {
      if (socket) {
        socket.on('system:announcement', callback);
      }
    },
    
    // Send ping to test connection
    ping: () => {
      if (socket?.connected) {
        socket.emit('ping');
      }
    },
    
    // Remove all listeners
    removeAllListeners: () => {
      if (socket) {
        socket.removeAllListeners();
      }
    },
    
    // Get connection status
    isConnected: (): boolean => {
      return socket?.connected || false;
    },
    
    // Clear error
    clearError: () => {
      update(state => ({
        ...state,
        error: null
      }));
    }
  };
}

export const socketStore = createSocketStore();
