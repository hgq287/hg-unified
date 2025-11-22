<template>
  <aside class="w-64 bg-gray-800 text-white p-4">
    <nav>
      <ul>
        <li><router-link to="/">Dashboard</router-link></li>
        <li><router-link to="/file-tools">File Tools</router-link></li>
        <li><router-link to="/notes">Notes</router-link></li>
        <li><router-link to="/settings">Settings</router-link></li>
        <li><router-link to="/about">About</router-link></li>
      </ul>
    </nav>
  </aside>
</template>

<script setup></script>

<style scoped>
nav ul li {
  margin: 1rem 0;
}
</style>