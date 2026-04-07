<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <!-- Header/Navigation -->
    <header class="bg-white shadow p-4 flex justify-between items-center w-full">
      <NuxtLink to="/" class="text-xl font-bold text-blue-600">Admin Service</NuxtLink>
      <nav class="space-x-4">
        <NuxtLink to="/domains" class="text-gray-700 hover:text-blue-600 font-medium">Domains</NuxtLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="flex-grow w-full p-4">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
// Application root component
</script>
