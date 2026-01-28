<!-- src/layouts/Layout.vue -->
<template>
  <div id="app">
    <NavigationBar />
    <router-view class="page" />
  </div>
</template>

<script setup>
import NavigationBar from '../NavigationBar.vue'
</script>