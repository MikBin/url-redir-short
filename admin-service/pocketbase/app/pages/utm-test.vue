<script setup lang="ts">
import { ref } from 'vue'

const url = ref('https://example.com/promo')
</script>

<template>
  <div class="p-8 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">UTM Test Page</h1>
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700">Base URL</label>
      <input type="text" v-model="url" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
    </div>
    <UtmBuilder v-model="url" />
  </div>
</template>
