<!-- src/layouts/Layout.vue -->
<template>
  <div class="app-shell">
    <NavigationBar />
    <router-view class="page" />
  </div>
</template>

<script setup>
import NavigationBar from '../NavigationBar.vue'
</script>
