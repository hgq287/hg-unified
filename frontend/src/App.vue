<template>
  <div class="flex min-h-screen">
    <Sidebar />
    <main class="flex-1 p-4">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
</script>